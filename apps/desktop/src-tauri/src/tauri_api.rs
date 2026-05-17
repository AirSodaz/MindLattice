use std::sync::{Arc, LockResult, Mutex, MutexGuard};

use mindlattice_agent::loop_state::{AgentTurnResponse, AgentTurnResponseKind};
use mindlattice_ai::provider::LlmProviderConfig;
use mindlattice_core::domain::{
    AttentionSession, CheckIn, ContextProfile, EdgeKind, GraphEdge, GraphNode, MapSnapshot,
    MemoryProposal, NodeKind, Workspace,
};
use mindlattice_core::proposals::{AgentPreview, ProposedEdge, ProposedNode};
use mindlattice_core::start_plan::{StartCheck, StartPlan};
use mindlattice_core::strategies::{
    ExperimentContext, StrategyCard, StrategyDecision, StrategyExperiment, SupportCategory,
    SupportTemplate,
};
use mindlattice_vault::markdown::{VaultExportFile, VaultExportResult, VaultImportResult};
use serde::{Deserialize, Serialize};
use tauri::{Manager, Runtime};

use crate::commands::{
    self, CommandError, CommandRuntime, LlmProviderTestResult, VaultImportFileDto,
};

pub const REGISTERED_COMMAND_NAMES: &[&str] = &[
    "workspace_open_default",
    "map_get",
    "node_create",
    "node_move",
    "node_update",
    "edge_create",
    "edge_delete",
    "start_plan_get",
    "support_templates_list",
    "support_adopt",
    "support_discard",
    "strategy_cards_list",
    "strategy_experiment_create",
    "attention_session_start",
    "attention_session_close",
    "context_profile_get",
    "context_profile_update",
    "agent_turn_submit",
    "agent_preview_get",
    "agent_preview_accept",
    "agent_preview_reject",
    "agent_preview_revise",
    "agent_memory_list",
    "agent_memory_update",
    "agent_memory_delete",
    "vault_import",
    "vault_export",
    "check_in_create",
    "check_in_list",
    "settings_test_llm",
    "settings_update_llm",
];

pub fn registered_command_names() -> &'static [&'static str] {
    REGISTERED_COMMAND_NAMES
}

#[derive(Clone)]
pub struct SharedCommandRuntime {
    inner: Arc<Mutex<CommandRuntime>>,
}

impl SharedCommandRuntime {
    pub fn in_memory() -> Result<Self, CommandErrorDto> {
        Ok(Self {
            inner: Arc::new(Mutex::new(CommandRuntime::in_memory()?)),
        })
    }

    pub fn open_app_data<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Self, CommandErrorDto> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|_| CommandError::Repository)?;
        std::fs::create_dir_all(&app_data_dir).map_err(|_| CommandError::Repository)?;
        let db_path = app_data_dir.join("mindlattice.sqlite3");
        Ok(Self {
            inner: Arc::new(Mutex::new(CommandRuntime::open_file(db_path)?)),
        })
    }

    pub fn lock(&self) -> LockResult<MutexGuard<'_, CommandRuntime>> {
        self.inner.lock()
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorDto {
    pub code: String,
    pub message: String,
}

impl From<CommandError> for CommandErrorDto {
    fn from(value: CommandError) -> Self {
        let code = match &value {
            CommandError::Repository => "repository",
            CommandError::MissingLlmProviderSettings => "missing_llm_provider_settings",
            CommandError::ToolBudgetExhausted => "tool_budget_exhausted",
            CommandError::TimeoutBudgetExhausted => "timeout_budget_exhausted",
            CommandError::Provider => "provider",
            CommandError::SafetyBlocked => "safety_blocked",
            CommandError::Prompt => "prompt",
            CommandError::NodeNotFound(_) => "node_not_found",
            CommandError::EdgeNotFound(_) => "edge_not_found",
            CommandError::NodeIsNotNextAction(_) => "node_is_not_next_action",
            CommandError::AttentionSessionNotFound(_) => "attention_session_not_found",
            CommandError::PreviewNotFound(_) => "preview_not_found",
            CommandError::InvalidLlmSettings => "invalid_llm_settings",
            CommandError::InvalidCommandInput => "invalid_command_input",
        };
        Self {
            code: code.to_string(),
            message: format!("{value:?}"),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandWorkspaceDto {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandNodeMetadataDto {
    pub minimum_done: Option<String>,
    pub estimated_minutes: Option<u16>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandNodePositionDto {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandNodeDto {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub metadata: Option<CommandNodeMetadataDto>,
    pub position: Option<CommandNodePositionDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEdgeDto {
    pub id: String,
    pub workspace_id: String,
    pub source_id: String,
    pub target_id: String,
    pub kind: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandMapSnapshotDto {
    pub workspace: CommandWorkspaceDto,
    pub nodes: Vec<CommandNodeDto>,
    pub edges: Vec<CommandEdgeDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandProposedNodeDto {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandProposedEdgeDto {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandPreviewDto {
    pub id: String,
    pub proposed_nodes: Vec<CommandProposedNodeDto>,
    pub proposed_edges: Vec<CommandProposedEdgeDto>,
    pub proposed_memory: Vec<CommandMemoryDto>,
    pub proposed_check_ins: Vec<CommandCheckInDto>,
    pub proposed_strategy_experiments: Vec<CommandStrategyExperimentDto>,
    pub user_visible_summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandAgentResponseDto {
    pub kind: String,
    pub message: String,
    pub preview: Option<CommandPreviewDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandStartCheckDto {
    pub needed_materials: Vec<String>,
    pub current_distraction: Option<String>,
    pub five_minute_fit: bool,
    pub reopen_target: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandStartPlanDto {
    pub selected_next_action: CommandNodeDto,
    pub parent_task: Option<CommandNodeDto>,
    pub support_items: Vec<CommandNodeDto>,
    pub environmental_adjustment: Option<CommandNodeDto>,
    pub current_blocker: Option<CommandNodeDto>,
    pub minimum_done: Option<String>,
    pub estimate_minutes: Option<u16>,
    pub return_cue: String,
    pub start_check: CommandStartCheckDto,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandAttentionSessionDto {
    pub id: String,
    pub start_plan_id: Option<String>,
    pub next_action_id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub intended_duration_minutes: Option<u16>,
    pub state: String,
    pub completion_note: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSupportTemplateDto {
    pub id: String,
    pub category: String,
    pub title: String,
    pub steps: Vec<String>,
    pub default_contexts: Vec<String>,
    pub source_note: String,
    pub safety_note: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandStrategyCardDto {
    pub id: String,
    pub title: String,
    pub when_to_use: String,
    pub steps: Vec<String>,
    pub source_note: String,
    pub safety_note: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandStrategyExperimentDto {
    pub id: String,
    pub support_template_id: Option<String>,
    pub custom_support_title: Option<String>,
    pub context: String,
    pub helped_start: bool,
    pub helped_continue: bool,
    pub helped_return: bool,
    pub helped_clarify_next_action: bool,
    pub obstacle_note: Option<String>,
    pub next_decision: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandContextProfileDto {
    pub id: String,
    pub workspace_id: String,
    pub adult_contexts: Vec<String>,
    pub execution_difficulties: Vec<String>,
    pub preferred_support_categories: Vec<String>,
    pub llm_provider_setup_state: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandMemoryDto {
    pub id: String,
    pub proposed_memory_text: String,
    pub evidence_reference: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandCheckInDto {
    pub id: String,
    pub workspace_id: String,
    pub node_id: Option<String>,
    pub body: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandLlmSettingsDto {
    pub provider_id: String,
    pub api_mode: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout_seconds: u64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandLlmTestResultDto {
    pub status: String,
    pub model: String,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandVaultFileDto {
    pub filename: String,
    pub content: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandVaultExportDto {
    pub files: Vec<CommandVaultFileDto>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandVaultImportDto {
    pub nodes_created: usize,
    pub edges_created: usize,
    pub nodes: Vec<CommandNodeDto>,
    pub edges: Vec<CommandEdgeDto>,
}

pub fn workspace_open_default(
    runtime: SharedCommandRuntime,
) -> Result<CommandWorkspaceDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::workspace_open_default(&runtime)
        .map(CommandWorkspaceDto::from)
        .map_err(Into::into)
}

pub fn map_get(
    runtime: SharedCommandRuntime,
    workspace_id: String,
) -> Result<CommandMapSnapshotDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::map_get(&runtime, &workspace_id)
        .map(CommandMapSnapshotDto::from)
        .map_err(Into::into)
}

pub fn node_create(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    kind: NodeKind,
    title: String,
) -> Result<CommandNodeDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::node_create(&runtime, &workspace_id, kind, &title)
        .map(CommandNodeDto::from)
        .map_err(Into::into)
}

pub fn node_update(
    runtime: SharedCommandRuntime,
    node_id: String,
    kind: NodeKind,
    title: String,
    body: Option<String>,
) -> Result<CommandNodeDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::node_update(&runtime, &node_id, kind, &title, body.as_deref())
        .map(CommandNodeDto::from)
        .map_err(Into::into)
}

pub fn node_move(
    runtime: SharedCommandRuntime,
    node_id: String,
    x: f64,
    y: f64,
) -> Result<CommandNodeDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::node_move(&runtime, &node_id, x, y)
        .map(CommandNodeDto::from)
        .map_err(Into::into)
}

pub fn edge_create(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    source_id: String,
    target_id: String,
    kind: EdgeKind,
) -> Result<CommandEdgeDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::edge_create(&runtime, &workspace_id, &source_id, &target_id, kind)
        .map(CommandEdgeDto::from)
        .map_err(Into::into)
}

pub fn edge_delete(runtime: SharedCommandRuntime, edge_id: String) -> Result<(), CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::edge_delete(&runtime, &edge_id).map_err(Into::into)
}

pub fn support_templates_list(
    runtime: SharedCommandRuntime,
) -> Result<Vec<CommandSupportTemplateDto>, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::support_templates_list(&runtime)
        .map(|templates| {
            templates
                .into_iter()
                .map(CommandSupportTemplateDto::from)
                .collect()
        })
        .map_err(Into::into)
}

pub fn support_adopt(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    template_id: String,
) -> Result<CommandNodeDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::support_adopt(&runtime, &workspace_id, &template_id)
        .map(CommandNodeDto::from)
        .map_err(Into::into)
}

pub fn support_discard(
    runtime: SharedCommandRuntime,
    support_node_id: String,
) -> Result<(), CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::support_discard(&runtime, &support_node_id).map_err(Into::into)
}

pub fn strategy_cards_list(
    runtime: SharedCommandRuntime,
) -> Result<Vec<CommandStrategyCardDto>, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::strategy_cards_list(&runtime)
        .map(|cards| {
            cards
                .into_iter()
                .map(CommandStrategyCardDto::from)
                .collect()
        })
        .map_err(Into::into)
}

pub fn strategy_experiment_create(
    runtime: SharedCommandRuntime,
    experiment: StrategyExperiment,
) -> Result<CommandStrategyExperimentDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::strategy_experiment_create(&runtime, experiment)
        .map(CommandStrategyExperimentDto::from)
        .map_err(Into::into)
}

pub fn attention_session_start(
    runtime: SharedCommandRuntime,
    next_action_id: String,
    intended_duration_minutes: u16,
    started_at: String,
) -> Result<CommandAttentionSessionDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::attention_session_start(
        &runtime,
        &next_action_id,
        intended_duration_minutes,
        &started_at,
    )
    .map(CommandAttentionSessionDto::from)
    .map_err(Into::into)
}

pub fn context_profile_get(
    runtime: SharedCommandRuntime,
    workspace_id: String,
) -> Result<CommandContextProfileDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::context_profile_get(&runtime, &workspace_id)
        .map(CommandContextProfileDto::from)
        .map_err(Into::into)
}

pub fn context_profile_update(
    runtime: SharedCommandRuntime,
    profile: ContextProfile,
) -> Result<CommandContextProfileDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::context_profile_update(&runtime, profile)
        .map(CommandContextProfileDto::from)
        .map_err(Into::into)
}

pub fn agent_turn_submit(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    selected_node_id: Option<String>,
    message: String,
) -> Result<CommandAgentResponseDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_turn_submit(
        &runtime,
        &workspace_id,
        selected_node_id.as_deref(),
        &message,
    )
    .map(CommandAgentResponseDto::from)
    .map_err(Into::into)
}

pub fn agent_preview_get(
    runtime: SharedCommandRuntime,
    preview_id: String,
) -> Result<Option<CommandPreviewDto>, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_preview_get(&runtime, &preview_id)
        .map(|preview| preview.map(CommandPreviewDto::from))
        .map_err(Into::into)
}

pub fn agent_preview_accept(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    preview_id: String,
) -> Result<(), CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_preview_accept(&runtime, &workspace_id, &preview_id).map_err(Into::into)
}

pub fn agent_preview_reject(
    runtime: SharedCommandRuntime,
    preview_id: String,
) -> Result<(), CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_preview_reject(&runtime, &preview_id).map_err(Into::into)
}

pub fn agent_preview_revise(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    preview_id: String,
    message: String,
) -> Result<CommandAgentResponseDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_preview_revise(&runtime, &workspace_id, &preview_id, &message)
        .map(CommandAgentResponseDto::from)
        .map_err(Into::into)
}

pub fn start_plan_get(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    next_action_id: String,
) -> Result<CommandStartPlanDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::start_plan_get(&runtime, &workspace_id, &next_action_id)
        .map(CommandStartPlanDto::from)
        .map_err(Into::into)
}

pub fn attention_session_close(
    runtime: SharedCommandRuntime,
    session_id: String,
    ended_at: String,
    completion_note: Option<String>,
) -> Result<CommandAttentionSessionDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::attention_session_close(&runtime, &session_id, &ended_at, completion_note.as_deref())
        .map(CommandAttentionSessionDto::from)
        .map_err(Into::into)
}

pub fn vault_export(
    runtime: SharedCommandRuntime,
    workspace_id: String,
) -> Result<CommandVaultExportDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::vault_export(&runtime, &workspace_id)
        .map(CommandVaultExportDto::from)
        .map_err(Into::into)
}

pub fn vault_import(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    files: Vec<CommandVaultFileDto>,
) -> Result<CommandVaultImportDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::vault_import(
        &runtime,
        &workspace_id,
        files
            .into_iter()
            .map(|file| VaultImportFileDto {
                filename: file.filename,
                content: file.content,
            })
            .collect(),
    )
    .map(CommandVaultImportDto::from)
    .map_err(Into::into)
}

pub fn agent_memory_list(
    runtime: SharedCommandRuntime,
    workspace_id: String,
) -> Result<Vec<CommandMemoryDto>, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_memory_list(&runtime, &workspace_id)
        .map(|memory| memory.into_iter().map(CommandMemoryDto::from).collect())
        .map_err(Into::into)
}

pub fn agent_memory_update(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    memory: MemoryProposal,
) -> Result<CommandMemoryDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_memory_update(&runtime, &workspace_id, memory)
        .map(CommandMemoryDto::from)
        .map_err(Into::into)
}

pub fn agent_memory_delete(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    memory_id: String,
) -> Result<(), CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::agent_memory_delete(&runtime, &workspace_id, &memory_id).map_err(Into::into)
}

pub fn check_in_create(
    runtime: SharedCommandRuntime,
    workspace_id: String,
    node_id: Option<String>,
    body: String,
) -> Result<CommandCheckInDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::check_in_create(&runtime, &workspace_id, node_id.as_deref(), &body)
        .map(CommandCheckInDto::from)
        .map_err(Into::into)
}

pub fn check_in_list(
    runtime: SharedCommandRuntime,
    workspace_id: String,
) -> Result<Vec<CommandCheckInDto>, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::check_in_list(&runtime, &workspace_id)
        .map(|check_ins| check_ins.into_iter().map(CommandCheckInDto::from).collect())
        .map_err(Into::into)
}

pub fn settings_update_llm(
    runtime: SharedCommandRuntime,
    provider_id: String,
    api_mode: String,
    base_url: String,
    api_key: String,
    model: String,
    timeout_seconds: u64,
) -> Result<CommandLlmSettingsDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::settings_update_llm(
        &runtime,
        &provider_id,
        &api_mode,
        &base_url,
        &api_key,
        &model,
        timeout_seconds,
    )
        .map(CommandLlmSettingsDto::from)
        .map_err(Into::into)
}

pub fn settings_test_llm(
    runtime: SharedCommandRuntime,
    provider_id: String,
    api_mode: String,
    base_url: String,
    api_key: String,
    model: String,
    timeout_seconds: u64,
) -> Result<CommandLlmTestResultDto, CommandErrorDto> {
    let runtime = runtime.lock().map_err(|_| CommandError::Repository)?;
    commands::settings_test_llm(
        &runtime,
        &provider_id,
        &api_mode,
        &base_url,
        &api_key,
        &model,
        timeout_seconds,
    )
        .map(CommandLlmTestResultDto::from)
        .map_err(Into::into)
}

impl From<Workspace> for CommandWorkspaceDto {
    fn from(value: Workspace) -> Self {
        Self {
            id: value.id,
            title: value.title,
        }
    }
}

impl From<MapSnapshot> for CommandMapSnapshotDto {
    fn from(value: MapSnapshot) -> Self {
        Self {
            workspace: value.workspace.into(),
            nodes: value.nodes.into_iter().map(CommandNodeDto::from).collect(),
            edges: value.edges.into_iter().map(CommandEdgeDto::from).collect(),
        }
    }
}

impl From<GraphNode> for CommandNodeDto {
    fn from(value: GraphNode) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            kind: node_kind_to_string(value.kind),
            title: value.title,
            body: value.body,
            metadata: value.metadata.map(|metadata| CommandNodeMetadataDto {
                minimum_done: metadata.minimum_done,
                estimated_minutes: metadata.estimated_minutes,
            }),
            position: value.position.map(|position| CommandNodePositionDto {
                x: position.x,
                y: position.y,
            }),
        }
    }
}

impl From<GraphEdge> for CommandEdgeDto {
    fn from(value: GraphEdge) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            source_id: value.source_id,
            target_id: value.target_id,
            kind: edge_kind_to_string(value.kind),
        }
    }
}

impl From<AgentTurnResponse> for CommandAgentResponseDto {
    fn from(value: AgentTurnResponse) -> Self {
        Self {
            kind: match value.kind {
                AgentTurnResponseKind::PreviewProposed => "PreviewProposed",
                AgentTurnResponseKind::ShortAnswer => "ShortAnswer",
                AgentTurnResponseKind::Recovery => "Recovery",
            }
            .to_string(),
            message: value.message,
            preview: value.preview.map(CommandPreviewDto::from),
        }
    }
}

impl From<AgentPreview> for CommandPreviewDto {
    fn from(value: AgentPreview) -> Self {
        Self {
            id: value.id,
            proposed_nodes: value
                .proposed_nodes
                .into_iter()
                .map(CommandProposedNodeDto::from)
                .collect(),
            proposed_edges: value
                .proposed_edges
                .into_iter()
                .map(CommandProposedEdgeDto::from)
                .collect(),
            proposed_memory: value
                .proposed_memory
                .into_iter()
                .map(CommandMemoryDto::from)
                .collect(),
            proposed_check_ins: value
                .proposed_check_ins
                .into_iter()
                .map(CommandCheckInDto::from)
                .collect(),
            proposed_strategy_experiments: value
                .proposed_strategy_experiments
                .into_iter()
                .map(CommandStrategyExperimentDto::from)
                .collect(),
            user_visible_summary: value.user_visible_summary,
        }
    }
}

impl From<StartPlan> for CommandStartPlanDto {
    fn from(value: StartPlan) -> Self {
        Self {
            selected_next_action: value.selected_next_action.into(),
            parent_task: value.parent_task.map(CommandNodeDto::from),
            support_items: value
                .support_items
                .into_iter()
                .map(CommandNodeDto::from)
                .collect(),
            environmental_adjustment: value.environmental_adjustment.map(CommandNodeDto::from),
            current_blocker: value.current_blocker.map(CommandNodeDto::from),
            minimum_done: value.minimum_done,
            estimate_minutes: value.estimate_minutes,
            return_cue: value.return_cue,
            start_check: value.start_check.into(),
        }
    }
}

impl From<StartCheck> for CommandStartCheckDto {
    fn from(value: StartCheck) -> Self {
        Self {
            needed_materials: value.needed_materials,
            current_distraction: value.current_distraction,
            five_minute_fit: value.five_minute_fit,
            reopen_target: value.reopen_target,
        }
    }
}

impl From<AttentionSession> for CommandAttentionSessionDto {
    fn from(value: AttentionSession) -> Self {
        Self {
            id: value.id,
            start_plan_id: value.start_plan_id,
            next_action_id: value.next_action_id,
            started_at: value.started_at,
            ended_at: value.ended_at,
            intended_duration_minutes: value.intended_duration_minutes,
            state: value.state.as_str().to_string(),
            completion_note: value.completion_note,
        }
    }
}

impl From<SupportTemplate> for CommandSupportTemplateDto {
    fn from(value: SupportTemplate) -> Self {
        Self {
            id: value.id,
            category: value.category.as_str().to_string(),
            title: value.title,
            steps: value.steps,
            default_contexts: value.default_contexts,
            source_note: value.source_note,
            safety_note: value.safety_note,
        }
    }
}

impl From<StrategyCard> for CommandStrategyCardDto {
    fn from(value: StrategyCard) -> Self {
        Self {
            id: value.id,
            title: value.title,
            when_to_use: value.when_to_use,
            steps: value.steps,
            source_note: value.source_note,
            safety_note: value.safety_note,
        }
    }
}

impl From<StrategyExperiment> for CommandStrategyExperimentDto {
    fn from(value: StrategyExperiment) -> Self {
        Self {
            id: value.id,
            support_template_id: value.support_template_id,
            custom_support_title: value.custom_support_title,
            context: value.context.as_str().to_string(),
            helped_start: value.helped_start,
            helped_continue: value.helped_continue,
            helped_return: value.helped_return,
            helped_clarify_next_action: value.helped_clarify_next_action,
            obstacle_note: value.obstacle_note,
            next_decision: value.next_decision.as_str().to_string(),
        }
    }
}

impl From<ContextProfile> for CommandContextProfileDto {
    fn from(value: ContextProfile) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            adult_contexts: value.adult_contexts,
            execution_difficulties: value.execution_difficulties,
            preferred_support_categories: value
                .preferred_support_categories
                .into_iter()
                .map(|category| category.as_str().to_string())
                .collect(),
            llm_provider_setup_state: value.llm_provider_setup_state,
        }
    }
}

impl From<MemoryProposal> for CommandMemoryDto {
    fn from(value: MemoryProposal) -> Self {
        Self {
            id: value.id,
            proposed_memory_text: value.proposed_memory_text,
            evidence_reference: value.evidence_reference,
        }
    }
}

impl From<CheckIn> for CommandCheckInDto {
    fn from(value: CheckIn) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            node_id: value.node_id,
            body: value.body,
        }
    }
}

impl From<LlmProviderConfig> for CommandLlmSettingsDto {
    fn from(value: LlmProviderConfig) -> Self {
        Self {
            provider_id: value.provider_id.as_str().to_string(),
            api_mode: value.api_mode.as_str().to_string(),
            base_url: value.base_url,
            api_key: value.api_key,
            model: value.model,
            timeout_seconds: value.timeout_seconds,
        }
    }
}

impl From<LlmProviderTestResult> for CommandLlmTestResultDto {
    fn from(value: LlmProviderTestResult) -> Self {
        Self {
            status: value.status,
            model: value.model,
            message: value.message,
        }
    }
}

impl From<VaultExportResult> for CommandVaultExportDto {
    fn from(value: VaultExportResult) -> Self {
        Self {
            files: value
                .files
                .into_iter()
                .map(CommandVaultFileDto::from)
                .collect(),
        }
    }
}

impl From<VaultExportFile> for CommandVaultFileDto {
    fn from(value: VaultExportFile) -> Self {
        Self {
            filename: value.filename,
            content: value.content,
        }
    }
}

impl From<VaultImportResult> for CommandVaultImportDto {
    fn from(value: VaultImportResult) -> Self {
        Self {
            nodes_created: value.nodes_created,
            edges_created: value.edges_created,
            nodes: value.nodes.into_iter().map(CommandNodeDto::from).collect(),
            edges: value.edges.into_iter().map(CommandEdgeDto::from).collect(),
        }
    }
}

impl From<ProposedNode> for CommandProposedNodeDto {
    fn from(value: ProposedNode) -> Self {
        Self {
            id: value.id,
            kind: node_kind_to_string(value.kind),
            title: value.title,
            body: value.body,
        }
    }
}

impl From<ProposedEdge> for CommandProposedEdgeDto {
    fn from(value: ProposedEdge) -> Self {
        Self {
            id: value.id,
            source_id: value.source_id,
            target_id: value.target_id,
            kind: edge_kind_to_string(value.kind),
        }
    }
}

impl From<MemoryProposal> for CommandProposedNodeDto {
    fn from(value: MemoryProposal) -> Self {
        Self {
            id: value.id,
            kind: "preference_memory".to_string(),
            title: value.proposed_memory_text,
            body: value.evidence_reference,
        }
    }
}

fn node_kind_to_string(kind: NodeKind) -> String {
    kind.as_str().to_string()
}

fn edge_kind_to_string(kind: EdgeKind) -> String {
    kind.as_str().to_string()
}

pub fn node_kind_from_string(value: &str) -> Result<NodeKind, CommandErrorDto> {
    NodeKind::from_str(value).ok_or_else(|| CommandError::InvalidCommandInput.into())
}

pub fn edge_kind_from_string(value: &str) -> Result<EdgeKind, CommandErrorDto> {
    EdgeKind::from_str(value).ok_or_else(|| CommandError::InvalidCommandInput.into())
}

pub fn strategy_experiment_from_dto(
    value: CommandStrategyExperimentDto,
) -> Result<StrategyExperiment, CommandErrorDto> {
    Ok(StrategyExperiment {
        id: value.id,
        support_template_id: value.support_template_id,
        custom_support_title: value.custom_support_title,
        context: ExperimentContext::from_str(&value.context)
            .ok_or(CommandError::InvalidCommandInput)?,
        helped_start: value.helped_start,
        helped_continue: value.helped_continue,
        helped_return: value.helped_return,
        helped_clarify_next_action: value.helped_clarify_next_action,
        obstacle_note: value.obstacle_note,
        next_decision: StrategyDecision::from_str(&value.next_decision)
            .ok_or(CommandError::InvalidCommandInput)?,
    })
}

pub fn context_profile_from_dto(
    value: CommandContextProfileDto,
) -> Result<ContextProfile, CommandErrorDto> {
    Ok(ContextProfile {
        id: value.id,
        workspace_id: value.workspace_id,
        adult_contexts: value.adult_contexts,
        execution_difficulties: value.execution_difficulties,
        preferred_support_categories: value
            .preferred_support_categories
            .into_iter()
            .map(|category| {
                SupportCategory::from_str(&category).ok_or(CommandError::InvalidCommandInput)
            })
            .collect::<Result<Vec<_>, _>>()?,
        llm_provider_setup_state: value.llm_provider_setup_state,
    })
}

pub fn memory_from_dto(value: CommandMemoryDto) -> MemoryProposal {
    MemoryProposal {
        id: value.id,
        proposed_memory_text: value.proposed_memory_text,
        evidence_reference: value.evidence_reference,
    }
}
