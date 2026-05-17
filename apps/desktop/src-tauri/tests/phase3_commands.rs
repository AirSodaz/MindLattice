use mindlattice_agent::loop_state::MockLlmProvider;
use mindlattice_core::domain::{
    AiProposalStatus, CheckIn, ContextProfile, EdgeKind, GraphNode, MemoryProposal, NodeKind,
};
use mindlattice_core::strategies::{ExperimentContext, StrategyDecision, StrategyExperiment};
use mindlattice_desktop_commands::commands::{
    agent_memory_delete, agent_memory_list, agent_memory_update, agent_preview_accept,
    agent_preview_get, agent_preview_reject, agent_preview_revise, agent_turn_submit,
    attention_session_close, attention_session_start, check_in_create, context_profile_get,
    context_profile_update, edge_create, edge_delete, map_get, node_create, node_move, node_update,
    settings_test_llm, settings_update_llm, start_plan_get, strategy_cards_list,
    strategy_experiment_create,
    support_adopt, support_discard, support_templates_list, vault_export, vault_import,
    workspace_open_default, CommandError, CommandRuntime, VaultImportFileDto,
};
use mindlattice_storage::repository::MindLatticeRepository;
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::mpsc::{self, Receiver},
    thread::{self, JoinHandle},
};

fn test_database_path(name: &str) -> std::path::PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!("mindlattice-{name}-{}.sqlite3", std::process::id()));
    let _ = std::fs::remove_file(&path);
    path
}

#[test]
fn command_probe_opens_default_workspace_and_reads_map() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");

    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let snapshot = map_get(&runtime, &workspace.id).expect("map loads");

    assert_eq!(workspace.title, "Default workspace");
    assert_eq!(snapshot.workspace.id, workspace.id);
    assert!(snapshot.nodes.is_empty());
}

#[test]
fn file_backed_command_runtime_reopens_persisted_map_data() {
    let db_path = test_database_path("command-runtime-reopen");
    {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        let workspace = workspace_open_default(&runtime).expect("workspace opens");
        node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch").expect("node created");
    }

    let reopened = CommandRuntime::open_file(&db_path).expect("file runtime reopens");
    let snapshot =
        map_get(&reopened, "default-workspace").expect("map reloads from file-backed runtime");

    assert_eq!(snapshot.nodes.len(), 1);
    assert_eq!(snapshot.nodes[0].title, "Plan launch");

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn commands_create_node_and_edge_through_typed_dtos() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let task = node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch")
        .expect("task node created");
    let action = node_create(
        &runtime,
        &workspace.id,
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )
    .expect("next action node created");
    edge_create(
        &runtime,
        &workspace.id,
        &task.id,
        &action.id,
        EdgeKind::BreaksDownTo,
    )
    .expect("edge created");

    let snapshot = map_get(&runtime, &workspace.id).expect("map reloads");
    assert_eq!(snapshot.nodes.len(), 2);
    assert_eq!(snapshot.edges.len(), 1);
}

#[test]
fn command_updates_node_title_body_and_kind_through_typed_dto() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let node =
        node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch").expect("node created");

    let updated = node_update(
        &runtime,
        &node.id,
        NodeKind::Subtask,
        "Draft launch outline",
        Some("Keep this rough."),
    )
    .expect("node updated");

    assert_eq!(updated.id, node.id);
    assert_eq!(updated.kind, NodeKind::Subtask);
    assert_eq!(updated.title, "Draft launch outline");
    assert_eq!(updated.body.as_deref(), Some("Keep this rough."));
}

#[test]
fn command_moves_node_and_persists_canvas_position_after_reload() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let node =
        node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch").expect("node created");

    let moved = node_move(&runtime, &node.id, 42.5, 61.25).expect("node moved");
    let snapshot = map_get(&runtime, &workspace.id).expect("map reloads");
    let persisted = snapshot
        .nodes
        .iter()
        .find(|candidate| candidate.id == node.id)
        .expect("moved node present after reload");

    assert_eq!(moved.position.as_ref().unwrap().x, 42.5);
    assert_eq!(moved.position.as_ref().unwrap().y, 61.25);
    assert_eq!(persisted.position, moved.position);
}

#[test]
fn command_soft_deletes_edge_without_removing_nodes() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let task = node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch")
        .expect("task node created");
    let action = node_create(
        &runtime,
        &workspace.id,
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )
    .expect("next action node created");
    let edge = edge_create(
        &runtime,
        &workspace.id,
        &task.id,
        &action.id,
        EdgeKind::BreaksDownTo,
    )
    .expect("edge created");

    edge_delete(&runtime, &edge.id).expect("edge deleted");
    let snapshot = map_get(&runtime, &workspace.id).expect("map reloads");

    assert_eq!(snapshot.nodes.len(), 2);
    assert!(snapshot.edges.is_empty());
}

#[test]
fn command_lists_support_templates_and_strategy_cards_without_network() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");

    assert!(
        support_templates_list(&runtime)
            .expect("support templates list")
            .len()
            >= 6
    );
    assert!(
        strategy_cards_list(&runtime)
            .expect("strategy cards list")
            .len()
            >= 3
    );
}

#[test]
fn command_starts_attention_session_for_next_action() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let action = node_create(
        &runtime,
        &workspace.id,
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )
    .expect("next action node created");

    let session = attention_session_start(&runtime, &action.id, 5, "2026-05-17T00:00:00Z")
        .expect("attention session starts");

    assert_eq!(session.next_action_id, action.id);
    assert_eq!(session.intended_duration_minutes, Some(5));
}

#[test]
fn command_generates_start_plan_from_persisted_next_action_context() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let task = node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch")
        .expect("task node created");
    let action = node_create(
        &runtime,
        &workspace.id,
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )
    .expect("next action node created");
    edge_create(
        &runtime,
        &workspace.id,
        &task.id,
        &action.id,
        EdgeKind::BreaksDownTo,
    )
    .expect("edge created");

    let plan = start_plan_get(&runtime, &workspace.id, &action.id).expect("start plan generated");

    assert_eq!(plan.selected_next_action.id, action.id);
    assert_eq!(plan.parent_task.as_ref().unwrap().id, task.id);
    assert!(plan.start_check.reopen_target.contains("Open the draft"));
}

#[test]
fn command_closes_attention_session_without_productivity_scoring() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let action = node_create(
        &runtime,
        &workspace.id,
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )
    .expect("next action node created");
    let session = attention_session_start(&runtime, &action.id, 5, "2026-05-17T00:00:00Z")
        .expect("attention session starts");

    let closed = attention_session_close(
        &runtime,
        &session.id,
        "2026-05-17T00:05:00Z",
        Some("Stopped at three rough bullets."),
    )
    .expect("attention session closes");

    assert_eq!(closed.id, session.id);
    assert_eq!(closed.state.as_str(), "closed");
    assert_eq!(closed.ended_at.as_deref(), Some("2026-05-17T00:05:00Z"));
    assert_eq!(
        closed.completion_note.as_deref(),
        Some("Stopped at three rough bullets.")
    );
}

#[test]
fn command_submits_agent_turn_and_returns_preview() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    runtime.configure_llm(MockLlmProvider::with_preview_nodes(vec![(
        "next-1",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )]));
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let task = node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch")
        .expect("task node created");

    let response = agent_turn_submit(
        &runtime,
        &workspace.id,
        Some(task.id.as_str()),
        "Break this down",
    )
    .expect("agent turn returns preview");

    assert!(response.preview.is_some());
    assert!(response.message.contains("Preview"));
}

#[test]
fn file_backed_command_runtime_persists_agent_turn_state_after_reopen() {
    let db_path = test_database_path("agent-turn-state-reopen");
    let response_prompt_versions = {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        runtime.configure_llm(MockLlmProvider::with_preview_nodes(vec![(
            "next-1",
            NodeKind::NextAction,
            "Open the draft and write three bullets",
        )]));
        let workspace = workspace_open_default(&runtime).expect("workspace opens");
        let response = agent_turn_submit(
            &runtime,
            &workspace.id,
            None,
            "Break this down into one next action",
        )
        .expect("agent turn returns preview");

        response.prompt_versions
    };

    let repo = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    repo.migrate().expect("migrations are idempotent");
    let threads = repo
        .agent_threads("default-workspace")
        .expect("agent threads reload");
    assert_eq!(threads.len(), 1);
    assert_eq!(threads[0].id, "agent-thread-default-workspace");
    assert_eq!(threads[0].title, "Default workspace agent thread");

    let turns = repo
        .agent_turns(&threads[0].id)
        .expect("agent turns reload");
    assert_eq!(turns.len(), 1);
    assert_eq!(
        turns[0].user_message,
        "Break this down into one next action"
    );
    assert!(turns[0].agent_response.contains("Preview drafted"));
    assert_eq!(
        turns[0].prompt_version_id.as_deref(),
        Some(response_prompt_versions.join(",").as_str())
    );

    let persisted_prompt_versions = repo
        .prompt_versions()
        .expect("prompt version records reload")
        .into_iter()
        .map(|record| record.id)
        .collect::<Vec<_>>();
    assert_eq!(persisted_prompt_versions, response_prompt_versions);

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn command_returns_structured_error_when_provider_missing() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let error = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
        .expect_err("missing provider returns structured command error");

    assert_eq!(error, CommandError::MissingLlmProviderSettings);
}

#[test]
fn command_node_dto_has_no_raw_database_fields() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let node =
        node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch").expect("node created");

    let GraphNode {
        id,
        workspace_id,
        kind,
        title,
        body,
        metadata,
        position,
    } = node;

    assert!(!id.is_empty());
    assert_eq!(workspace_id, workspace.id);
    assert_eq!(kind, NodeKind::Task);
    assert_eq!(title, "Plan launch");
    assert!(body.is_none());
    assert!(metadata.is_none());
    assert!(position.is_none());
}

#[test]
fn command_adopts_support_template_and_records_experiment() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let support = support_adopt(&runtime, &workspace.id, "visible-checklist")
        .expect("support template adopted");
    assert_eq!(support.kind, NodeKind::Support);
    assert!(support
        .body
        .unwrap()
        .contains("Template: visible-checklist"));

    let experiment = StrategyExperiment {
        id: "experiment-1".to_string(),
        support_template_id: Some("visible-checklist".to_string()),
        custom_support_title: None,
        context: ExperimentContext::Work,
        helped_start: true,
        helped_continue: false,
        helped_return: true,
        helped_clarify_next_action: true,
        obstacle_note: Some("Needed fewer steps.".to_string()),
        next_decision: StrategyDecision::Revise,
    };
    let saved = strategy_experiment_create(&runtime, experiment.clone()).expect("experiment saved");
    assert_eq!(saved, experiment);
}

#[test]
fn command_discards_adopted_support_without_removing_templates() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let support = support_adopt(&runtime, &workspace.id, "visible-checklist")
        .expect("support template adopted");

    support_discard(&runtime, &support.id).expect("support discarded");
    let snapshot = map_get(&runtime, &workspace.id).expect("map reloads");

    assert!(snapshot.nodes.iter().all(|node| node.id != support.id));
    assert!(support_templates_list(&runtime)
        .expect("support templates list")
        .iter()
        .any(|template| template.id == "visible-checklist"));
}

#[test]
fn file_backed_support_adoption_records_template_note_beyond_graph_node() {
    let db_path = test_database_path("support-adoption-note-reopen");
    let support_id = {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        let workspace = workspace_open_default(&runtime).expect("workspace opens");
        let support = support_adopt(&runtime, &workspace.id, "visible-checklist")
            .expect("support template adopted");

        support.id
    };

    let repo = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    repo.migrate().expect("migrations are idempotent");
    let note = repo
        .node_note(&support_id)
        .expect("support adoption note lookup succeeds")
        .expect("support adoption records a node note");

    assert_eq!(note.node_id, support_id);
    assert!(note.body.contains("Template: visible-checklist"));
    assert!(note.body.contains("Safety note:"));

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn command_gets_and_updates_context_profile() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let default_profile = context_profile_get(&runtime, &workspace.id)
        .expect("default profile returns when none saved");
    assert_eq!(default_profile.workspace_id, workspace.id);
    assert_eq!(default_profile.llm_provider_setup_state, "not_configured");

    let updated = ContextProfile {
        adult_contexts: vec!["work".to_string()],
        execution_difficulties: vec!["starting".to_string()],
        ..default_profile
    };
    context_profile_update(&runtime, updated.clone()).expect("profile updated");
    assert_eq!(
        context_profile_get(&runtime, &workspace.id).expect("updated profile loads"),
        updated
    );
}

#[test]
fn command_memory_management_is_visible_and_editable() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let memory = MemoryProposal {
        id: "memory-1".to_string(),
        proposed_memory_text: "Prefer no more than three next actions.".to_string(),
        evidence_reference: Some("manual".to_string()),
    };

    agent_memory_update(&runtime, &workspace.id, memory.clone()).expect("memory saved");
    assert_eq!(
        agent_memory_list(&runtime, &workspace.id).expect("memory listed"),
        vec![memory.clone()]
    );

    let edited = MemoryProposal {
        proposed_memory_text: "Prefer one to three next actions.".to_string(),
        ..memory
    };
    agent_memory_update(&runtime, &workspace.id, edited.clone()).expect("memory edited");
    assert_eq!(
        agent_memory_list(&runtime, &workspace.id).expect("edited memory listed"),
        vec![edited.clone()]
    );

    agent_memory_delete(&runtime, &workspace.id, &edited.id).expect("memory deleted");
    assert!(agent_memory_list(&runtime, &workspace.id)
        .expect("memory list loads")
        .is_empty());
}

#[test]
fn command_preview_get_and_reject_keep_persisted_map_unchanged() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    runtime.configure_llm(MockLlmProvider::with_preview_nodes(vec![(
        "next-1",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )]));
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let before = map_get(&runtime, &workspace.id).expect("map loads before preview");

    let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
        .expect("preview created");
    let preview_id = response.preview.as_ref().unwrap().id.clone();

    assert!(agent_preview_get(&runtime, &preview_id)
        .expect("preview loads")
        .is_some());
    agent_preview_reject(&runtime, &preview_id).expect("preview rejected");
    assert!(agent_preview_get(&runtime, &preview_id)
        .expect("rejected preview not active")
        .is_none());

    let after = map_get(&runtime, &workspace.id).expect("map loads after rejection");
    assert_eq!(after, before);
}

#[test]
fn command_accepts_preview_into_persisted_map() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    runtime.configure_llm(MockLlmProvider::with_preview_nodes(vec![(
        "next-1",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    )]));
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
        .expect("preview created");
    let preview_id = response.preview.as_ref().unwrap().id.clone();
    agent_preview_accept(&runtime, &workspace.id, &preview_id).expect("preview accepted");

    let snapshot = map_get(&runtime, &workspace.id).expect("map loads");
    assert_eq!(snapshot.nodes.len(), 1);
    assert_eq!(
        snapshot.nodes[0].title,
        "Open the draft and write three bullets"
    );
    assert!(agent_preview_get(&runtime, &preview_id)
        .expect("accepted preview no longer active")
        .is_none());
}

#[test]
fn file_backed_preview_lifecycle_updates_ai_proposal_status() {
    let db_path = test_database_path("preview-proposal-lifecycle");
    let accepted_preview_id = {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        runtime.configure_llm(MockLlmProvider::with_structured_content(
            r#"{
              "id": "preview-accepted-lifecycle",
              "user_visible_summary": "Draft map changes for review.",
              "proposed_nodes": [
                {
                  "id": "next-accepted",
                  "kind": "next_action",
                  "title": "Open the draft and write three bullets"
                }
              ],
              "proposed_edges": []
            }"#,
        ));
        let workspace = workspace_open_default(&runtime).expect("workspace opens");
        let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
            .expect("preview created");
        let preview_id = response.preview.as_ref().unwrap().id.clone();
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations are idempotent");
        assert_eq!(
            repo.ai_proposals()
                .expect("active proposal recorded")
                .into_iter()
                .find(|proposal| proposal.id == preview_id)
                .expect("preview proposal record exists")
                .status,
            AiProposalStatus::Active
        );

        agent_preview_accept(&runtime, &workspace.id, &preview_id).expect("preview accepted");
        preview_id
    };

    let rejected_preview_id = {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime reopens");
        runtime.configure_llm(MockLlmProvider::with_structured_content(
            r#"{
              "id": "preview-rejected-lifecycle",
              "user_visible_summary": "Draft map changes for review.",
              "proposed_nodes": [
                {
                  "id": "next-rejected",
                  "kind": "next_action",
                  "title": "Write one rough bullet"
                }
              ],
              "proposed_edges": []
            }"#,
        ));
        let workspace = workspace_open_default(&runtime).expect("workspace opens after reopen");
        let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down again")
            .expect("second preview created");
        let preview_id = response.preview.as_ref().unwrap().id.clone();

        agent_preview_reject(&runtime, &preview_id).expect("preview rejected");
        preview_id
    };

    let repo = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    repo.migrate().expect("migrations are idempotent");
    let proposals = repo.ai_proposals().expect("proposal records reload");

    assert_eq!(
        proposals
            .iter()
            .find(|proposal| proposal.id == accepted_preview_id)
            .expect("accepted proposal record exists")
            .status,
        AiProposalStatus::Accepted
    );
    assert_eq!(
        proposals
            .iter()
            .find(|proposal| proposal.id == rejected_preview_id)
            .expect("rejected proposal record exists")
            .status,
        AiProposalStatus::Rejected
    );

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn command_accepts_non_graph_preview_payloads_after_reopen() {
    let db_path = test_database_path("non-graph-preview-accept");
    let expected_memory = MemoryProposal {
        id: "memory-preview-1".to_string(),
        proposed_memory_text: "Prefer a visible resume note after interruptions.".to_string(),
        evidence_reference: Some("check-in-preview-1".to_string()),
    };
    let expected_check_in = CheckIn {
        id: "check-in-preview-1".to_string(),
        workspace_id: "default-workspace".to_string(),
        node_id: None,
        body: "Started, then got stuck looking for the source material.".to_string(),
    };
    let expected_experiment = StrategyExperiment {
        id: "strategy-preview-1".to_string(),
        support_template_id: Some("return-cue".to_string()),
        custom_support_title: None,
        context: ExperimentContext::Work,
        helped_start: true,
        helped_continue: false,
        helped_return: true,
        helped_clarify_next_action: true,
        obstacle_note: Some("The resume note helped after an interruption.".to_string()),
        next_decision: StrategyDecision::Keep,
    };

    let preview_id = {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        runtime.configure_llm(MockLlmProvider::with_structured_content(
            r#"{
              "id": "preview-non-graph-1",
              "user_visible_summary": "Review one memory, one check-in, and one strategy experiment before saving.",
              "proposed_nodes": [],
              "proposed_edges": [],
              "proposed_memory": [
                {
                  "id": "memory-preview-1",
                  "proposed_memory_text": "Prefer a visible resume note after interruptions.",
                  "evidence_reference": "check-in-preview-1"
                }
              ],
              "proposed_check_ins": [
                {
                  "id": "check-in-preview-1",
                  "workspace_id": "default-workspace",
                  "node_id": null,
                  "body": "Started, then got stuck looking for the source material."
                }
              ],
              "proposed_strategy_experiments": [
                {
                  "id": "strategy-preview-1",
                  "support_template_id": "return-cue",
                  "custom_support_title": null,
                  "context": "work",
                  "helped_start": true,
                  "helped_continue": false,
                  "helped_return": true,
                  "helped_clarify_next_action": true,
                  "obstacle_note": "The resume note helped after an interruption.",
                  "next_decision": "keep"
                }
              ]
            }"#,
        ));
        let workspace = workspace_open_default(&runtime).expect("workspace opens");
        let response = agent_turn_submit(
            &runtime,
            &workspace.id,
            None,
            "Save this follow-up after review",
        )
        .expect("non-graph preview created");
        let preview_id = response.preview.as_ref().unwrap().id.clone();

        assert!(agent_memory_list(&runtime, &workspace.id)
            .expect("memory list before accept")
            .is_empty());
        assert!(
            mindlattice_desktop_commands::commands::check_in_list(&runtime, &workspace.id)
                .expect("check-ins before accept")
                .is_empty()
        );

        preview_id
    };

    let reopened = CommandRuntime::open_file(&db_path).expect("file runtime reopens");
    let workspace = workspace_open_default(&reopened).expect("workspace opens after reopen");
    assert!(agent_preview_get(&reopened, &preview_id)
        .expect("non-graph preview loads after reopen")
        .is_some());

    agent_preview_accept(&reopened, &workspace.id, &preview_id)
        .expect("non-graph preview accepted");

    assert_eq!(
        agent_memory_list(&reopened, &workspace.id).expect("memory saved after accept"),
        vec![expected_memory]
    );
    assert_eq!(
        mindlattice_desktop_commands::commands::check_in_list(&reopened, &workspace.id)
            .expect("check-in saved after accept"),
        vec![expected_check_in]
    );
    assert!(agent_preview_get(&reopened, &preview_id)
        .expect("accepted non-graph preview no longer active")
        .is_none());

    let repo = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    repo.migrate().expect("migrations are idempotent");
    assert_eq!(
        repo.strategy_experiments()
            .expect("strategy experiment saved after accept"),
        vec![expected_experiment]
    );

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn file_backed_command_runtime_reopens_active_preview_for_acceptance() {
    let db_path = test_database_path("preview-reopen");
    let preview_id = {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        runtime.configure_llm(MockLlmProvider::with_preview_nodes(vec![(
            "next-1",
            NodeKind::NextAction,
            "Open the draft and write three bullets",
        )]));
        let workspace = workspace_open_default(&runtime).expect("workspace opens");
        let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
            .expect("preview created");
        response.preview.as_ref().unwrap().id.clone()
    };

    let reopened = CommandRuntime::open_file(&db_path).expect("file runtime reopens");
    let workspace = workspace_open_default(&reopened).expect("workspace opens after reopen");
    assert!(agent_preview_get(&reopened, &preview_id)
        .expect("preview loads after reopen")
        .is_some());
    agent_preview_accept(&reopened, &workspace.id, &preview_id).expect("preview accepted");

    let snapshot = map_get(&reopened, &workspace.id).expect("map loads after accept");
    assert!(snapshot.nodes.iter().any(|node| node.id == "next-1"));

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn command_accept_preview_uses_backend_write_plan_validation() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    runtime.configure_llm(MockLlmProvider::with_structured_content(
        r#"{
          "id": "preview-invalid-edge",
          "user_visible_summary": "Draft map changes for review.",
          "proposed_nodes": [
            {
              "id": "next-1",
              "kind": "next_action",
              "title": "Open the draft and write three bullets"
            }
          ],
          "proposed_edges": [
            {
              "id": "edge-invalid",
              "source_id": "missing-source",
              "target_id": "next-1",
              "kind": "breaks_down_to"
            }
          ]
        }"#,
    ));
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
        .expect("preview created");
    let preview_id = response.preview.as_ref().unwrap().id.clone();

    let error = agent_preview_accept(&runtime, &workspace.id, &preview_id)
        .expect_err("accepted-preview write plan validates graph mutations before persistence");

    assert_eq!(error, CommandError::Repository);
    let snapshot = map_get(&runtime, &workspace.id).expect("map loads after failed accept");
    assert!(snapshot.nodes.is_empty());
    assert!(agent_preview_get(&runtime, &preview_id)
        .expect("invalid accepted preview remains active")
        .is_some());
}

#[test]
fn command_revises_active_preview_without_persisting_map_changes() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    runtime.configure_llm(MockLlmProvider::with_structured_content(
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
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let response = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
        .expect("preview created");
    let original_preview_id = response.preview.as_ref().unwrap().id.clone();

    runtime.configure_llm(MockLlmProvider::with_structured_content(
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
    let revised_response = agent_preview_revise(
        &runtime,
        &workspace.id,
        &original_preview_id,
        "Only keep the first tiny step",
    )
    .expect("active preview can be revised from natural language");
    let revised_preview = revised_response.preview.expect("revised preview returned");

    assert_eq!(revised_preview.id, "preview-revised");
    assert_eq!(revised_preview.proposed_nodes[0].id, "next-revised");
    assert_eq!(
        revised_preview.proposed_nodes[0].title,
        "Write one rough bullet"
    );
    assert!(agent_preview_get(&runtime, &original_preview_id)
        .expect("old preview lookup succeeds")
        .is_none());
    assert!(agent_preview_get(&runtime, &revised_preview.id)
        .expect("revised preview lookup succeeds")
        .is_some());
    assert!(map_get(&runtime, &workspace.id)
        .expect("map loads after revision")
        .nodes
        .is_empty());
}

#[test]
fn file_backed_command_runtime_uses_saved_llm_settings_after_reopen() {
    let db_path = test_database_path("llm-settings-reopen");
    let provider_content = r#"{
      "id": "preview-provider-1",
      "user_visible_summary": "Draft map changes from saved provider settings.",
      "proposed_nodes": [
        {
          "id": "next-provider-1",
          "kind": "next_action",
          "title": "Open the draft and write three bullets",
          "body": "Minimum done: three bullets are visible."
        }
      ],
      "proposed_edges": []
    }"#;
    let (base_url, captured_request, server) = start_openai_compatible_server(provider_content);
    {
        let runtime = CommandRuntime::open_file(&db_path).expect("file runtime opens");
        settings_update_llm(&runtime, &base_url, "test-key", "model-a", 5).expect("settings saved");
    }

    let reopened = CommandRuntime::open_file(&db_path).expect("file runtime reopens");
    let workspace = workspace_open_default(&reopened).expect("workspace opens after reopen");
    let task = node_create(&reopened, &workspace.id, NodeKind::Task, "Plan launch")
        .expect("task node created");
    let response = agent_turn_submit(
        &reopened,
        &workspace.id,
        Some(task.id.as_str()),
        "Break this down",
    )
    .expect("saved provider settings drive the live agent runtime");

    let preview = response.preview.expect("provider preview returned");
    assert_eq!(preview.id, "preview-provider-1");
    assert_eq!(preview.proposed_nodes[0].id, "next-provider-1");
    assert_eq!(preview.proposed_nodes[0].kind, NodeKind::NextAction);

    let request_text = captured_request
        .recv()
        .expect("server captures configured provider request");
    server.join().expect("mock provider server exits");
    assert!(request_text.starts_with("POST /v1/chat/completions HTTP/1.1"));
    assert!(request_text
        .to_ascii_lowercase()
        .contains("authorization: bearer test-key"));
    assert!(request_text.contains(r#""model":"model-a""#));

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn command_creates_check_in_without_scoring_language() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let check_in = check_in_create(
        &runtime,
        &workspace.id,
        None,
        "Started, got stuck at missing examples, return to the outline.",
    )
    .expect("check-in saved");

    assert_eq!(check_in.workspace_id, workspace.id);
    assert!(check_in.body.contains("return to the outline"));

    let error = check_in_create(
        &runtime,
        &workspace.id,
        None,
        "Symptom score improved after this plan.",
    )
    .expect_err("clinical scoring language is blocked");
    assert_eq!(error, CommandError::SafetyBlocked);
}

fn start_openai_compatible_server(
    provider_content: &'static str,
) -> (String, Receiver<String>, JoinHandle<()>) {
    start_openai_compatible_status_server("200 OK", provider_response_body(provider_content))
}

fn start_openai_compatible_status_server(
    status_line: &'static str,
    response_body: String,
) -> (String, Receiver<String>, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind local provider server");
    let address = listener
        .local_addr()
        .expect("read local provider server address");
    let base_url = format!("http://{address}/v1");
    let (sender, receiver) = mpsc::channel();

    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept provider request");
        let request_text = read_http_request(&mut stream);
        sender.send(request_text).expect("send captured request");

        let response = format!(
            "HTTP/1.1 {status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
            response_body.len()
        );
        stream
            .write_all(response.as_bytes())
            .expect("write provider response");
    });

    (base_url, receiver, handle)
}

fn provider_response_body(provider_content: &str) -> String {
    let escaped_content = provider_content
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "\\r")
        .replace('\n', "\\n");
    format!(
        r#"{{"choices":[{{"message":{{"content":"{escaped_content}"}},"finish_reason":"stop"}}]}}"#
    )
}

fn read_http_request(stream: &mut TcpStream) -> String {
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 1024];

    loop {
        let read = stream.read(&mut chunk).expect("read provider request");
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if request_is_complete(&buffer) {
            break;
        }
    }

    String::from_utf8_lossy(&buffer).to_string()
}

fn request_is_complete(buffer: &[u8]) -> bool {
    let Some(header_end) = buffer.windows(4).position(|window| window == b"\r\n\r\n") else {
        return false;
    };
    let headers = String::from_utf8_lossy(&buffer[..header_end]);
    let content_length = headers
        .lines()
        .find_map(|line| {
            line.strip_prefix("content-length: ")
                .or_else(|| line.strip_prefix("Content-Length: "))
                .and_then(|value| value.trim().parse::<usize>().ok())
        })
        .unwrap_or(0);
    buffer.len() >= header_end + 4 + content_length
}

#[test]
fn command_lists_workspace_check_ins_for_review() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");

    let first = check_in_create(
        &runtime,
        &workspace.id,
        None,
        "Started with one visible bullet.",
    )
    .expect("first check-in saved");
    let second = check_in_create(
        &runtime,
        &workspace.id,
        None,
        "Returning after interruption needs the outline visible.",
    )
    .expect("second check-in saved");

    assert_eq!(
        mindlattice_desktop_commands::commands::check_in_list(&runtime, &workspace.id)
            .expect("check-ins list"),
        vec![first, second]
    );
}

#[test]
fn command_updates_llm_settings_with_validation() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");

    let settings = settings_update_llm(
        &runtime,
        "https://api.example.test/v1",
        "test-key",
        "model-a",
        30,
    )
    .expect("settings saved");
    assert_eq!(settings.model, "model-a");

    let error = settings_update_llm(&runtime, "", "test-key", "model-a", 30)
        .expect_err("invalid settings return command error");
    assert_eq!(error, CommandError::InvalidLlmSettings);
}

#[test]
fn command_tests_llm_settings_without_persisting_them() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let (base_url, captured_request, server) = start_openai_compatible_server(r#"{"ok":true}"#);

    let result = settings_test_llm(&runtime, &base_url, "test-key", "model-a", 5)
        .expect("provider test succeeds");

    assert_eq!(result.status, "ok");
    assert_eq!(result.model, "model-a");
    assert!(result.message.contains("Connection test succeeded"));

    let request_text = captured_request
        .recv()
        .expect("server captures provider test request");
    server.join().expect("mock provider server exits");
    assert!(request_text.starts_with("POST /v1/chat/completions HTTP/1.1"));
    assert!(request_text.contains(r#""model":"model-a""#));

    let error = agent_turn_submit(&runtime, &workspace.id, None, "Break this down")
        .expect_err("testing settings does not unlock or persist the agent provider");
    assert_eq!(error, CommandError::MissingLlmProviderSettings);
}

#[test]
fn command_test_llm_settings_validates_local_config_before_network() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");

    let error = settings_test_llm(&runtime, "", "test-key", "model-a", 5)
        .expect_err("invalid local config is rejected before provider transport");

    assert_eq!(error, CommandError::InvalidLlmSettings);
}

#[test]
fn command_test_llm_settings_maps_provider_failure_to_provider_error() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let (base_url, captured_request, server) = start_openai_compatible_status_server(
        "401 Unauthorized",
        r#"{"error":{"message":"bad key"}}"#.to_string(),
    );

    let error = settings_test_llm(&runtime, &base_url, "bad-key", "model-a", 5)
        .expect_err("provider failure is surfaced without saving settings");

    assert_eq!(error, CommandError::Provider);
    captured_request
        .recv()
        .expect("server captures failed provider test request");
    server.join().expect("mock provider server exits");
}

#[test]
fn command_exports_and_imports_vault_markdown_without_making_vault_authoritative() {
    let runtime = CommandRuntime::in_memory().expect("command runtime opens");
    let workspace = workspace_open_default(&runtime).expect("workspace opens");
    let task = node_create(&runtime, &workspace.id, NodeKind::Task, "Plan launch")
        .expect("task node created");
    let action = node_create(
        &runtime,
        &workspace.id,
        NodeKind::NextAction,
        "Find examples",
    )
    .expect("next action node created");
    edge_create(
        &runtime,
        &workspace.id,
        &task.id,
        &action.id,
        EdgeKind::Related,
    )
    .expect("edge created");

    let exported = vault_export(&runtime, &workspace.id).expect("vault export succeeds");

    assert_eq!(exported.files.len(), 2);
    assert!(exported.files[0].content.contains("mindlattice_id: node-1"));
    assert!(exported.files[0]
        .content
        .contains("- related: [[Find examples]]"));

    let imported = vault_import(
        &runtime,
        &workspace.id,
        vec![
            VaultImportFileDto {
                filename: "Imported task.md".to_string(),
                content: "# Imported task\nConnect to [[Imported note]].".to_string(),
            },
            VaultImportFileDto {
                filename: "Imported note.md".to_string(),
                content: "# Imported note\nKeep this as reference.".to_string(),
            },
        ],
    )
    .expect("vault import succeeds");
    let snapshot = map_get(&runtime, &workspace.id).expect("map reloads");

    assert_eq!(imported.nodes_created, 2);
    assert_eq!(imported.edges_created, 1);
    assert!(snapshot
        .nodes
        .iter()
        .any(|node| node.title == "Imported task"));
    assert!(snapshot
        .edges
        .iter()
        .any(|edge| edge.kind == EdgeKind::Related
            && edge.source_id.starts_with("vault-node-imported-task")
            && edge.target_id.starts_with("vault-node-imported-note")));
}
