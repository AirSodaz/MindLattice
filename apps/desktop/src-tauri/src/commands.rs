use std::cell::RefCell;
use std::path::Path;
use std::sync::Arc;

use mindlattice_agent::loop_state::{
    run_agent_turn, AgentError, AgentLlmProvider, AgentTurnRequest, AgentTurnResponse,
    AgentTurnRuntime, MockLlmProvider, StructuredLlmProvider,
};
use mindlattice_agent::tools::{
    initial_tool_registry, AgentToolInput, AgentToolOutput, AgentToolRouter,
};
use mindlattice_ai::provider::{
    build_llm_provider, LlmApiMode, LlmConfigError, LlmError, LlmProvider, LlmProviderConfig,
    LlmProviderId, LlmStructuredRequest,
};
use mindlattice_core::domain::{
    AgentThread, AgentTurn, AiProposalRecord, AiProposalStatus, AttentionSession,
    AttentionSessionState, CheckIn, ContextProfile, EdgeKind, GraphEdge, GraphNode, MapSnapshot,
    MemoryProposal, NodeKind, NodeNote, PromptVersionRecord, Workspace,
};
use mindlattice_core::proposals::AgentPreview;
use mindlattice_core::safety::{validate_check_in_text, SafetyStatus};
use mindlattice_core::start_plan::{generate_start_plan, start_attention_session, StartPlan};
use mindlattice_core::strategies::{
    adopt_support_template, default_context_profile, list_strategy_cards, list_support_templates,
    StrategyCard, StrategyExperiment, SupportTemplate,
};
use mindlattice_storage::repository::{MindLatticeRepository, RepositoryError};
use mindlattice_vault::markdown::{
    export_workspace, import_files, VaultExportResult, VaultImportFile, VaultImportResult,
};

pub struct CommandRuntime {
    repo: MindLatticeRepository,
    id_sequence: RefCell<u64>,
    llm: RefCell<Option<Arc<dyn AgentLlmProvider>>>,
    active_previews: RefCell<Vec<AgentPreview>>,
}

impl CommandRuntime {
    pub fn in_memory() -> Result<Self, CommandError> {
        let repo = MindLatticeRepository::open_in_memory()?;
        repo.migrate()?;
        Ok(Self::new(repo))
    }

    pub fn open_file(path: impl AsRef<Path>) -> Result<Self, CommandError> {
        let repo = MindLatticeRepository::open_file(path)?;
        repo.migrate()?;
        Ok(Self::new(repo))
    }

    pub fn configure_llm(&self, provider: MockLlmProvider) {
        *self.llm.borrow_mut() = Some(Arc::new(provider));
    }

    fn new(repo: MindLatticeRepository) -> Self {
        Self {
            repo,
            id_sequence: RefCell::new(1),
            llm: RefCell::new(None),
            active_previews: RefCell::new(Vec::new()),
        }
    }

    fn next_id(&self, prefix: &str) -> String {
        let mut sequence = self.id_sequence.borrow_mut();
        let id = format!("{prefix}-{}", *sequence);
        *sequence += 1;
        id
    }

    fn saved_llm_provider(&self) -> Result<Option<Arc<dyn AgentLlmProvider>>, CommandError> {
        let Some(config) = self.saved_llm_config()? else {
            return Ok(None);
        };
        let provider = build_llm_provider(config)
            .map_err(|_error: LlmConfigError| CommandError::InvalidLlmSettings)?;
        Ok(Some(Arc::new(StructuredLlmProvider::new(provider))))
    }

    fn agent_llm(&self) -> Result<Option<Arc<dyn AgentLlmProvider>>, CommandError> {
        let configured_llm = self.llm.borrow().clone();
        let saved_provider = if configured_llm.is_none() {
            self.saved_llm_provider()?
        } else {
            None
        };
        Ok(configured_llm.or(saved_provider))
    }

    fn saved_llm_config(&self) -> Result<Option<LlmProviderConfig>, CommandError> {
        let Some(base_url) = self.repo.setting("llm.base_url")? else {
            return Ok(None);
        };
        let Some(api_key) = self.repo.setting("llm.api_key")? else {
            return Ok(None);
        };
        let Some(model) = self.repo.setting("llm.model")? else {
            return Ok(None);
        };
        let Some(timeout_text) = self.repo.setting("llm.timeout_seconds")? else {
            return Ok(None);
        };
        let timeout_seconds = timeout_text
            .parse::<u64>()
            .map_err(|_| CommandError::InvalidLlmSettings)?;
        let provider_id = match self.repo.setting("llm.provider_id")? {
            Some(value) => LlmProviderId::from_str(&value)
                .ok_or(CommandError::InvalidLlmSettings)?,
            None => LlmProviderId::OpenAi,
        };
        let api_mode = match self.repo.setting("llm.api_mode")? {
            Some(value) => LlmApiMode::from_str(&value)
                .ok_or(CommandError::InvalidLlmSettings)?,
            None => LlmApiMode::OpenAiChatCompletions,
        };
        let config = LlmProviderConfig {
            provider_id,
            api_mode,
            base_url,
            api_key,
            model,
            timeout_seconds,
        };
        config
            .validate()
            .map_err(|_error: LlmConfigError| CommandError::InvalidLlmSettings)?;
        Ok(Some(config))
    }
}

#[derive(Debug, Eq, PartialEq)]
pub enum CommandError {
    Repository,
    MissingLlmProviderSettings,
    ToolBudgetExhausted,
    TimeoutBudgetExhausted,
    Provider,
    SafetyBlocked,
    Prompt,
    NodeNotFound(String),
    EdgeNotFound(String),
    NodeIsNotNextAction(String),
    AttentionSessionNotFound(String),
    PreviewNotFound(String),
    InvalidLlmSettings,
    InvalidCommandInput,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultImportFileDto {
    pub filename: String,
    pub content: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LlmProviderTestResult {
    pub status: String,
    pub model: String,
    pub message: String,
}

impl From<RepositoryError> for CommandError {
    fn from(value: RepositoryError) -> Self {
        match value {
            RepositoryError::NodeNotFound(id) => Self::NodeNotFound(id),
            RepositoryError::EdgeNotFound(id) => Self::EdgeNotFound(id),
            RepositoryError::AttentionSessionNotFound(id) => Self::AttentionSessionNotFound(id),
            _ => Self::Repository,
        }
    }
}

impl From<AgentError> for CommandError {
    fn from(value: AgentError) -> Self {
        match value {
            AgentError::MissingLlmProviderSettings => Self::MissingLlmProviderSettings,
            AgentError::ToolBudgetExhausted => Self::ToolBudgetExhausted,
            AgentError::TimeoutBudgetExhausted => Self::TimeoutBudgetExhausted,
            AgentError::Provider(_) => Self::Provider,
            AgentError::SafetyBlocked => Self::SafetyBlocked,
            AgentError::Prompt => Self::Prompt,
        }
    }
}

pub fn workspace_open_default(runtime: &CommandRuntime) -> Result<Workspace, CommandError> {
    let workspace = Workspace {
        id: "default-workspace".to_string(),
        title: "Default workspace".to_string(),
    };
    runtime.repo.upsert_workspace(&workspace)?;
    Ok(workspace)
}

pub fn map_get(runtime: &CommandRuntime, workspace_id: &str) -> Result<MapSnapshot, CommandError> {
    Ok(runtime.repo.map_snapshot(workspace_id)?)
}

pub fn node_create(
    runtime: &CommandRuntime,
    workspace_id: &str,
    kind: NodeKind,
    title: &str,
) -> Result<GraphNode, CommandError> {
    let node = GraphNode {
        id: runtime.next_id("node"),
        workspace_id: workspace_id.to_string(),
        kind,
        title: title.to_string(),
        body: None,
        metadata: None,
        position: None,
    };
    runtime.repo.upsert_node(&node)?;
    Ok(node)
}

pub fn node_update(
    runtime: &CommandRuntime,
    node_id: &str,
    kind: NodeKind,
    title: &str,
    body: Option<&str>,
) -> Result<GraphNode, CommandError> {
    let mut node = runtime.repo.node(node_id)?;
    node.kind = kind;
    node.title = title.to_string();
    node.body = body.map(ToOwned::to_owned);
    runtime.repo.upsert_node(&node)?;
    Ok(node)
}

pub fn node_move(
    runtime: &CommandRuntime,
    node_id: &str,
    x: f64,
    y: f64,
) -> Result<GraphNode, CommandError> {
    let mut node = runtime.repo.node(node_id)?;
    node.position = Some(mindlattice_core::domain::NodePosition { x, y });
    runtime.repo.upsert_node(&node)?;
    Ok(node)
}

pub fn edge_create(
    runtime: &CommandRuntime,
    workspace_id: &str,
    source_id: &str,
    target_id: &str,
    kind: EdgeKind,
) -> Result<GraphEdge, CommandError> {
    let id = runtime.next_id("edge");
    runtime
        .repo
        .upsert_edge(&id, workspace_id, source_id, target_id, kind)?;
    Ok(GraphEdge {
        id,
        workspace_id: workspace_id.to_string(),
        source_id: source_id.to_string(),
        target_id: target_id.to_string(),
        kind,
    })
}

pub fn edge_delete(runtime: &CommandRuntime, edge_id: &str) -> Result<(), CommandError> {
    runtime.repo.delete_edge(edge_id)?;
    Ok(())
}

pub fn support_templates_list(
    _runtime: &CommandRuntime,
) -> Result<Vec<SupportTemplate>, CommandError> {
    Ok(list_support_templates())
}

pub fn strategy_cards_list(_runtime: &CommandRuntime) -> Result<Vec<StrategyCard>, CommandError> {
    Ok(list_strategy_cards())
}

pub fn support_adopt(
    runtime: &CommandRuntime,
    workspace_id: &str,
    template_id: &str,
) -> Result<GraphNode, CommandError> {
    let template = list_support_templates()
        .into_iter()
        .find(|template| template.id == template_id)
        .ok_or(CommandError::Repository)?;
    let node = adopt_support_template(workspace_id, &runtime.next_id("support"), template_id)
        .ok_or(CommandError::Repository)?;
    runtime.repo.upsert_node(&node)?;
    runtime.repo.upsert_node_note(&NodeNote {
        node_id: node.id.clone(),
        body: support_adoption_note_body(&template),
    })?;
    Ok(node)
}

fn support_adoption_note_body(template: &SupportTemplate) -> String {
    format!(
        "Template: {}\nCategory: {}\nSource note: {}\nSafety note: {}",
        template.id,
        template.category.as_str(),
        template.source_note,
        template.safety_note
    )
}

pub fn support_discard(
    runtime: &CommandRuntime,
    support_node_id: &str,
) -> Result<(), CommandError> {
    let node = runtime.repo.node(support_node_id)?;
    if node.kind != NodeKind::Support {
        return Err(CommandError::InvalidCommandInput);
    }
    runtime.repo.delete_node(support_node_id)?;
    Ok(())
}

pub fn strategy_experiment_create(
    runtime: &CommandRuntime,
    experiment: StrategyExperiment,
) -> Result<StrategyExperiment, CommandError> {
    runtime.repo.record_strategy_experiment(&experiment)?;
    Ok(experiment)
}

pub fn context_profile_get(
    runtime: &CommandRuntime,
    workspace_id: &str,
) -> Result<ContextProfile, CommandError> {
    match runtime.repo.context_profile(workspace_id) {
        Ok(profile) => Ok(profile),
        Err(RepositoryError::ContextProfileNotFound(_)) => Ok(default_context_profile(
            &runtime.next_id("context-profile"),
            workspace_id,
        )),
        Err(error) => Err(error.into()),
    }
}

pub fn context_profile_update(
    runtime: &CommandRuntime,
    profile: ContextProfile,
) -> Result<ContextProfile, CommandError> {
    runtime.repo.upsert_context_profile(&profile)?;
    Ok(profile)
}

pub fn attention_session_start(
    runtime: &CommandRuntime,
    next_action_id: &str,
    intended_duration_minutes: u16,
    started_at: &str,
) -> Result<AttentionSession, CommandError> {
    let snapshot = runtime.repo.map_snapshot("default-workspace")?;
    let node = snapshot
        .nodes
        .into_iter()
        .find(|node| node.id == next_action_id)
        .ok_or_else(|| CommandError::NodeNotFound(next_action_id.to_string()))?;
    if node.kind != NodeKind::NextAction {
        return Err(CommandError::NodeIsNotNextAction(node.id));
    }

    let session = start_attention_session(
        &runtime.next_id("attention-session"),
        None,
        &node,
        intended_duration_minutes,
        started_at,
    )
    .map_err(|_| CommandError::NodeIsNotNextAction(node.id.clone()))?;
    runtime.repo.upsert_attention_session(&session)?;
    Ok(session)
}

pub fn start_plan_get(
    runtime: &CommandRuntime,
    workspace_id: &str,
    next_action_id: &str,
) -> Result<StartPlan, CommandError> {
    let snapshot = runtime.repo.map_snapshot(workspace_id)?;
    generate_start_plan(&snapshot, next_action_id).map_err(|error| match error {
        mindlattice_core::start_plan::StartPlanError::NextActionNotFound(id) => {
            CommandError::NodeNotFound(id)
        }
        mindlattice_core::start_plan::StartPlanError::NodeIsNotNextAction { node_id, .. }
        | mindlattice_core::start_plan::StartPlanError::InvalidAttentionSessionNode {
            node_id,
            ..
        } => CommandError::NodeIsNotNextAction(node_id),
        mindlattice_core::start_plan::StartPlanError::InvalidGraph(_) => CommandError::Repository,
    })
}

pub fn attention_session_close(
    runtime: &CommandRuntime,
    session_id: &str,
    ended_at: &str,
    completion_note: Option<&str>,
) -> Result<AttentionSession, CommandError> {
    let mut session = runtime.repo.attention_session(session_id)?;
    session.ended_at = Some(ended_at.to_string());
    session.state = AttentionSessionState::Closed;
    session.completion_note = completion_note.map(ToOwned::to_owned);
    runtime.repo.upsert_attention_session(&session)?;
    Ok(session)
}

pub fn agent_turn_submit(
    runtime: &CommandRuntime,
    workspace_id: &str,
    selected_node_id: Option<&str>,
    user_message: &str,
) -> Result<AgentTurnResponse, CommandError> {
    let snapshot = runtime.repo.map_snapshot(workspace_id)?;
    let workspace = snapshot.workspace.clone();
    let llm = runtime.agent_llm()?;
    let llm_configured = llm.is_some();
    let llm = llm.unwrap_or_else(|| Arc::new(MockLlmProvider::empty()));

    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: user_message.to_string(),
            selected_node_id: selected_node_id.map(ToOwned::to_owned),
            map_snapshot: snapshot,
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        AgentTurnRuntime {
            llm,
            tool_budget: 4,
            timeout_budget_ms: 1_000,
            llm_configured,
        },
    )?;
    let thread = persist_agent_turn_state(runtime, &workspace, user_message, &response)?;
    if let Some(preview) = &response.preview {
        runtime
            .repo
            .upsert_agent_preview_for_thread(preview, Some(&thread.id))?;
        runtime.repo.upsert_ai_proposal(&preview_proposal_record(
            &preview.id,
            AiProposalStatus::Active,
        ))?;
        runtime.active_previews.borrow_mut().push(preview.clone());
    }
    Ok(response)
}

pub fn agent_preview_revise(
    runtime: &CommandRuntime,
    workspace_id: &str,
    preview_id: &str,
    user_message: &str,
) -> Result<AgentTurnResponse, CommandError> {
    let _active_preview = agent_preview_get(runtime, preview_id)?
        .ok_or_else(|| CommandError::PreviewNotFound(preview_id.to_string()))?;
    let snapshot = runtime.repo.map_snapshot(workspace_id)?;
    let workspace = snapshot.workspace.clone();
    let llm = runtime.agent_llm()?;
    let llm_configured = llm.is_some();
    let llm = llm.unwrap_or_else(|| Arc::new(MockLlmProvider::empty()));
    let revision_message = format!("Revise the active preview: {user_message}");

    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: revision_message.clone(),
            selected_node_id: None,
            map_snapshot: snapshot,
            active_preview_id: Some(preview_id.to_string()),
            confirmed_memory: Vec::new(),
        },
        AgentTurnRuntime {
            llm,
            tool_budget: 4,
            timeout_budget_ms: 1_000,
            llm_configured,
        },
    )?;
    let thread = persist_agent_turn_state(runtime, &workspace, &revision_message, &response)?;
    if let Some(preview) = &response.preview {
        runtime
            .repo
            .upsert_agent_preview_for_thread(preview, Some(&thread.id))?;
        runtime.repo.upsert_ai_proposal(&preview_proposal_record(
            &preview.id,
            AiProposalStatus::Active,
        ))?;
        if preview.id != preview_id {
            runtime
                .repo
                .set_agent_preview_status(preview_id, "rejected")?;
            runtime.repo.upsert_ai_proposal(&preview_proposal_record(
                preview_id,
                AiProposalStatus::Rejected,
            ))?;
        }
        let mut active_previews = runtime.active_previews.borrow_mut();
        active_previews.retain(|active| active.id != preview_id && active.id != preview.id);
        active_previews.push(preview.clone());
    }
    Ok(response)
}

fn preview_proposal_record(preview_id: &str, status: AiProposalStatus) -> AiProposalRecord {
    AiProposalRecord {
        id: preview_id.to_string(),
        proposal_type: "agent_preview".to_string(),
        status,
    }
}

fn persist_agent_turn_state(
    runtime: &CommandRuntime,
    workspace: &Workspace,
    user_message: &str,
    response: &AgentTurnResponse,
) -> Result<AgentThread, CommandError> {
    let thread = AgentThread {
        id: format!("agent-thread-{}", workspace.id),
        workspace_id: workspace.id.clone(),
        title: format!("{} agent thread", workspace.title),
    };
    runtime.repo.upsert_agent_thread(&thread)?;
    for prompt_version in &response.prompt_versions {
        runtime
            .repo
            .upsert_prompt_version(&prompt_version_record(prompt_version))?;
    }
    runtime.repo.insert_agent_turn(&AgentTurn {
        id: runtime.next_id("agent-turn"),
        thread_id: thread.id.clone(),
        user_message: user_message.to_string(),
        agent_response: response.message.clone(),
        prompt_version_id: (!response.prompt_versions.is_empty())
            .then(|| response.prompt_versions.join(",")),
    })?;
    Ok(thread)
}

fn prompt_version_record(version_id: &str) -> PromptVersionRecord {
    let (layer, version) = version_id
        .split_once('@')
        .unwrap_or((version_id, "unversioned"));
    PromptVersionRecord {
        id: version_id.to_string(),
        layer: layer.to_string(),
        version: version.to_string(),
        content_hash: format!("prompt-version:{version_id}"),
    }
}

pub fn agent_preview_get(
    runtime: &CommandRuntime,
    preview_id: &str,
) -> Result<Option<AgentPreview>, CommandError> {
    Ok(runtime.repo.active_agent_preview(preview_id)?)
}

pub fn agent_preview_reject(
    runtime: &CommandRuntime,
    preview_id: &str,
) -> Result<(), CommandError> {
    runtime
        .repo
        .set_agent_preview_status(preview_id, "rejected")?;
    runtime.repo.upsert_ai_proposal(&preview_proposal_record(
        preview_id,
        AiProposalStatus::Rejected,
    ))?;
    runtime
        .active_previews
        .borrow_mut()
        .retain(|preview| preview.id != preview_id);
    Ok(())
}

pub fn agent_preview_accept(
    runtime: &CommandRuntime,
    workspace_id: &str,
    preview_id: &str,
) -> Result<(), CommandError> {
    let preview = agent_preview_get(runtime, preview_id)?
        .ok_or_else(|| CommandError::PreviewNotFound(preview_id.to_string()))?;
    let snapshot = runtime.repo.map_snapshot(workspace_id)?;
    let existing_node_ids = snapshot
        .nodes
        .iter()
        .map(|node| node.id.clone())
        .collect::<Vec<_>>();
    let router = AgentToolRouter::new(initial_tool_registry());
    let accepted = router
        .run(
            "proposal.accept",
            AgentToolInput::PreviewAccept {
                workspace_id: workspace_id.to_string(),
                preview,
                existing_node_ids,
            },
        )
        .map_err(|_| CommandError::Repository)?;

    let AgentToolOutput::AcceptedPreview(accepted) = accepted else {
        return Err(CommandError::Repository);
    };

    for node in &accepted.nodes_to_write {
        runtime.repo.upsert_node(node)?;
    }
    for edge in &accepted.edges_to_write {
        runtime.repo.upsert_edge(
            &edge.id,
            &edge.workspace_id,
            &edge.source_id,
            &edge.target_id,
            edge.kind,
        )?;
    }
    for memory in &accepted.memory_to_write {
        runtime
            .repo
            .accept_memory_proposal(&accepted.workspace_id, memory)?;
    }
    for check_in in &accepted.check_ins_to_write {
        runtime.repo.insert_check_in(check_in)?;
    }
    for experiment in &accepted.strategy_experiments_to_write {
        runtime.repo.record_strategy_experiment(experiment)?;
    }
    runtime
        .repo
        .set_agent_preview_status(preview_id, "accepted")?;
    runtime.repo.upsert_ai_proposal(&preview_proposal_record(
        preview_id,
        AiProposalStatus::Accepted,
    ))?;
    runtime
        .active_previews
        .borrow_mut()
        .retain(|preview| preview.id != preview_id);
    Ok(())
}

pub fn agent_memory_list(
    runtime: &CommandRuntime,
    workspace_id: &str,
) -> Result<Vec<MemoryProposal>, CommandError> {
    Ok(runtime.repo.preference_memory(workspace_id)?)
}

pub fn agent_memory_update(
    runtime: &CommandRuntime,
    workspace_id: &str,
    memory: MemoryProposal,
) -> Result<MemoryProposal, CommandError> {
    runtime.repo.accept_memory_proposal(workspace_id, &memory)?;
    Ok(memory)
}

pub fn agent_memory_delete(
    runtime: &CommandRuntime,
    workspace_id: &str,
    memory_id: &str,
) -> Result<(), CommandError> {
    runtime
        .repo
        .delete_preference_memory(workspace_id, memory_id)?;
    Ok(())
}

pub fn check_in_create(
    runtime: &CommandRuntime,
    workspace_id: &str,
    node_id: Option<&str>,
    body: &str,
) -> Result<CheckIn, CommandError> {
    let review = validate_check_in_text(body);
    if review.status != SafetyStatus::Allowed {
        return Err(CommandError::SafetyBlocked);
    }
    let check_in = CheckIn {
        id: runtime.next_id("check-in"),
        workspace_id: workspace_id.to_string(),
        node_id: node_id.map(ToOwned::to_owned),
        body: body.to_string(),
    };
    runtime.repo.insert_check_in(&check_in)?;
    Ok(check_in)
}

pub fn check_in_list(
    runtime: &CommandRuntime,
    workspace_id: &str,
) -> Result<Vec<CheckIn>, CommandError> {
    Ok(runtime.repo.check_ins(workspace_id)?)
}

pub fn settings_update_llm(
    runtime: &CommandRuntime,
    provider_id: &str,
    api_mode: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
    timeout_seconds: u64,
) -> Result<LlmProviderConfig, CommandError> {
    let provider_id =
        LlmProviderId::from_str(provider_id).ok_or(CommandError::InvalidLlmSettings)?;
    let api_mode = LlmApiMode::from_str(api_mode).ok_or(CommandError::InvalidLlmSettings)?;
    let config = LlmProviderConfig {
        provider_id,
        api_mode,
        base_url: base_url.to_string(),
        api_key: api_key.to_string(),
        model: model.to_string(),
        timeout_seconds,
    };
    config
        .validate()
        .map_err(|_error: LlmConfigError| CommandError::InvalidLlmSettings)?;
    runtime
        .repo
        .upsert_setting("llm.provider_id", config.provider_id.as_str())?;
    runtime
        .repo
        .upsert_setting("llm.api_mode", config.api_mode.as_str())?;
    runtime
        .repo
        .upsert_setting("llm.base_url", &config.base_url)?;
    runtime
        .repo
        .upsert_setting("llm.api_key", &config.api_key)?;
    runtime.repo.upsert_setting("llm.model", &config.model)?;
    runtime
        .repo
        .upsert_setting("llm.timeout_seconds", &config.timeout_seconds.to_string())?;
    Ok(config)
}

pub fn settings_test_llm(
    _runtime: &CommandRuntime,
    provider_id: &str,
    api_mode: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
    timeout_seconds: u64,
) -> Result<LlmProviderTestResult, CommandError> {
    let provider_id =
        LlmProviderId::from_str(provider_id).ok_or(CommandError::InvalidLlmSettings)?;
    let api_mode = LlmApiMode::from_str(api_mode).ok_or(CommandError::InvalidLlmSettings)?;
    let config = LlmProviderConfig {
        provider_id,
        api_mode,
        base_url: base_url.to_string(),
        api_key: api_key.to_string(),
        model: model.to_string(),
        timeout_seconds,
    };
    config
        .validate()
        .map_err(|_error: LlmConfigError| CommandError::InvalidLlmSettings)?;
    let provider = build_llm_provider(config.clone())
        .map_err(|_error: LlmConfigError| CommandError::InvalidLlmSettings)?;

    provider
        .complete_structured(LlmStructuredRequest {
            prompt_version: "settings_test@v1".to_string(),
            system_prompt: "You are testing provider connectivity for MindLattice.".to_string(),
            user_prompt: "Return a compact JSON object confirming that the provider is reachable."
                .to_string(),
            output_schema: r#"{"type":"object","properties":{"ok":{"type":"boolean"}}}"#
                .to_string(),
            timeout_seconds,
        })
        .map_err(command_error_from_llm_error)?;

    Ok(LlmProviderTestResult {
        status: "ok".to_string(),
        model: config.model,
        message: "Connection test succeeded.".to_string(),
    })
}

fn command_error_from_llm_error(_error: LlmError) -> CommandError {
    CommandError::Provider
}

pub fn vault_export(
    runtime: &CommandRuntime,
    workspace_id: &str,
) -> Result<VaultExportResult, CommandError> {
    let snapshot = runtime.repo.map_snapshot(workspace_id)?;
    Ok(export_workspace(
        &snapshot.workspace,
        &snapshot.nodes,
        &snapshot.edges,
    ))
}

pub fn vault_import(
    runtime: &CommandRuntime,
    workspace_id: &str,
    files: Vec<VaultImportFileDto>,
) -> Result<VaultImportResult, CommandError> {
    let imported = import_files(
        workspace_id,
        &files
            .into_iter()
            .map(|file| VaultImportFile {
                filename: file.filename,
                content: file.content,
            })
            .collect::<Vec<_>>(),
    );
    for node in &imported.nodes {
        runtime.repo.upsert_node(node)?;
    }
    for edge in &imported.edges {
        runtime.repo.upsert_edge(
            &edge.id,
            &edge.workspace_id,
            &edge.source_id,
            &edge.target_id,
            edge.kind,
        )?;
    }
    Ok(imported)
}
