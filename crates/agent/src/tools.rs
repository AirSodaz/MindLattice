use crate::memory::retrieve_relevant_preferences;
use crate::skills::AgentSkillSpec;
use mindlattice_core::domain::{
    CheckIn, GraphEdge, GraphNode, MapSnapshot, MemoryProposal, NodeKind,
};
use mindlattice_core::proposals::{validate_agent_preview, validate_memory_proposal, AgentPreview};
use mindlattice_core::safety::{review_text_for_safety, validate_check_in_text, SafetyReview};
use mindlattice_core::start_plan::{generate_start_plan, StartPlan};
use mindlattice_core::strategies::{
    list_support_templates, validate_strategy_experiment, StrategyExperiment, SupportTemplate,
};
use mindlattice_vault::markdown::{import_files, VaultImportFile, VaultImportResult};
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AgentToolContract {
    pub id: &'static str,
    pub input_schema: &'static str,
    pub output_schema: &'static str,
    pub write_capable: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolContractError {
    pub skill_id: String,
    pub tool_id: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum AgentToolInput {
    MemoryRetrieval {
        user_message: String,
        confirmed_memory: Vec<String>,
        limit: usize,
    },
    MemoryProposal(MemoryProposal),
    SafetyReview {
        text: String,
    },
    AgentPreview(AgentPreview),
    StartPlan {
        snapshot: MapSnapshot,
        next_action_id: String,
    },
    MapSummary(MapSnapshot),
    MapProposal(AgentPreview),
    MapRevision(AgentPreview),
    PreviewAccept {
        workspace_id: String,
        preview: AgentPreview,
        existing_node_ids: Vec<String>,
    },
    SupportSearch {
        query: String,
        limit: usize,
    },
    CheckInProposal {
        id: String,
        workspace_id: String,
        node_id: Option<String>,
        body: String,
    },
    StrategyExperimentProposal(StrategyExperiment),
    VaultImportPreview {
        workspace_id: String,
        files: Vec<VaultImportFile>,
    },
}

impl AgentToolInput {
    fn schema(&self) -> &'static str {
        match self {
            Self::MemoryRetrieval { .. } => "memory_retrieval_request",
            Self::MemoryProposal(_) => "memory_proposal_request",
            Self::SafetyReview { .. } => "safety_review_request",
            Self::AgentPreview(_) => "agent_preview",
            Self::StartPlan { .. } => "start_plan_request",
            Self::MapSummary(_) => "map_summary_request",
            Self::MapProposal(_) => "map_proposal_request",
            Self::MapRevision(_) => "preview_revision_request",
            Self::PreviewAccept { .. } => "preview_accept_request",
            Self::SupportSearch { .. } => "support_search_request",
            Self::CheckInProposal { .. } => "check_in_request",
            Self::StrategyExperimentProposal(_) => "strategy_experiment_request",
            Self::VaultImportPreview { .. } => "vault_import_preview_request",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MapSummary {
    pub workspace_id: String,
    pub node_count: usize,
    pub edge_count: usize,
    pub next_action_count: usize,
    pub blocker_count: usize,
    pub focus_titles: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckInPreview {
    pub id: String,
    pub workspace_id: String,
    pub node_id: Option<String>,
    pub body: String,
    pub user_visible_summary: String,
    pub review: SafetyReview,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyExperimentPreview {
    pub experiment: StrategyExperiment,
    pub user_visible_summary: String,
    pub review: SafetyReview,
}

#[derive(Clone, Debug, PartialEq)]
pub struct VaultImportPreview {
    pub nodes_created: usize,
    pub edges_created: usize,
    pub nodes: Vec<mindlattice_core::domain::GraphNode>,
    pub edges: Vec<mindlattice_core::domain::GraphEdge>,
    pub user_visible_summary: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AcceptedPreview {
    pub preview_id: String,
    pub workspace_id: String,
    pub nodes_to_write: Vec<GraphNode>,
    pub edges_to_write: Vec<GraphEdge>,
    pub memory_to_write: Vec<MemoryProposal>,
    pub check_ins_to_write: Vec<CheckIn>,
    pub strategy_experiments_to_write: Vec<StrategyExperiment>,
    pub user_visible_summary: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum AgentToolOutput {
    PreferenceMemoryMatches(Vec<String>),
    MemoryProposal(MemoryProposal),
    MapSummary(MapSummary),
    AgentPreview(AgentPreview),
    AcceptedPreview(AcceptedPreview),
    SafetyReview(SafetyReview),
    StartPlan(StartPlan),
    SupportTemplateMatches(Vec<SupportTemplate>),
    CheckInPreview(CheckInPreview),
    StrategyExperimentPreview(StrategyExperimentPreview),
    VaultImportPreview(VaultImportPreview),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ToolRunError {
    UnknownTool(String),
    InputSchemaMismatch {
        tool_id: String,
        expected_schema: String,
    },
    ToolFailed {
        tool_id: String,
        reason: String,
    },
    UnimplementedTool(String),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentToolRouter {
    registry: Vec<AgentToolContract>,
}

impl AgentToolRouter {
    pub fn new(registry: Vec<AgentToolContract>) -> Self {
        Self { registry }
    }

    pub fn run(
        &self,
        tool_id: &str,
        input: AgentToolInput,
    ) -> Result<AgentToolOutput, ToolRunError> {
        let contract = self
            .registry
            .iter()
            .find(|tool| tool.id == tool_id)
            .ok_or_else(|| ToolRunError::UnknownTool(tool_id.to_string()))?;
        if contract.input_schema != input.schema() {
            return Err(ToolRunError::InputSchemaMismatch {
                tool_id: tool_id.to_string(),
                expected_schema: contract.input_schema.to_string(),
            });
        }

        match (tool_id, input) {
            (
                "memory.retrieve_preferences",
                AgentToolInput::MemoryRetrieval {
                    user_message,
                    confirmed_memory,
                    limit,
                },
            ) => Ok(AgentToolOutput::PreferenceMemoryMatches(
                retrieve_relevant_preferences(&user_message, &confirmed_memory, limit),
            )),
            ("memory.propose_update", AgentToolInput::MemoryProposal(proposal)) => {
                validate_memory_proposal(&proposal)
                    .map(|()| AgentToolOutput::MemoryProposal(proposal))
                    .map_err(|review| ToolRunError::ToolFailed {
                        tool_id: tool_id.to_string(),
                        reason: review.reasons.join("; "),
                    })
            }
            ("safety.review", AgentToolInput::SafetyReview { text }) => {
                Ok(AgentToolOutput::SafetyReview(review_text_for_safety(&text)))
            }
            ("proposal.validate", AgentToolInput::AgentPreview(preview)) => Ok(
                AgentToolOutput::SafetyReview(validate_agent_preview(&preview)),
            ),
            (
                "start_plan.generate",
                AgentToolInput::StartPlan {
                    snapshot,
                    next_action_id,
                },
            ) => generate_start_plan(&snapshot, &next_action_id)
                .map(AgentToolOutput::StartPlan)
                .map_err(|error| ToolRunError::ToolFailed {
                    tool_id: tool_id.to_string(),
                    reason: format!("{error:?}"),
                }),
            ("map.summarize", AgentToolInput::MapSummary(snapshot)) => {
                Ok(AgentToolOutput::MapSummary(summarize_map(snapshot)))
            }
            ("map.propose_nodes_edges", AgentToolInput::MapProposal(preview)) => {
                validate_map_preview_tool_output(tool_id, preview)
            }
            ("map.revise_preview", AgentToolInput::MapRevision(preview)) => {
                validate_map_preview_tool_output(tool_id, preview)
            }
            (
                "proposal.accept",
                AgentToolInput::PreviewAccept {
                    workspace_id,
                    preview,
                    existing_node_ids,
                },
            ) => accept_preview_as_write_plan(tool_id, workspace_id, preview, existing_node_ids),
            ("support.search_templates", AgentToolInput::SupportSearch { query, limit }) => Ok(
                AgentToolOutput::SupportTemplateMatches(search_support_templates(&query, limit)),
            ),
            (
                "check_in.propose",
                AgentToolInput::CheckInProposal {
                    id,
                    workspace_id,
                    node_id,
                    body,
                },
            ) => propose_check_in(id, workspace_id, node_id, body).map_err(|review| {
                ToolRunError::ToolFailed {
                    tool_id: tool_id.to_string(),
                    reason: review.reasons.join("; "),
                }
            }),
            (
                "strategy_experiment.propose",
                AgentToolInput::StrategyExperimentProposal(experiment),
            ) => {
                propose_strategy_experiment(experiment).map_err(|reason| ToolRunError::ToolFailed {
                    tool_id: tool_id.to_string(),
                    reason,
                })
            }
            (
                "vault.preview_import",
                AgentToolInput::VaultImportPreview {
                    workspace_id,
                    files,
                },
            ) => preview_vault_import(workspace_id, files).map_err(|reason| {
                ToolRunError::ToolFailed {
                    tool_id: tool_id.to_string(),
                    reason,
                }
            }),
            _ => Err(ToolRunError::UnimplementedTool(tool_id.to_string())),
        }
    }
}

fn validate_map_preview_tool_output(
    tool_id: &str,
    preview: AgentPreview,
) -> Result<AgentToolOutput, ToolRunError> {
    let review = validate_agent_preview(&preview);
    if review.status != mindlattice_core::safety::SafetyStatus::Allowed {
        return Err(ToolRunError::ToolFailed {
            tool_id: tool_id.to_string(),
            reason: review.reasons.join("; "),
        });
    }

    Ok(AgentToolOutput::AgentPreview(preview))
}

fn accept_preview_as_write_plan(
    tool_id: &str,
    workspace_id: String,
    preview: AgentPreview,
    existing_node_ids: Vec<String>,
) -> Result<AgentToolOutput, ToolRunError> {
    let review = validate_agent_preview(&preview);
    if review.status != mindlattice_core::safety::SafetyStatus::Allowed {
        return Err(ToolRunError::ToolFailed {
            tool_id: tool_id.to_string(),
            reason: review.reasons.join("; "),
        });
    }

    let nodes_to_write = preview
        .proposed_nodes
        .iter()
        .map(|node| GraphNode {
            id: node.id.clone(),
            workspace_id: workspace_id.clone(),
            kind: node.kind,
            title: node.title.clone(),
            body: node.body.clone(),
            metadata: None,
            position: None,
        })
        .collect::<Vec<_>>();
    let node_ids = nodes_to_write
        .iter()
        .map(|node| node.id.as_str())
        .chain(existing_node_ids.iter().map(String::as_str))
        .collect::<HashSet<_>>();
    let missing_edge_endpoint = preview.proposed_edges.iter().any(|edge| {
        !node_ids.contains(edge.source_id.as_str()) || !node_ids.contains(edge.target_id.as_str())
    });
    if missing_edge_endpoint {
        return Err(ToolRunError::ToolFailed {
            tool_id: tool_id.to_string(),
            reason: "Accepted preview contains an edge endpoint that is neither proposed nor already persisted."
                .to_string(),
        });
    }
    let missing_check_in_node = preview.proposed_check_ins.iter().any(|check_in| {
        check_in
            .node_id
            .as_deref()
            .map(|node_id| !node_ids.contains(node_id))
            .unwrap_or(false)
    });
    if missing_check_in_node {
        return Err(ToolRunError::ToolFailed {
            tool_id: tool_id.to_string(),
            reason: "Accepted preview contains a check-in for a node that is neither proposed nor already persisted."
                .to_string(),
        });
    }
    let wrong_check_in_workspace = preview
        .proposed_check_ins
        .iter()
        .any(|check_in| check_in.workspace_id != workspace_id);
    if wrong_check_in_workspace {
        return Err(ToolRunError::ToolFailed {
            tool_id: tool_id.to_string(),
            reason: "Accepted preview contains a check-in for a different workspace.".to_string(),
        });
    }
    let edges_to_write = preview
        .proposed_edges
        .iter()
        .map(|edge| GraphEdge {
            id: edge.id.clone(),
            workspace_id: workspace_id.clone(),
            source_id: edge.source_id.clone(),
            target_id: edge.target_id.clone(),
            kind: edge.kind,
        })
        .collect::<Vec<_>>();
    let memory_to_write = preview.proposed_memory.clone();
    let check_ins_to_write = preview.proposed_check_ins.clone();
    let strategy_experiments_to_write = preview.proposed_strategy_experiments.clone();

    Ok(AgentToolOutput::AcceptedPreview(AcceptedPreview {
        preview_id: preview.id,
        workspace_id,
        user_visible_summary: accepted_preview_summary(
            nodes_to_write.len(),
            edges_to_write.len(),
            memory_to_write.len(),
            check_ins_to_write.len(),
            strategy_experiments_to_write.len(),
        ),
        nodes_to_write,
        edges_to_write,
        memory_to_write,
        check_ins_to_write,
        strategy_experiments_to_write,
    }))
}

fn accepted_preview_summary(
    node_count: usize,
    edge_count: usize,
    memory_count: usize,
    check_in_count: usize,
    strategy_experiment_count: usize,
) -> String {
    format!(
        "Accepted preview write plan: {node_count} {}, {edge_count} {}, {memory_count} {}, {check_in_count} {}, and {strategy_experiment_count} {}.",
        plural("node", node_count),
        plural("edge", edge_count),
        plural("memory update", memory_count),
        plural("check-in", check_in_count),
        plural("strategy experiment", strategy_experiment_count)
    )
}

fn plural(label: &str, count: usize) -> String {
    if count == 1 {
        label.to_string()
    } else {
        format!("{label}s")
    }
}

fn summarize_map(snapshot: MapSnapshot) -> MapSummary {
    let next_action_count = snapshot
        .nodes
        .iter()
        .filter(|node| node.kind == NodeKind::NextAction)
        .count();
    let blocker_count = snapshot
        .nodes
        .iter()
        .filter(|node| node.kind == NodeKind::Blocker)
        .count();
    let focus_titles = snapshot
        .nodes
        .iter()
        .filter(|node| matches!(node.kind, NodeKind::Task | NodeKind::NextAction))
        .map(|node| node.title.clone())
        .collect::<Vec<_>>();

    MapSummary {
        workspace_id: snapshot.workspace.id,
        node_count: snapshot.nodes.len(),
        edge_count: snapshot.edges.len(),
        next_action_count,
        blocker_count,
        focus_titles,
    }
}

fn propose_check_in(
    id: String,
    workspace_id: String,
    node_id: Option<String>,
    body: String,
) -> Result<AgentToolOutput, SafetyReview> {
    let review = validate_check_in_text(&body);
    if review.status != mindlattice_core::safety::SafetyStatus::Allowed {
        return Err(review);
    }

    Ok(AgentToolOutput::CheckInPreview(CheckInPreview {
        id,
        workspace_id,
        node_id,
        body,
        user_visible_summary: "Check-in preview ready for review before saving.".to_string(),
        review,
    }))
}

fn propose_strategy_experiment(experiment: StrategyExperiment) -> Result<AgentToolOutput, String> {
    validate_strategy_experiment(&experiment).map_err(|error| format!("{error:?}"))?;
    Ok(AgentToolOutput::StrategyExperimentPreview(
        StrategyExperimentPreview {
            experiment,
            user_visible_summary: "Strategy experiment preview ready for review before saving."
                .to_string(),
            review: SafetyReview::allowed(),
        },
    ))
}

fn preview_vault_import(
    workspace_id: String,
    files: Vec<VaultImportFile>,
) -> Result<AgentToolOutput, String> {
    if files.is_empty() {
        return Err("Vault import preview requires at least one Markdown file.".to_string());
    }

    let file_count = files.len();
    let imported = import_files(&workspace_id, &files);
    Ok(AgentToolOutput::VaultImportPreview(
        VaultImportPreview::from_result(imported, file_count),
    ))
}

impl VaultImportPreview {
    fn from_result(result: VaultImportResult, file_count: usize) -> Self {
        Self {
            nodes_created: result.nodes_created,
            edges_created: result.edges_created,
            nodes: result.nodes,
            edges: result.edges,
            user_visible_summary: format!(
                "Vault import preview ready for review: {file_count} Markdown files, {} nodes, {} edges.",
                result.nodes_created, result.edges_created
            ),
        }
    }
}

fn search_support_templates(query: &str, limit: usize) -> Vec<SupportTemplate> {
    if limit == 0 {
        return Vec::new();
    }

    let query_terms = normalized_terms(query);
    let mut scored = list_support_templates()
        .into_iter()
        .enumerate()
        .filter_map(|(index, template)| {
            let text = [
                template.title.as_str(),
                template.category.as_str(),
                &template.default_contexts.join(" "),
                &template.steps.join(" "),
            ]
            .join(" ");
            let terms = normalized_terms(&text);
            let score = terms.intersection(&query_terms).count();
            (score > 0).then_some((score, index, template))
        })
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
    scored
        .into_iter()
        .take(limit)
        .map(|(_, _, template)| template)
        .collect()
}

fn normalized_terms(text: &str) -> HashSet<String> {
    text.split(|character: char| !character.is_alphanumeric())
        .filter_map(|term| {
            let normalized = term.trim().to_lowercase();
            (normalized.len() >= 4 || normalized == "cue").then_some(match normalized.as_str() {
                "interruptions" | "interrupted" => "interruption".to_string(),
                "returning" | "returned" | "reopening" => "return".to_string(),
                _ => normalized,
            })
        })
        .collect()
}

pub fn initial_tool_registry() -> Vec<AgentToolContract> {
    vec![
        tool("map.summarize", "map_summary_request", "map_summary", false),
        tool(
            "map.propose_nodes_edges",
            "map_proposal_request",
            "agent_preview",
            true,
        ),
        tool(
            "map.revise_preview",
            "preview_revision_request",
            "agent_preview",
            true,
        ),
        tool("proposal.validate", "agent_preview", "safety_review", false),
        tool(
            "proposal.accept",
            "preview_accept_request",
            "accepted_preview",
            true,
        ),
        tool(
            "support.search_templates",
            "support_search_request",
            "support_template_matches",
            false,
        ),
        tool(
            "start_plan.generate",
            "start_plan_request",
            "start_plan",
            false,
        ),
        tool(
            "check_in.propose",
            "check_in_request",
            "check_in_preview",
            true,
        ),
        tool(
            "strategy_experiment.propose",
            "strategy_experiment_request",
            "strategy_experiment_preview",
            true,
        ),
        tool(
            "memory.retrieve_preferences",
            "memory_retrieval_request",
            "preference_memory_matches",
            false,
        ),
        tool(
            "memory.propose_update",
            "memory_proposal_request",
            "memory_proposal",
            true,
        ),
        tool(
            "safety.review",
            "safety_review_request",
            "safety_review",
            false,
        ),
        tool(
            "vault.preview_import",
            "vault_import_preview_request",
            "vault_import_preview",
            false,
        ),
    ]
}

pub fn validate_skill_tool_contracts(
    skills: &[AgentSkillSpec],
    tools: &[AgentToolContract],
) -> Result<(), ToolContractError> {
    for skill in skills {
        for allowed_tool in &skill.allowed_tools {
            if !tools.iter().any(|tool| tool.id == allowed_tool) {
                return Err(ToolContractError {
                    skill_id: skill.id.clone(),
                    tool_id: allowed_tool.clone(),
                });
            }
        }
    }
    Ok(())
}

fn tool(
    id: &'static str,
    input_schema: &'static str,
    output_schema: &'static str,
    write_capable: bool,
) -> AgentToolContract {
    AgentToolContract {
        id,
        input_schema,
        output_schema,
        write_capable,
    }
}
