use mindlattice_agent::loop_state::MockLlmProvider;
use mindlattice_core::domain::NodeKind;
use mindlattice_desktop_commands::tauri_api::{
    agent_preview_accept, agent_preview_get, agent_preview_revise, agent_turn_submit,
    attention_session_close, check_in_create, check_in_list, map_get, registered_command_names,
    settings_test_llm, start_plan_get, vault_export, vault_import, workspace_open_default,
    CommandVaultFileDto, SharedCommandRuntime,
};

#[test]
fn tauri_shell_artifacts_exist_for_runtime_command_registration() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let cargo_toml = std::fs::read_to_string(format!("{manifest_dir}/Cargo.toml"))
        .expect("Cargo.toml can be read");
    let tauri_config = std::fs::read_to_string(format!("{manifest_dir}/tauri.conf.json"))
        .expect("tauri.conf.json exists");
    let main_rs =
        std::fs::read_to_string(format!("{manifest_dir}/src/main.rs")).expect("main.rs exists");
    let bridge_rs = std::fs::read_to_string(format!("{manifest_dir}/src/tauri_commands.rs"))
        .expect("tauri command bridge exists");
    let root_package_json =
        std::fs::read_to_string(format!("{manifest_dir}/../../../package.json"))
            .expect("root package.json can be read");
    let icon_metadata = std::fs::metadata(format!("{manifest_dir}/icons/icon.ico"))
        .expect("Windows Tauri icon exists");

    assert!(cargo_toml.contains("[[bin]]"));
    assert!(cargo_toml.contains("tauri-build"));
    assert!(tauri_config.contains("\"identifier\": \"local.mindlattice.desktop\""));
    assert!(
        tauri_config.contains("\"active\": true"),
        "Windows packaging must enable Tauri bundling instead of leaving the bundle inactive"
    );
    assert!(
        tauri_config.contains("\"icons/icon.ico\""),
        "Windows packaging must point at the bundled Windows icon"
    );
    assert!(
        tauri_config.contains("\"beforeDevCommand\": \"pnpm --dir apps/desktop dev\""),
        "beforeDevCommand must run the Vite dev script in apps/desktop instead of recursively invoking root pnpm dev"
    );
    assert!(
        tauri_config.contains("\"beforeBuildCommand\": \"pnpm --dir apps/desktop build\""),
        "beforeBuildCommand must run the desktop UI build script in apps/desktop"
    );
    assert!(
        tauri_config.contains("\"devUrl\": \"http://127.0.0.1:5173\""),
        "Tauri must point at the documented Vite dev server port"
    );
    let vite_config = std::fs::read_to_string(format!("{manifest_dir}/../vite.config.ts"))
        .expect("vite.config.ts exists");
    assert!(vite_config.contains("port: 5173"));
    assert!(
        vite_config.contains("strictPort: true"),
        "Vite must fail on port conflicts instead of silently moving away from Tauri devUrl"
    );
    assert!(
        root_package_json.contains("\"build\": \"pnpm --dir apps/desktop build\""),
        "root package.json must expose the documented desktop UI build command"
    );
    assert!(
        root_package_json.contains("\"test\": \"pnpm --dir apps/desktop test\""),
        "root package.json must expose the documented desktop UI test command"
    );
    assert!(main_rs.contains("tauri::Builder::default()"));
    assert!(main_rs.contains("generate_handler!"));
    assert!(bridge_rs.contains("#[tauri::command]"));
    assert!(bridge_rs.contains("workspace_open_default"));
    assert!(bridge_rs.contains("vault_export"));
    assert!(icon_metadata.len() > 0);
}

#[test]
fn tauri_shell_uses_file_backed_app_data_database() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let main_rs =
        std::fs::read_to_string(format!("{manifest_dir}/src/main.rs")).expect("main.rs exists");
    let tauri_api_rs = std::fs::read_to_string(format!("{manifest_dir}/src/tauri_api.rs"))
        .expect("tauri_api.rs exists");

    assert!(main_rs.contains("SharedCommandRuntime::open_app_data"));
    assert!(tauri_api_rs.contains("mindlattice.sqlite3"));
    assert!(tauri_api_rs.contains("app_data_dir"));
    assert!(tauri_api_rs.contains("std::fs::create_dir_all"));
}

#[test]
fn real_tauri_bridge_mentions_every_registered_command_name() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let main_rs =
        std::fs::read_to_string(format!("{manifest_dir}/src/main.rs")).expect("main.rs exists");
    let bridge_rs = std::fs::read_to_string(format!("{manifest_dir}/src/tauri_commands.rs"))
        .expect("tauri command bridge exists");

    for command_name in registered_command_names() {
        assert!(
            main_rs.contains(command_name),
            "main.rs generate_handler missing {command_name}"
        );
        assert!(
            bridge_rs.contains(&format!("pub fn {command_name}")),
            "tauri_commands.rs missing {command_name}"
        );
    }
}

#[test]
fn tauri_registration_covers_implemented_command_boundary() {
    let names = registered_command_names();

    for expected in [
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
    ] {
        assert!(
            names.contains(&expected),
            "missing Tauri registration for {expected}"
        );
    }
}

#[test]
fn rust_command_dto_schema_generates_frontend_typescript_artifact() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let generated_path = format!("{manifest_dir}/../src/shared/api/generated/commandDtos.ts");
    let command_client_path = format!("{manifest_dir}/../src/shared/api/commandClient.ts");
    let generated =
        std::fs::read_to_string(&generated_path).expect("generated command DTO file exists");
    let command_client =
        std::fs::read_to_string(command_client_path).expect("commandClient.ts exists");

    assert!(generated.contains("Generated from apps/desktop/src-tauri/src/tauri_api.rs"));
    assert!(generated.contains("export type CommandWorkspace"));
    assert!(generated.contains("export type CommandNodeKind"));
    assert!(generated.contains("export type CommandPreview"));
    assert!(generated.contains("proposedStrategyExperiments: CommandStrategyExperiment[]"));
    assert!(generated.contains("export type CommandVaultImport"));
    assert!(generated.contains("export type CommandLlmTestResult"));
    assert!(
        !generated.contains("features/workbench"),
        "generated shared API DTOs must not import feature-layer workbench types"
    );
    assert!(
        command_client.contains("from './generated/commandDtos'"),
        "commandClient.ts should consume generated DTO types instead of duplicating them"
    );
}

#[test]
fn tauri_wrappers_return_frontend_aligned_llm_test_result_dto() {
    let runtime = SharedCommandRuntime::in_memory().expect("runtime opens");

    let error = settings_test_llm(
        runtime,
        "openai".to_string(),
        "openai_chat_completions".to_string(),
        String::new(),
        "test-key".to_string(),
        "model-a".to_string(),
        5,
    )
    .expect_err("invalid test config returns a frontend command error");

    assert_eq!(error.code, "invalid_llm_settings");
}

#[test]
fn rust_command_dto_generation_is_not_a_build_rs_string_blob() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let build_rs =
        std::fs::read_to_string(format!("{manifest_dir}/build.rs")).expect("build.rs exists");

    assert!(
        !build_rs.contains("COMMAND_DTO_TYPESCRIPT"),
        "build.rs should delegate command DTO generation instead of owning the full TS artifact"
    );
}

#[test]
fn tauri_wrappers_return_frontend_aligned_check_in_list_dtos() {
    let runtime = SharedCommandRuntime::in_memory().expect("runtime opens");
    let workspace = workspace_open_default(runtime.clone()).expect("workspace opens");

    let check_in = check_in_create(
        runtime.clone(),
        workspace.id.clone(),
        None,
        "Started with the smallest visible step.".to_string(),
    )
    .expect("check-in returns DTO");

    assert_eq!(
        check_in_list(runtime, workspace.id).expect("check-in list returns DTOs"),
        vec![check_in]
    );
}

#[test]
fn tauri_wrappers_return_frontend_aligned_vault_import_export_dtos() {
    let runtime = SharedCommandRuntime::in_memory().expect("runtime opens");
    let workspace = workspace_open_default(runtime.clone()).expect("workspace opens");
    mindlattice_desktop_commands::commands::node_create(
        &runtime.lock().expect("runtime lock"),
        &workspace.id,
        NodeKind::Task,
        "Plan launch",
    )
    .expect("node created");

    let exported =
        vault_export(runtime.clone(), workspace.id.clone()).expect("vault export returns DTO");
    let imported = vault_import(
        runtime,
        workspace.id,
        vec![CommandVaultFileDto {
            filename: "Imported.md".to_string(),
            content: "---\nmindlattice_id: imported-1\nkind: note\n---\n# Imported\nBody."
                .to_string(),
        }],
    )
    .expect("vault import returns DTO");

    assert_eq!(exported.files[0].filename, "Plan launch.md");
    assert!(exported.files[0].content.contains("kind: task"));
    assert_eq!(imported.nodes_created, 1);
    assert_eq!(imported.nodes[0].workspace_id, "default-workspace");
    assert_eq!(imported.nodes[0].kind, "note");
}

#[test]
fn tauri_wrappers_return_frontend_aligned_dtos_for_agent_preview_flow() {
    let runtime = SharedCommandRuntime::in_memory().expect("runtime opens");
    runtime
        .lock()
        .expect("runtime lock")
        .configure_llm(MockLlmProvider::with_preview_nodes(vec![(
            "next-1",
            NodeKind::NextAction,
            "Open the draft and write three bullets",
        )]));

    let workspace = workspace_open_default(runtime.clone()).expect("workspace opens");
    let before = map_get(runtime.clone(), workspace.id.clone()).expect("map loads");

    let response = agent_turn_submit(
        runtime.clone(),
        workspace.id.clone(),
        None,
        "Break this down".to_string(),
    )
    .expect("agent turn returns preview");
    let preview_id = response.preview.as_ref().expect("preview").id.clone();

    assert_eq!(workspace.title, "Default workspace");
    assert_eq!(before.workspace.id, workspace.id);
    assert_eq!(response.kind, "PreviewProposed");
    assert_eq!(
        response.preview.as_ref().unwrap().proposed_nodes[0].kind,
        "next_action"
    );
    assert!(agent_preview_get(runtime.clone(), preview_id.clone())
        .expect("preview loads")
        .is_some());

    agent_preview_accept(runtime.clone(), workspace.id.clone(), preview_id.clone())
        .expect("preview accepted");
    let after = map_get(runtime.clone(), workspace.id).expect("map reloads");

    assert_eq!(after.nodes.len(), 1);
    assert_eq!(after.nodes[0].id, "next-1");
    assert!(agent_preview_get(runtime, preview_id)
        .expect("missing preview on independent runtime")
        .is_none());
}

#[test]
fn tauri_wrappers_return_frontend_aligned_dtos_for_preview_revision() {
    let runtime = SharedCommandRuntime::in_memory().expect("runtime opens");
    runtime
        .lock()
        .expect("runtime lock")
        .configure_llm(MockLlmProvider::with_structured_content(
            r#"{
              "id": "preview-original",
              "user_visible_summary": "Draft map changes for review.",
              "proposed_nodes": [
                {
                  "id": "next-original",
                  "kind": "next_action",
                  "title": "Open the draft and write three bullets"
                }
              ],
              "proposed_edges": []
            }"#,
        ));
    let workspace = workspace_open_default(runtime.clone()).expect("workspace opens");
    let response = agent_turn_submit(
        runtime.clone(),
        workspace.id.clone(),
        None,
        "Break this down".to_string(),
    )
    .expect("agent turn returns preview");
    let original_preview_id = response.preview.as_ref().expect("preview").id.clone();

    runtime
        .lock()
        .expect("runtime lock")
        .configure_llm(MockLlmProvider::with_structured_content(
            r#"{
              "id": "preview-revised",
              "user_visible_summary": "Smaller draft map changes for review.",
              "proposed_nodes": [
                {
                  "id": "next-revised",
                  "kind": "next_action",
                  "title": "Write one rough bullet"
                }
              ],
              "proposed_edges": []
            }"#,
        ));
    let revised = agent_preview_revise(
        runtime.clone(),
        workspace.id.clone(),
        original_preview_id.clone(),
        "Only keep one small step".to_string(),
    )
    .expect("preview revision returns frontend DTO");

    assert_eq!(revised.kind, "PreviewProposed");
    assert_eq!(revised.preview.as_ref().unwrap().id, "preview-revised");
    assert_eq!(
        revised.preview.as_ref().unwrap().proposed_nodes[0].kind,
        "next_action"
    );
    assert!(agent_preview_get(runtime.clone(), original_preview_id)
        .expect("old preview lookup succeeds")
        .is_none());
    assert!(agent_preview_get(runtime, "preview-revised".to_string())
        .expect("revised preview lookup succeeds")
        .is_some());
}

#[test]
fn tauri_wrappers_return_frontend_aligned_start_plan_and_session_dtos() {
    let runtime = SharedCommandRuntime::in_memory().expect("runtime opens");
    let workspace = workspace_open_default(runtime.clone()).expect("workspace opens");
    let action = mindlattice_desktop_commands::commands::node_create(
        &runtime.lock().expect("runtime lock"),
        &workspace.id,
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )
    .expect("next action created");
    let session = mindlattice_desktop_commands::commands::attention_session_start(
        &runtime.lock().expect("runtime lock"),
        &action.id,
        5,
        "2026-05-17T00:00:00Z",
    )
    .expect("session starts");

    let plan = start_plan_get(runtime.clone(), workspace.id, action.id)
        .expect("start plan returns frontend DTO");
    let closed = attention_session_close(
        runtime,
        session.id,
        "2026-05-17T00:05:00Z".to_string(),
        Some("Stopped at three rough bullets.".to_string()),
    )
    .expect("session close returns frontend DTO");

    assert_eq!(plan.selected_next_action.kind, "next_action");
    assert_eq!(plan.start_check.five_minute_fit, true);
    assert_eq!(closed.state, "closed");
    assert_eq!(closed.ended_at.as_deref(), Some("2026-05-17T00:05:00Z"));
}
