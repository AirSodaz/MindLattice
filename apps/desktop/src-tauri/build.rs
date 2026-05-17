mod dto_schema;

const REGISTERED_COMMAND_NAMES: &[&str] = &[
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
    "settings_update_llm",
];

fn main() {
    let manifest_dir =
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set for build scripts");
    let generated_path =
        std::path::Path::new(&manifest_dir).join("../src/shared/api/generated/commandDtos.ts");
    if let Some(parent) = generated_path.parent() {
        std::fs::create_dir_all(parent).expect("generated DTO directory should be created");
    }
    std::fs::write(&generated_path, dto_schema::command_dto_typescript())
        .expect("generated command DTO TypeScript should be written");
    println!("cargo:rerun-if-changed=src/tauri_api.rs");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=dto_schema.rs");

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(REGISTERED_COMMAND_NAMES)),
    )
    .expect("Tauri build metadata should generate");
}
