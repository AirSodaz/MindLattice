use crate::tauri_api::{
    self, CommandAgentResponseDto, CommandAppSettingsDto, CommandAttentionSessionDto,
    CommandCheckInDto, CommandContextProfileDto, CommandEdgeDto, CommandErrorDto,
    CommandLlmSettingsDto, CommandLlmTestResultDto, CommandMapSnapshotDto, CommandMemoryDto,
    CommandNodeDto, CommandPreviewDto, CommandStartPlanDto, CommandStrategyCardDto,
    CommandStrategyExperimentDto, CommandSupportTemplateDto, CommandVaultExportDto,
    CommandVaultFileDto, CommandVaultImportDto, CommandWorkspaceDto, SharedCommandRuntime,
};

#[tauri::command]
pub fn workspace_open_default(
    runtime: tauri::State<'_, SharedCommandRuntime>,
) -> Result<CommandWorkspaceDto, CommandErrorDto> {
    tauri_api::workspace_open_default(runtime.inner().clone())
}

#[tauri::command]
pub fn map_get(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
) -> Result<CommandMapSnapshotDto, CommandErrorDto> {
    tauri_api::map_get(runtime.inner().clone(), workspace_id)
}

#[tauri::command]
pub fn node_create(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    kind: String,
    title: String,
) -> Result<CommandNodeDto, CommandErrorDto> {
    let kind = tauri_api::node_kind_from_string(&kind)?;
    tauri_api::node_create(runtime.inner().clone(), workspace_id, kind, title)
}

#[tauri::command]
pub fn node_update(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    node_id: String,
    kind: String,
    title: String,
    body: Option<String>,
) -> Result<CommandNodeDto, CommandErrorDto> {
    let kind = tauri_api::node_kind_from_string(&kind)?;
    tauri_api::node_update(runtime.inner().clone(), node_id, kind, title, body)
}

#[tauri::command]
pub fn node_move(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    node_id: String,
    x: f64,
    y: f64,
) -> Result<CommandNodeDto, CommandErrorDto> {
    tauri_api::node_move(runtime.inner().clone(), node_id, x, y)
}

#[tauri::command]
pub fn edge_create(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    source_id: String,
    target_id: String,
    kind: String,
) -> Result<CommandEdgeDto, CommandErrorDto> {
    let kind = tauri_api::edge_kind_from_string(&kind)?;
    tauri_api::edge_create(
        runtime.inner().clone(),
        workspace_id,
        source_id,
        target_id,
        kind,
    )
}

#[tauri::command]
pub fn edge_delete(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    edge_id: String,
) -> Result<(), CommandErrorDto> {
    tauri_api::edge_delete(runtime.inner().clone(), edge_id)
}

#[tauri::command]
pub fn support_templates_list(
    runtime: tauri::State<'_, SharedCommandRuntime>,
) -> Result<Vec<CommandSupportTemplateDto>, CommandErrorDto> {
    tauri_api::support_templates_list(runtime.inner().clone())
}

#[tauri::command]
pub fn support_adopt(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    template_id: String,
) -> Result<CommandNodeDto, CommandErrorDto> {
    tauri_api::support_adopt(runtime.inner().clone(), workspace_id, template_id)
}

#[tauri::command]
pub fn support_discard(
    runtime: tauri::State<'_, crate::tauri_api::SharedCommandRuntime>,
    support_node_id: String,
) -> Result<(), tauri_api::CommandErrorDto> {
    tauri_api::support_discard(runtime.inner().clone(), support_node_id)
}

#[tauri::command]
pub fn strategy_cards_list(
    runtime: tauri::State<'_, SharedCommandRuntime>,
) -> Result<Vec<CommandStrategyCardDto>, CommandErrorDto> {
    tauri_api::strategy_cards_list(runtime.inner().clone())
}

#[tauri::command]
pub fn strategy_experiment_create(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    experiment: CommandStrategyExperimentDto,
) -> Result<CommandStrategyExperimentDto, CommandErrorDto> {
    let experiment = tauri_api::strategy_experiment_from_dto(experiment)?;
    tauri_api::strategy_experiment_create(runtime.inner().clone(), experiment)
}

#[tauri::command]
pub fn attention_session_start(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    next_action_id: String,
    intended_duration_minutes: u16,
    started_at: String,
) -> Result<CommandAttentionSessionDto, CommandErrorDto> {
    tauri_api::attention_session_start(
        runtime.inner().clone(),
        next_action_id,
        intended_duration_minutes,
        started_at,
    )
}

#[tauri::command]
pub fn context_profile_get(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
) -> Result<CommandContextProfileDto, CommandErrorDto> {
    tauri_api::context_profile_get(runtime.inner().clone(), workspace_id)
}

#[tauri::command]
pub fn context_profile_update(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    profile: CommandContextProfileDto,
) -> Result<CommandContextProfileDto, CommandErrorDto> {
    let profile = tauri_api::context_profile_from_dto(profile)?;
    tauri_api::context_profile_update(runtime.inner().clone(), profile)
}

#[tauri::command]
pub fn agent_turn_submit(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    selected_node_id: Option<String>,
    message: String,
) -> Result<CommandAgentResponseDto, CommandErrorDto> {
    tauri_api::agent_turn_submit(
        runtime.inner().clone(),
        workspace_id,
        selected_node_id,
        message,
    )
}

#[tauri::command]
pub fn agent_preview_get(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    preview_id: String,
) -> Result<Option<CommandPreviewDto>, CommandErrorDto> {
    tauri_api::agent_preview_get(runtime.inner().clone(), preview_id)
}

#[tauri::command]
pub fn agent_preview_accept(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    preview_id: String,
) -> Result<(), CommandErrorDto> {
    tauri_api::agent_preview_accept(runtime.inner().clone(), workspace_id, preview_id)
}

#[tauri::command]
pub fn agent_preview_reject(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    preview_id: String,
) -> Result<(), CommandErrorDto> {
    tauri_api::agent_preview_reject(runtime.inner().clone(), preview_id)
}

#[tauri::command]
pub fn agent_preview_revise(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    preview_id: String,
    message: String,
) -> Result<CommandAgentResponseDto, CommandErrorDto> {
    tauri_api::agent_preview_revise(runtime.inner().clone(), workspace_id, preview_id, message)
}

#[tauri::command]
pub fn start_plan_get(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    next_action_id: String,
) -> Result<CommandStartPlanDto, CommandErrorDto> {
    tauri_api::start_plan_get(runtime.inner().clone(), workspace_id, next_action_id)
}

#[tauri::command]
pub fn attention_session_close(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    session_id: String,
    ended_at: String,
    completion_note: Option<String>,
) -> Result<CommandAttentionSessionDto, CommandErrorDto> {
    tauri_api::attention_session_close(
        runtime.inner().clone(),
        session_id,
        ended_at,
        completion_note,
    )
}

#[tauri::command]
pub fn vault_export(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
) -> Result<CommandVaultExportDto, CommandErrorDto> {
    tauri_api::vault_export(runtime.inner().clone(), workspace_id)
}

#[tauri::command]
pub fn vault_import(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    files: Vec<CommandVaultFileDto>,
) -> Result<CommandVaultImportDto, CommandErrorDto> {
    tauri_api::vault_import(runtime.inner().clone(), workspace_id, files)
}

#[tauri::command]
pub fn agent_memory_list(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
) -> Result<Vec<CommandMemoryDto>, CommandErrorDto> {
    tauri_api::agent_memory_list(runtime.inner().clone(), workspace_id)
}

#[tauri::command]
pub fn agent_memory_update(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    memory: CommandMemoryDto,
) -> Result<CommandMemoryDto, CommandErrorDto> {
    tauri_api::agent_memory_update(
        runtime.inner().clone(),
        workspace_id,
        tauri_api::memory_from_dto(memory),
    )
}

#[tauri::command]
pub fn agent_memory_delete(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    memory_id: String,
) -> Result<(), CommandErrorDto> {
    tauri_api::agent_memory_delete(runtime.inner().clone(), workspace_id, memory_id)
}

#[tauri::command]
pub fn check_in_create(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
    node_id: Option<String>,
    body: String,
) -> Result<CommandCheckInDto, CommandErrorDto> {
    tauri_api::check_in_create(runtime.inner().clone(), workspace_id, node_id, body)
}

#[tauri::command]
pub fn check_in_list(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    workspace_id: String,
) -> Result<Vec<CommandCheckInDto>, CommandErrorDto> {
    tauri_api::check_in_list(runtime.inner().clone(), workspace_id)
}

#[tauri::command]
pub fn settings_get_app(
    runtime: tauri::State<'_, SharedCommandRuntime>,
) -> Result<CommandAppSettingsDto, CommandErrorDto> {
    tauri_api::settings_get_app(runtime.inner().clone())
}

#[tauri::command]
pub fn settings_update_interface(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    theme_preference: String,
    language_preference: String,
) -> Result<CommandAppSettingsDto, CommandErrorDto> {
    tauri_api::settings_update_interface(
        runtime.inner().clone(),
        theme_preference,
        language_preference,
    )
}

#[tauri::command]
pub fn settings_update_llm(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    provider_id: String,
    api_mode: String,
    base_url: String,
    api_key: String,
    model: String,
    timeout_seconds: u64,
) -> Result<CommandLlmSettingsDto, CommandErrorDto> {
    tauri_api::settings_update_llm(
        runtime.inner().clone(),
        provider_id,
        api_mode,
        base_url,
        api_key,
        model,
        timeout_seconds,
    )
}

#[tauri::command]
pub fn settings_test_llm(
    runtime: tauri::State<'_, SharedCommandRuntime>,
    provider_id: String,
    api_mode: String,
    base_url: String,
    api_key: String,
    model: String,
    timeout_seconds: u64,
) -> Result<CommandLlmTestResultDto, CommandErrorDto> {
    tauri_api::settings_test_llm(
        runtime.inner().clone(),
        provider_id,
        api_mode,
        base_url,
        api_key,
        model,
        timeout_seconds,
    )
}
