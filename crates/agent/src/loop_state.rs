use mindlattice_ai::provider::{
    LlmError, LlmProvider, LlmStructuredRequest, LlmStructuredResponse,
};
use mindlattice_core::domain::{CheckIn, EdgeKind, MapSnapshot, MemoryProposal, NodeKind};
use mindlattice_core::proposals::{
    validate_agent_preview, AgentPreview, ProposedEdge, ProposedNode,
};
use mindlattice_core::safety::SafetyStatus;
use mindlattice_core::strategies::{ExperimentContext, StrategyDecision, StrategyExperiment};
use serde::Deserialize;

use crate::memory::retrieve_relevant_preferences;
use crate::prompts::assemble_prompt_layers;
use crate::skills::AgentIntent;

#[derive(Clone, Debug, PartialEq)]
pub struct AgentTurnRequest {
    pub user_message: String,
    pub selected_node_id: Option<String>,
    pub map_snapshot: MapSnapshot,
    pub active_preview_id: Option<String>,
    pub confirmed_memory: Vec<String>,
}

#[derive(Clone)]
pub struct AgentTurnRuntime {
    pub llm: std::sync::Arc<dyn AgentLlmProvider>,
    pub tool_budget: u8,
    pub timeout_budget_ms: u64,
    pub llm_configured: bool,
}

pub trait AgentLlmProvider: LlmProvider + Send + Sync {
    fn preview_from_response(
        &self,
        request: &AgentTurnRequest,
        response: LlmStructuredResponse,
    ) -> Result<AgentPreview, AgentError> {
        let _ = request;
        parse_agent_preview_from_provider_content(&response.content)
    }
}

pub struct StructuredLlmProvider<P> {
    inner: P,
}

impl<P> StructuredLlmProvider<P> {
    pub fn new(inner: P) -> Self {
        Self { inner }
    }
}

impl<P> LlmProvider for StructuredLlmProvider<P>
where
    P: LlmProvider + Send + Sync,
{
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        self.inner.complete_structured(request)
    }
}

impl<P> AgentLlmProvider for StructuredLlmProvider<P> where P: LlmProvider + Send + Sync {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgentTurnResponseKind {
    PreviewProposed,
    ShortAnswer,
    Recovery,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentTurnResponse {
    pub kind: AgentTurnResponseKind,
    pub message: String,
    pub preview: Option<AgentPreview>,
    pub prompt_versions: Vec<String>,
    pub prompt_context: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgentError {
    MissingLlmProviderSettings,
    ToolBudgetExhausted,
    TimeoutBudgetExhausted,
    Provider(LlmError),
    SafetyBlocked,
    Prompt,
}

pub fn run_agent_turn(
    request: AgentTurnRequest,
    runtime: AgentTurnRuntime,
) -> Result<AgentTurnResponse, AgentError> {
    if !runtime.llm_configured {
        return Err(AgentError::MissingLlmProviderSettings);
    }
    if runtime.tool_budget == 0 {
        return Err(AgentError::ToolBudgetExhausted);
    }
    if runtime.timeout_budget_ms == 0 {
        return Err(AgentError::TimeoutBudgetExhausted);
    }

    let intent = AgentIntent::classify(&request.user_message);
    let skill_id = match intent {
        AgentIntent::DraftStartPlan => "draft_start_plan",
        AgentIntent::RevisePreview => "revise_graph_preview",
        AgentIntent::RecordStrategyExperiment => "extract_preference_from_experiment",
        AgentIntent::SafetyRedirect => "safe_redirect_for_crisis_or_medical_content",
        AgentIntent::FindNextAction => "find_smaller_next_action",
        AgentIntent::FindBlocker => "identify_blockers",
        AgentIntent::CaptureTask => "capture_messy_task",
        _ => "decompose_to_star_map",
    };

    let retrieved_memory =
        retrieve_relevant_preferences(&request.user_message, &request.confirmed_memory, 3);
    let runtime_context = format!(
        "workspace={}, nodes={}, active_preview={:?}, memory_items={}, retrieved_memory={}",
        request.map_snapshot.workspace.id,
        request.map_snapshot.nodes.len(),
        request.active_preview_id,
        request.confirmed_memory.len(),
        if retrieved_memory.is_empty() {
            "none".to_string()
        } else {
            retrieved_memory.join(" | ")
        }
    );

    let prompt = assemble_prompt_layers(skill_id, &request.user_message, &runtime_context)
        .map_err(|_| AgentError::Prompt)?;

    let llm_response = match runtime.llm.complete_structured(LlmStructuredRequest {
        prompt_version: prompt.version_trace.join(","),
        system_prompt: prompt.combined.clone(),
        user_prompt: request.user_message.clone(),
        output_schema: "agent_preview".to_string(),
        timeout_seconds: runtime.timeout_budget_ms / 1_000,
    }) {
        Ok(response) => response,
        Err(LlmError::MalformedOutput) => {
            return Ok(AgentTurnResponse {
                kind: AgentTurnResponseKind::Recovery,
                message: "I could not read the provider response safely. Please try again with a smaller request."
                    .to_string(),
                preview: None,
                prompt_versions: prompt.version_trace,
                prompt_context: runtime_context,
            });
        }
        Err(error) => return Err(AgentError::Provider(error)),
    };

    let preview = match runtime.llm.preview_from_response(&request, llm_response) {
        Ok(preview) => preview,
        Err(AgentError::Provider(LlmError::MalformedOutput)) => {
            return Ok(malformed_output_recovery(
                prompt.version_trace,
                runtime_context,
            ));
        }
        Err(error) => return Err(error),
    };
    let review = validate_agent_preview(&preview);
    if review.status != SafetyStatus::Allowed {
        return Err(AgentError::SafetyBlocked);
    }

    Ok(AgentTurnResponse {
        kind: AgentTurnResponseKind::PreviewProposed,
        message: "Preview drafted. Review it, revise it, or accept it before anything is saved."
            .to_string(),
        preview: Some(preview),
        prompt_versions: prompt.version_trace,
        prompt_context: runtime_context,
    })
}

fn malformed_output_recovery(
    prompt_versions: Vec<String>,
    prompt_context: String,
) -> AgentTurnResponse {
    AgentTurnResponse {
        kind: AgentTurnResponseKind::Recovery,
        message: "I could not read the provider response safely. Please try again with a smaller request."
            .to_string(),
        preview: None,
        prompt_versions,
        prompt_context,
    }
}

#[derive(Clone, Debug)]
pub struct MockLlmProvider {
    planned_nodes: Vec<(String, NodeKind, String)>,
    planned_edge_kind: Option<EdgeKind>,
    structured_content: Option<String>,
    error: Option<LlmError>,
}

impl MockLlmProvider {
    pub fn empty() -> Self {
        Self {
            planned_nodes: Vec::new(),
            planned_edge_kind: None,
            structured_content: None,
            error: None,
        }
    }

    pub fn with_preview_nodes(nodes: Vec<(&str, NodeKind, &str)>) -> Self {
        Self {
            planned_nodes: nodes
                .into_iter()
                .map(|(id, kind, title)| (id.to_string(), kind, title.to_string()))
                .collect(),
            planned_edge_kind: None,
            structured_content: None,
            error: None,
        }
    }

    pub fn with_preview_edge(kind: EdgeKind) -> Self {
        Self {
            planned_nodes: vec![(
                "next-1".to_string(),
                NodeKind::NextAction,
                "Open the draft and write three bullets".to_string(),
            )],
            planned_edge_kind: Some(kind),
            structured_content: None,
            error: None,
        }
    }

    pub fn with_structured_content(content: &str) -> Self {
        Self {
            planned_nodes: Vec::new(),
            planned_edge_kind: None,
            structured_content: Some(content.to_string()),
            error: None,
        }
    }

    pub fn malformed_output() -> Self {
        Self {
            planned_nodes: Vec::new(),
            planned_edge_kind: None,
            structured_content: None,
            error: Some(LlmError::MalformedOutput),
        }
    }

    fn preview_from_response(
        &self,
        request: &AgentTurnRequest,
        response: LlmStructuredResponse,
    ) -> Result<AgentPreview, AgentError> {
        if self.structured_content.is_some() {
            return parse_agent_preview_from_provider_content(&response.content);
        }

        let nodes = self
            .planned_nodes
            .iter()
            .map(|(id, kind, title)| ProposedNode {
                id: id.clone(),
                kind: *kind,
                title: title.clone(),
                body: None,
            })
            .collect::<Vec<_>>();

        let proposed_edges = self
            .planned_edge_kind
            .map(|kind| {
                vec![ProposedEdge {
                    id: "edge-1".to_string(),
                    source_id: request
                        .selected_node_id
                        .clone()
                        .unwrap_or_else(|| request.map_snapshot.nodes[0].id.clone()),
                    target_id: "next-1".to_string(),
                    kind,
                }]
            })
            .unwrap_or_default();

        Ok(AgentPreview {
            id: "preview-1".to_string(),
            proposed_nodes: nodes,
            proposed_edges,
            proposed_memory: Vec::new(),
            proposed_check_ins: Vec::new(),
            proposed_strategy_experiments: Vec::new(),
            user_visible_summary: "Draft map changes for review.".to_string(),
        })
    }
}

impl LlmProvider for MockLlmProvider {
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        if let Some(error) = &self.error {
            return Err(error.clone());
        }
        request.validate().map_err(|_| LlmError::MalformedOutput)?;
        Ok(LlmStructuredResponse {
            content: self
                .structured_content
                .clone()
                .unwrap_or_else(|| "mock structured response".to_string()),
            prompt_version: request.prompt_version,
        })
    }
}

impl AgentLlmProvider for MockLlmProvider {
    fn preview_from_response(
        &self,
        request: &AgentTurnRequest,
        response: LlmStructuredResponse,
    ) -> Result<AgentPreview, AgentError> {
        MockLlmProvider::preview_from_response(self, request, response)
    }
}

fn parse_agent_preview_from_provider_content(content: &str) -> Result<AgentPreview, AgentError> {
    let payload = serde_json::from_str::<ProviderAgentPreview>(content)
        .map_err(|_| AgentError::Provider(LlmError::MalformedOutput))?;
    payload.into_agent_preview()
}

#[derive(Debug, Deserialize)]
struct ProviderAgentPreview {
    id: String,
    #[serde(default)]
    proposed_nodes: Vec<ProviderProposedNode>,
    #[serde(default)]
    proposed_edges: Vec<ProviderProposedEdge>,
    #[serde(default)]
    proposed_memory: Vec<ProviderMemoryProposal>,
    #[serde(default)]
    proposed_check_ins: Vec<ProviderCheckIn>,
    #[serde(default)]
    proposed_strategy_experiments: Vec<ProviderStrategyExperiment>,
    user_visible_summary: String,
}

impl ProviderAgentPreview {
    fn into_agent_preview(self) -> Result<AgentPreview, AgentError> {
        let proposed_nodes = self
            .proposed_nodes
            .into_iter()
            .map(ProviderProposedNode::into_proposed_node)
            .collect::<Result<Vec<_>, _>>()?;
        let proposed_edges = self
            .proposed_edges
            .into_iter()
            .map(ProviderProposedEdge::into_proposed_edge)
            .collect::<Result<Vec<_>, _>>()?;
        let proposed_memory = self
            .proposed_memory
            .into_iter()
            .map(ProviderMemoryProposal::into_memory_proposal)
            .collect::<Vec<_>>();
        let proposed_check_ins = self
            .proposed_check_ins
            .into_iter()
            .map(ProviderCheckIn::into_check_in)
            .collect::<Vec<_>>();
        let proposed_strategy_experiments = self
            .proposed_strategy_experiments
            .into_iter()
            .map(ProviderStrategyExperiment::into_strategy_experiment)
            .collect::<Result<Vec<_>, _>>()?;

        Ok(AgentPreview {
            id: self.id,
            proposed_nodes,
            proposed_edges,
            proposed_memory,
            proposed_check_ins,
            proposed_strategy_experiments,
            user_visible_summary: self.user_visible_summary,
        })
    }
}

#[derive(Debug, Deserialize)]
struct ProviderProposedNode {
    id: String,
    kind: String,
    title: String,
    body: Option<String>,
}

impl ProviderProposedNode {
    fn into_proposed_node(self) -> Result<ProposedNode, AgentError> {
        let kind = NodeKind::from_str(&self.kind)
            .ok_or(AgentError::Provider(LlmError::MalformedOutput))?;
        Ok(ProposedNode {
            id: self.id,
            kind,
            title: self.title,
            body: self.body,
        })
    }
}

#[derive(Debug, Deserialize)]
struct ProviderProposedEdge {
    id: String,
    source_id: String,
    target_id: String,
    kind: String,
}

impl ProviderProposedEdge {
    fn into_proposed_edge(self) -> Result<ProposedEdge, AgentError> {
        let kind = EdgeKind::from_str(&self.kind)
            .ok_or(AgentError::Provider(LlmError::MalformedOutput))?;
        Ok(ProposedEdge {
            id: self.id,
            source_id: self.source_id,
            target_id: self.target_id,
            kind,
        })
    }
}

#[derive(Debug, Deserialize)]
struct ProviderMemoryProposal {
    id: String,
    proposed_memory_text: String,
    evidence_reference: Option<String>,
}

impl ProviderMemoryProposal {
    fn into_memory_proposal(self) -> MemoryProposal {
        MemoryProposal {
            id: self.id,
            proposed_memory_text: self.proposed_memory_text,
            evidence_reference: self.evidence_reference,
        }
    }
}

#[derive(Debug, Deserialize)]
struct ProviderCheckIn {
    id: String,
    workspace_id: String,
    node_id: Option<String>,
    body: String,
}

impl ProviderCheckIn {
    fn into_check_in(self) -> CheckIn {
        CheckIn {
            id: self.id,
            workspace_id: self.workspace_id,
            node_id: self.node_id,
            body: self.body,
        }
    }
}

#[derive(Debug, Deserialize)]
struct ProviderStrategyExperiment {
    id: String,
    support_template_id: Option<String>,
    custom_support_title: Option<String>,
    context: String,
    helped_start: bool,
    helped_continue: bool,
    helped_return: bool,
    helped_clarify_next_action: bool,
    obstacle_note: Option<String>,
    next_decision: String,
}

impl ProviderStrategyExperiment {
    fn into_strategy_experiment(self) -> Result<StrategyExperiment, AgentError> {
        Ok(StrategyExperiment {
            id: self.id,
            support_template_id: self.support_template_id,
            custom_support_title: self.custom_support_title,
            context: ExperimentContext::from_str(&self.context)
                .ok_or(AgentError::Provider(LlmError::MalformedOutput))?,
            helped_start: self.helped_start,
            helped_continue: self.helped_continue,
            helped_return: self.helped_return,
            helped_clarify_next_action: self.helped_clarify_next_action,
            obstacle_note: self.obstacle_note,
            next_decision: StrategyDecision::from_str(&self.next_decision)
                .ok_or(AgentError::Provider(LlmError::MalformedOutput))?,
        })
    }
}
