use mindlattice_desktop_commands::tauri_api::SharedCommandRuntime;
use mindlattice_desktop_commands::tauri_commands;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let runtime = SharedCommandRuntime::open_app_data(app.handle())
                .expect("MindLattice command runtime opens");
            app.manage(runtime);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tauri_commands::workspace_open_default,
            tauri_commands::map_get,
            tauri_commands::node_create,
            tauri_commands::node_move,
            tauri_commands::node_update,
            tauri_commands::edge_create,
            tauri_commands::edge_delete,
            tauri_commands::support_templates_list,
            tauri_commands::support_adopt,
            tauri_commands::support_discard,
            tauri_commands::strategy_cards_list,
            tauri_commands::strategy_experiment_create,
            tauri_commands::attention_session_start,
            tauri_commands::context_profile_get,
            tauri_commands::context_profile_update,
            tauri_commands::agent_turn_submit,
            tauri_commands::agent_preview_get,
            tauri_commands::agent_preview_accept,
            tauri_commands::agent_preview_reject,
            tauri_commands::agent_preview_revise,
            tauri_commands::start_plan_get,
            tauri_commands::attention_session_close,
            tauri_commands::agent_memory_list,
            tauri_commands::agent_memory_update,
            tauri_commands::agent_memory_delete,
            tauri_commands::vault_export,
            tauri_commands::vault_import,
            tauri_commands::check_in_create,
            tauri_commands::check_in_list,
            tauri_commands::settings_test_llm,
            tauri_commands::settings_update_llm,
        ])
        .run(tauri::generate_context!())
        .expect("MindLattice Tauri shell failed");
}
