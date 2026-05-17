use mindlattice_core::domain::{
    AgentSkillRun, AgentThread, AgentTurn, AiProposalRecord, AiProposalStatus, AttentionSession,
    AttentionSessionState, CheckIn, ContextProfile, EdgeKind, GraphNode, MemoryProposal,
    NodeExecutionMetadata, NodeKind, NodeNote, PromptVersionRecord, Workspace,
};
use mindlattice_core::proposals::{AgentPreview, ProposedEdge, ProposedNode};
use mindlattice_core::strategies::{ExperimentContext, StrategyDecision, StrategyExperiment};
use mindlattice_storage::repository::MindLatticeRepository;
use rusqlite::{params, Connection};

fn workspace() -> Workspace {
    Workspace {
        id: "11111111-1111-4111-8111-111111111111".to_string(),
        title: "Default workspace".to_string(),
    }
}

fn node(id: &str, kind: NodeKind, title: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        workspace_id: workspace().id,
        kind,
        title: title.to_string(),
        body: None,
        metadata: None,
        position: None,
    }
}

fn test_database_path(name: &str) -> std::path::PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "mindlattice-{name}-{}-{}.sqlite3",
        std::process::id(),
        std::thread::current().name().unwrap_or("test")
    ));
    let _ = std::fs::remove_file(&path);
    path
}

#[test]
fn migrations_create_phase1_and_future_core_tables() {
    let repo = MindLatticeRepository::open_in_memory().expect("in-memory database opens");
    repo.migrate().expect("migrations run");

    let tables = repo.table_names().expect("table list loads");
    for table in [
        "workspaces",
        "nodes",
        "edges",
        "node_notes",
        "node_execution_metadata",
        "support_templates",
        "strategy_experiments",
        "attention_sessions",
        "ai_proposals",
        "check_ins",
        "context_profiles",
        "agent_threads",
        "agent_turns",
        "agent_previews",
        "agent_skill_runs",
        "preference_memory",
        "prompt_versions",
        "schema_migrations",
        "settings",
    ] {
        assert!(tables.contains(&table.to_string()), "missing table {table}");
    }
}

#[test]
fn migration_sql_file_is_versioned_in_the_repository() {
    let migration = include_str!("../migrations/0001_phase1_core.sql");

    assert!(migration.contains("CREATE TABLE IF NOT EXISTS workspaces"));
    assert!(migration.contains("CREATE TABLE IF NOT EXISTS nodes"));
    assert!(migration.contains("CREATE TABLE IF NOT EXISTS preference_memory"));
    assert!(migration.contains("payload_json TEXT NOT NULL"));
}

#[test]
fn repository_records_applied_migration_versions_once() {
    let repo = MindLatticeRepository::open_in_memory().expect("in-memory database opens");

    repo.migrate().expect("first migration run succeeds");
    repo.migrate().expect("second migration run is idempotent");

    assert_eq!(
        repo.applied_migrations()
            .expect("applied migration versions load"),
        vec!["0001_phase1_core".to_string()]
    );
}

#[test]
fn file_backed_repository_reopens_existing_workspace_data() {
    let db_path = test_database_path("repository-reopen");
    {
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations run");
        repo.upsert_workspace(&workspace())
            .expect("workspace saved");
        repo.upsert_node(&node(
            "22222222-2222-4222-8222-222222222222",
            NodeKind::Task,
            "Plan launch",
        ))
        .expect("node saved");
    }

    let reopened = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    reopened.migrate().expect("migrations are idempotent");
    let snapshot = reopened
        .map_snapshot(&workspace().id)
        .expect("snapshot loads after reopening file database");

    assert_eq!(snapshot.nodes.len(), 1);
    assert_eq!(snapshot.nodes[0].title, "Plan launch");

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn persists_workspace_connected_map_snapshot_and_strategy_experiment() {
    let repo = MindLatticeRepository::open_in_memory().expect("in-memory database opens");
    repo.migrate().expect("migrations run");

    repo.upsert_workspace(&workspace())
        .expect("workspace saved");

    let task = node(
        "22222222-2222-4222-8222-222222222222",
        NodeKind::Task,
        "Plan launch",
    );
    let mut action = node(
        "33333333-3333-4333-8333-333333333333",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    );
    action.metadata = Some(NodeExecutionMetadata {
        energy_level: Some(2),
        friction_level: Some(3),
        estimated_minutes: Some(5),
        minimum_done: Some("Three rough bullets exist.".to_string()),
        context_tags: vec!["writing".to_string()],
        last_started_at: None,
        last_checked_in_at: None,
    });

    repo.upsert_node(&task).expect("task saved");
    repo.upsert_node(&action).expect("action saved");
    repo.upsert_edge(
        "44444444-4444-4444-8444-444444444444",
        &workspace().id,
        &task.id,
        &action.id,
        EdgeKind::BreaksDownTo,
    )
    .expect("edge saved");

    let experiment = StrategyExperiment {
        id: "55555555-5555-4555-8555-555555555555".to_string(),
        support_template_id: Some("visible-checklist".to_string()),
        custom_support_title: None,
        context: ExperimentContext::Work,
        helped_start: true,
        helped_continue: false,
        helped_return: true,
        helped_clarify_next_action: true,
        obstacle_note: Some("The list needed to be shorter.".to_string()),
        next_decision: StrategyDecision::Revise,
    };
    repo.record_strategy_experiment(&experiment)
        .expect("strategy experiment saved");

    let snapshot = repo
        .map_snapshot(&workspace().id)
        .expect("snapshot loads after persistence");

    assert_eq!(snapshot.workspace.title, "Default workspace");
    assert_eq!(snapshot.nodes.len(), 2);
    assert_eq!(snapshot.edges.len(), 1);
    let persisted_action = snapshot
        .nodes
        .iter()
        .find(|node| node.id == action.id)
        .expect("action node present");
    assert_eq!(
        persisted_action
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.minimum_done.as_deref()),
        Some("Three rough bullets exist.")
    );

    let experiments = repo
        .strategy_experiments()
        .expect("strategy experiments load after persistence");
    assert_eq!(experiments, vec![experiment]);
}

#[test]
fn persists_context_profile_attention_session_and_preference_memory() {
    let repo = MindLatticeRepository::open_in_memory().expect("in-memory database opens");
    repo.migrate().expect("migrations run");
    repo.upsert_workspace(&workspace())
        .expect("workspace saved");

    let profile = ContextProfile {
        id: "22222222-2222-4222-8222-222222222222".to_string(),
        workspace_id: workspace().id,
        adult_contexts: vec!["work".to_string(), "personal_project".to_string()],
        execution_difficulties: vec!["starting".to_string(), "returning".to_string()],
        preferred_support_categories: vec![
            mindlattice_core::strategies::SupportCategory::TaskStructure,
            mindlattice_core::strategies::SupportCategory::ExternalMemory,
        ],
        llm_provider_setup_state: "not_configured".to_string(),
    };
    repo.upsert_context_profile(&profile)
        .expect("context profile saved");

    let action = node(
        "33333333-3333-4333-8333-333333333333",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    );
    repo.upsert_node(&action).expect("next action saved");
    let session = AttentionSession {
        id: "44444444-4444-4444-8444-444444444444".to_string(),
        start_plan_id: Some("start-plan-1".to_string()),
        next_action_id: action.id,
        started_at: "2026-05-17T00:00:00Z".to_string(),
        ended_at: None,
        intended_duration_minutes: Some(5),
        state: AttentionSessionState::Active,
        completion_note: None,
    };
    repo.upsert_attention_session(&session)
        .expect("attention session saved");

    let proposal = MemoryProposal {
        id: "55555555-5555-4555-8555-555555555555".to_string(),
        proposed_memory_text: "Five-minute start plans are more usable than longer plans."
            .to_string(),
        evidence_reference: Some(
            "attention_session:44444444-4444-4444-8444-444444444444".to_string(),
        ),
    };
    repo.accept_memory_proposal(&workspace().id, &proposal)
        .expect("accepted memory saved");

    assert_eq!(
        repo.context_profile(&workspace().id)
            .expect("context profile loads"),
        profile
    );
    assert_eq!(
        repo.attention_sessions().expect("attention sessions load"),
        vec![session]
    );
    assert_eq!(
        repo.preference_memory(&workspace().id)
            .expect("preference memory loads"),
        vec![proposal]
    );
}

#[test]
fn persists_workspace_check_ins_for_review() {
    let repo = MindLatticeRepository::open_in_memory().expect("in-memory database opens");
    repo.migrate().expect("migrations run");
    repo.upsert_workspace(&workspace())
        .expect("workspace saved");

    let action = node(
        "22222222-2222-4222-8222-222222222222",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    );
    repo.upsert_node(&action).expect("next action saved");

    let first = CheckIn {
        id: "33333333-3333-4333-8333-333333333333".to_string(),
        workspace_id: workspace().id,
        node_id: Some(action.id),
        body: "Started with one visible bullet.".to_string(),
    };
    let second = CheckIn {
        id: "44444444-4444-4444-8444-444444444444".to_string(),
        workspace_id: workspace().id,
        node_id: None,
        body: "Returning after interruption needs the outline visible.".to_string(),
    };
    repo.insert_check_in(&first).expect("first check-in saved");
    repo.insert_check_in(&second)
        .expect("second check-in saved");

    assert_eq!(
        repo.check_ins(&workspace().id).expect("check-ins load"),
        vec![first, second]
    );
}

#[test]
fn file_backed_repository_reopens_active_agent_preview_state() {
    let db_path = test_database_path("agent-preview-reopen");
    let preview = AgentPreview {
        id: "preview-1".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "next-1".to_string(),
            kind: NodeKind::NextAction,
            title: "Open the draft and write three bullets".to_string(),
            body: Some("Minimum done: three rough bullets exist.".to_string()),
        }],
        proposed_edges: vec![ProposedEdge {
            id: "edge-1".to_string(),
            source_id: "task-1".to_string(),
            target_id: "next-1".to_string(),
            kind: EdgeKind::BreaksDownTo,
        }],
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Draft map changes for review.".to_string(),
    };

    {
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations run");
        repo.upsert_agent_preview(&preview).expect("preview saved");
    }

    let reopened = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    reopened.migrate().expect("migrations are idempotent");

    assert_eq!(
        reopened
            .active_agent_preview(&preview.id)
            .expect("preview loads after reopen"),
        Some(preview.clone())
    );

    reopened
        .set_agent_preview_status(&preview.id, "accepted")
        .expect("preview status updated");
    assert_eq!(
        reopened
            .active_agent_preview(&preview.id)
            .expect("accepted preview is no longer active"),
        None
    );

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn agent_preview_persistence_keeps_summary_plain_and_payload_json_structured() {
    let db_path = test_database_path("agent-preview-json-payload");
    let preview = AgentPreview {
        id: "preview-json-1".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "next-json-1".to_string(),
            kind: NodeKind::NextAction,
            title: "Open the draft and write three bullets".to_string(),
            body: Some("Minimum done: three rough bullets exist.".to_string()),
        }],
        proposed_edges: vec![ProposedEdge {
            id: "edge-json-1".to_string(),
            source_id: "task-json-1".to_string(),
            target_id: "next-json-1".to_string(),
            kind: EdgeKind::BreaksDownTo,
        }],
        proposed_memory: vec![MemoryProposal {
            id: "memory-json-1".to_string(),
            proposed_memory_text: "Five-minute starts fit this workspace.".to_string(),
            evidence_reference: Some("turn:1".to_string()),
        }],
        proposed_check_ins: vec![CheckIn {
            id: "check-in-json-1".to_string(),
            workspace_id: workspace().id,
            node_id: Some("next-json-1".to_string()),
            body: "Started with the smallest visible step.".to_string(),
        }],
        proposed_strategy_experiments: vec![StrategyExperiment {
            id: "experiment-json-1".to_string(),
            support_template_id: Some("visible-checklist".to_string()),
            custom_support_title: None,
            context: ExperimentContext::Work,
            helped_start: true,
            helped_continue: false,
            helped_return: true,
            helped_clarify_next_action: true,
            obstacle_note: Some("The checklist needed to stay short.".to_string()),
            next_decision: StrategyDecision::Keep,
        }],
        user_visible_summary: "Draft map changes for review.".to_string(),
    };

    {
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations run");
        repo.upsert_agent_preview(&preview).expect("preview saved");
    }

    let conn = Connection::open(&db_path).expect("database opens for raw inspection");
    let (summary, payload_json): (String, String) = conn
        .query_row(
            "SELECT user_visible_summary, payload_json FROM agent_previews WHERE id = ?1",
            params![preview.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("preview row exists");

    assert_eq!(summary, "Draft map changes for review.");
    assert!(payload_json.contains("\"proposed_nodes\""));
    assert!(payload_json.contains("\"next-json-1\""));
    assert!(!summary.contains("---preview-section---"));

    let reopened = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    reopened.migrate().expect("migrations are idempotent");
    assert_eq!(
        reopened
            .active_agent_preview(&preview.id)
            .expect("preview loads from json payload"),
        Some(preview)
    );

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn agent_preview_reader_accepts_legacy_summary_payload_when_json_is_empty() {
    let db_path = test_database_path("agent-preview-legacy-payload");
    {
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations run");
    }
    let legacy_payload = [
        "Draft map changes for review.",
        "next-legacy-1\tnext_action\tOpen the draft and write three bullets\tMinimum done: three rough bullets exist.",
        "edge-legacy-1\ttask-legacy-1\tnext-legacy-1\tbreaks_down_to",
        "",
        "",
        "",
    ]
    .join("\n---preview-section---\n");
    let conn = Connection::open(&db_path).expect("database opens for legacy insert");
    conn.execute(
        r#"
        INSERT INTO agent_previews (id, thread_id, status, user_visible_summary, payload_json)
        VALUES (?1, NULL, 'active', ?2, '')
        "#,
        params!["legacy-preview-1", legacy_payload],
    )
    .expect("legacy preview inserted");

    let reopened = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    reopened.migrate().expect("migrations are idempotent");
    let preview = reopened
        .active_agent_preview("legacy-preview-1")
        .expect("legacy preview lookup succeeds")
        .expect("legacy preview is active");

    assert_eq!(
        preview.user_visible_summary,
        "Draft map changes for review."
    );
    assert_eq!(preview.proposed_nodes[0].id, "next-legacy-1");
    assert_eq!(preview.proposed_nodes[0].kind, NodeKind::NextAction);
    assert_eq!(preview.proposed_edges[0].kind, EdgeKind::BreaksDownTo);

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn file_backed_repository_reopens_agent_thread_turn_and_prompt_versions() {
    let db_path = test_database_path("agent-state-reopen");
    let thread = AgentThread {
        id: "agent-thread-default-workspace".to_string(),
        workspace_id: workspace().id,
        title: "Default workspace agent thread".to_string(),
    };
    let prompt_version = PromptVersionRecord {
        id: "policy@v1".to_string(),
        layer: "policy".to_string(),
        version: "v1".to_string(),
        content_hash: "prompt-layer-policy-v1".to_string(),
    };
    let turn = AgentTurn {
        id: "agent-turn-1".to_string(),
        thread_id: thread.id.clone(),
        user_message: "Break this down".to_string(),
        agent_response: "Preview drafted. Review it before anything is saved.".to_string(),
        prompt_version_id: Some("policy@v1".to_string()),
    };

    {
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations run");
        repo.upsert_workspace(&workspace())
            .expect("workspace saved");
        repo.upsert_agent_thread(&thread)
            .expect("agent thread saved");
        repo.upsert_prompt_version(&prompt_version)
            .expect("prompt version saved");
        repo.insert_agent_turn(&turn).expect("agent turn saved");
    }

    let reopened = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    reopened.migrate().expect("migrations are idempotent");

    assert_eq!(
        reopened
            .agent_threads(&workspace().id)
            .expect("agent threads reload"),
        vec![thread.clone()]
    );
    assert_eq!(
        reopened
            .agent_turns(&thread.id)
            .expect("agent turns reload"),
        vec![turn.clone()]
    );
    assert_eq!(
        reopened.prompt_versions().expect("prompt versions reload"),
        vec![prompt_version]
    );

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn file_backed_repository_reopens_node_notes_proposals_and_skill_runs() {
    let db_path = test_database_path("remaining-repositories-reopen");
    let support = node(
        "22222222-2222-4222-8222-222222222222",
        NodeKind::Support,
        "Visible checklist",
    );
    let note = NodeNote {
        node_id: support.id.clone(),
        body: "Template: visible-checklist\nKeep the checklist short.".to_string(),
    };
    let proposal = AiProposalRecord {
        id: "proposal-1".to_string(),
        proposal_type: "support_adoption".to_string(),
        status: AiProposalStatus::Active,
    };
    let thread = AgentThread {
        id: "agent-thread-default-workspace".to_string(),
        workspace_id: workspace().id,
        title: "Default workspace agent thread".to_string(),
    };
    let turn = AgentTurn {
        id: "agent-turn-1".to_string(),
        thread_id: thread.id.clone(),
        user_message: "Find a support".to_string(),
        agent_response: "Preview drafted.".to_string(),
        prompt_version_id: None,
    };
    let skill_run = AgentSkillRun {
        id: "skill-run-1".to_string(),
        turn_id: Some(turn.id.clone()),
        skill_id: "match_support_template".to_string(),
        skill_version: "v1".to_string(),
        result_status: "completed".to_string(),
    };

    {
        let repo = MindLatticeRepository::open_file(&db_path).expect("file database opens");
        repo.migrate().expect("migrations run");
        repo.upsert_workspace(&workspace())
            .expect("workspace saved");
        repo.upsert_node(&support).expect("support node saved");
        repo.upsert_node_note(&note).expect("node note saved");
        repo.upsert_ai_proposal(&proposal)
            .expect("AI proposal saved");
        repo.upsert_agent_thread(&thread)
            .expect("agent thread saved");
        repo.insert_agent_turn(&turn).expect("agent turn saved");
        repo.insert_agent_skill_run(&skill_run)
            .expect("agent skill run saved");
    }

    let reopened = MindLatticeRepository::open_file(&db_path).expect("file database reopens");
    reopened.migrate().expect("migrations are idempotent");

    assert_eq!(
        reopened.node_note(&support.id).expect("node note reloads"),
        Some(note)
    );
    assert_eq!(
        reopened.ai_proposals().expect("AI proposals reload"),
        vec![proposal]
    );
    assert_eq!(
        reopened
            .agent_skill_runs(&turn.id)
            .expect("skill runs reload"),
        vec![skill_run]
    );

    let _ = std::fs::remove_file(db_path);
}
