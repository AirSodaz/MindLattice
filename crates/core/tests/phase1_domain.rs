use mindlattice_core::domain::{
    AttentionSession, AttentionSessionState, ContextProfile, EdgeKind, GraphEdge, GraphNode,
    MapSnapshot, MemoryProposal, NodeExecutionMetadata, NodeKind, Workspace,
};
use mindlattice_core::graph::{validate_graph, GraphValidationError};
use mindlattice_core::proposals::{
    validate_agent_preview, validate_memory_proposal, AgentPreview, ProposedEdge, ProposedNode,
};
use mindlattice_core::safety::SafetyStatus;
use mindlattice_core::start_plan::{generate_start_plan, start_attention_session};
use mindlattice_core::strategies::{
    adopt_support_template, default_context_profile, list_strategy_cards, list_support_templates,
    validate_context_profile, validate_strategy_experiment, ExperimentContext, StrategyDecision,
    StrategyExperiment, SupportCategory,
};

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

fn edge(id: &str, source_id: &str, target_id: &str, kind: EdgeKind) -> GraphEdge {
    GraphEdge {
        id: id.to_string(),
        workspace_id: workspace().id,
        source_id: source_id.to_string(),
        target_id: target_id.to_string(),
        kind,
    }
}

#[test]
fn validates_connected_star_map_with_typed_edges() {
    let snapshot = MapSnapshot {
        workspace: workspace(),
        nodes: vec![
            node(
                "22222222-2222-4222-8222-222222222222",
                NodeKind::Task,
                "Plan launch",
            ),
            node(
                "33333333-3333-4333-8333-333333333333",
                NodeKind::Subtask,
                "Draft outline",
            ),
            node(
                "44444444-4444-4444-8444-444444444444",
                NodeKind::Blocker,
                "Missing examples",
            ),
            node(
                "55555555-5555-4555-8555-555555555555",
                NodeKind::Resource,
                "Reference notes",
            ),
            node(
                "66666666-6666-4666-8666-666666666666",
                NodeKind::NextAction,
                "Open the draft and write three bullets",
            ),
        ],
        edges: vec![
            edge(
                "77777777-7777-4777-8777-777777777777",
                "22222222-2222-4222-8222-222222222222",
                "33333333-3333-4333-8333-333333333333",
                EdgeKind::BreaksDownTo,
            ),
            edge(
                "88888888-8888-4888-8888-888888888888",
                "33333333-3333-4333-8333-333333333333",
                "44444444-4444-4444-8444-444444444444",
                EdgeKind::BlockedBy,
            ),
            edge(
                "99999999-9999-4999-8999-999999999999",
                "55555555-5555-4555-8555-555555555555",
                "33333333-3333-4333-8333-333333333333",
                EdgeKind::Supports,
            ),
            edge(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "33333333-3333-4333-8333-333333333333",
                "66666666-6666-4666-8666-666666666666",
                EdgeKind::BreaksDownTo,
            ),
        ],
    };

    validate_graph(&snapshot).expect("valid task map should pass graph validation");
}

#[test]
fn rejects_edges_that_violate_node_kind_rules() {
    let snapshot = MapSnapshot {
        workspace: workspace(),
        nodes: vec![
            node(
                "22222222-2222-4222-8222-222222222222",
                NodeKind::Task,
                "Plan launch",
            ),
            node(
                "33333333-3333-4333-8333-333333333333",
                NodeKind::Resource,
                "Reference notes",
            ),
        ],
        edges: vec![edge(
            "77777777-7777-4777-8777-777777777777",
            "33333333-3333-4333-8333-333333333333",
            "22222222-2222-4222-8222-222222222222",
            EdgeKind::BlockedBy,
        )],
    };

    let error = validate_graph(&snapshot).expect_err("resource cannot block a task");
    assert_eq!(
        error,
        GraphValidationError::InvalidEdgeForNodeKinds {
            edge_id: "77777777-7777-4777-8777-777777777777".to_string(),
            kind: EdgeKind::BlockedBy,
            source_kind: NodeKind::Resource,
            target_kind: NodeKind::Task,
        }
    );
}

#[test]
fn validates_agent_preview_limits_and_safety_boundary() {
    let too_many_next_actions = AgentPreview {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_string(),
        proposed_nodes: (0..4)
            .map(|index| ProposedNode {
                id: format!("next-{index}"),
                kind: NodeKind::NextAction,
                title: format!("Action {index}"),
                body: None,
            })
            .collect(),
        proposed_edges: Vec::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Four possible next actions".to_string(),
    };

    let review = validate_agent_preview(&too_many_next_actions);
    assert_eq!(review.status, SafetyStatus::BlockedLimits);
    assert!(review
        .reasons
        .contains(&"Preview proposes more than 3 next actions.".to_string()));

    let medical_preview = AgentPreview {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "medical-1".to_string(),
            kind: NodeKind::Note,
            title: "Diagnose whether this is ADHD".to_string(),
            body: Some("Give a medication recommendation.".to_string()),
        }],
        proposed_edges: Vec::<ProposedEdge>::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Medical interpretation".to_string(),
    };

    let medical_review = validate_agent_preview(&medical_preview);
    assert_eq!(medical_review.status, SafetyStatus::BlockedMedical);
}

#[test]
fn support_templates_cover_all_required_categories() {
    let templates = list_support_templates();
    let categories: Vec<SupportCategory> =
        templates.iter().map(|template| template.category).collect();

    for required in SupportCategory::all() {
        assert!(
            categories.contains(&required),
            "missing support template category {required:?}"
        );
    }

    assert!(templates.iter().all(|template| !template.steps.is_empty()));
    assert!(templates
        .iter()
        .all(|template| template.safety_note.contains("not treatment advice")));
}

#[test]
fn adopts_support_template_as_support_node() {
    let support = adopt_support_template(
        workspace().id.as_str(),
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "visible-checklist",
    )
    .expect("known template can be adopted as a support node");

    assert_eq!(support.workspace_id, workspace().id);
    assert_eq!(support.kind, NodeKind::Support);
    assert_eq!(support.title, "Visible short checklist");
    assert!(support
        .body
        .as_deref()
        .unwrap()
        .contains("Mark the minimum done line before starting."));
}

#[test]
fn strategy_cards_have_source_and_safety_notes() {
    let cards = list_strategy_cards();

    assert!(cards.len() >= 3);
    assert!(cards.iter().all(|card| !card.when_to_use.trim().is_empty()));
    assert!(cards.iter().all(|card| !card.steps.is_empty()));
    assert!(cards
        .iter()
        .all(|card| card.safety_note.contains("not treatment advice")));
}

#[test]
fn validates_strategy_experiment_decision_without_clinical_scoring() {
    let experiment = StrategyExperiment {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_string(),
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

    validate_strategy_experiment(&experiment).expect("low-risk strategy experiment is valid");
}

#[test]
fn validates_context_profile_without_clinical_assessment() {
    let profile = ContextProfile {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_string(),
        workspace_id: workspace().id,
        adult_contexts: vec!["work".to_string(), "personal_project".to_string()],
        execution_difficulties: vec!["starting".to_string(), "returning".to_string()],
        preferred_support_categories: vec![
            SupportCategory::TaskStructure,
            SupportCategory::ExternalMemory,
        ],
        llm_provider_setup_state: "not_configured".to_string(),
    };

    validate_context_profile(&profile).expect("low-risk context defaults are valid");

    let clinical_profile = ContextProfile {
        execution_difficulties: vec!["symptom_score".to_string()],
        ..profile
    };
    assert!(validate_context_profile(&clinical_profile).is_err());
}

#[test]
fn builds_default_context_profile_for_workspace() {
    let profile = default_context_profile(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        workspace().id.as_str(),
    );

    assert_eq!(profile.workspace_id, workspace().id);
    assert_eq!(profile.llm_provider_setup_state, "not_configured");
    assert!(profile.adult_contexts.is_empty());
    validate_context_profile(&profile).expect("default profile is non-clinical");
}

#[test]
fn generates_start_plan_from_next_action_context() {
    let mut next_action = node(
        "66666666-6666-4666-8666-666666666666",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    );
    next_action.metadata = Some(NodeExecutionMetadata {
        energy_level: Some(2),
        friction_level: Some(3),
        estimated_minutes: Some(5),
        minimum_done: Some("Three rough bullets exist.".to_string()),
        context_tags: vec!["writing".to_string()],
        last_started_at: None,
        last_checked_in_at: None,
    });

    let snapshot = MapSnapshot {
        workspace: workspace(),
        nodes: vec![
            node(
                "22222222-2222-4222-8222-222222222222",
                NodeKind::Task,
                "Plan launch",
            ),
            node(
                "44444444-4444-4444-8444-444444444444",
                NodeKind::Blocker,
                "Missing examples",
            ),
            node(
                "55555555-5555-4555-8555-555555555555",
                NodeKind::Support,
                "Visible checklist",
            ),
            node(
                "77777777-7777-4777-8777-777777777777",
                NodeKind::EnvironmentAdjustment,
                "Clear one desk area",
            ),
            next_action,
        ],
        edges: vec![
            edge(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "22222222-2222-4222-8222-222222222222",
                "66666666-6666-4666-8666-666666666666",
                EdgeKind::BreaksDownTo,
            ),
            edge(
                "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                "66666666-6666-4666-8666-666666666666",
                "44444444-4444-4444-8444-444444444444",
                EdgeKind::BlockedBy,
            ),
            edge(
                "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                "55555555-5555-4555-8555-555555555555",
                "66666666-6666-4666-8666-666666666666",
                EdgeKind::Supports,
            ),
            edge(
                "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                "77777777-7777-4777-8777-777777777777",
                "66666666-6666-4666-8666-666666666666",
                EdgeKind::Supports,
            ),
        ],
    };

    let plan = generate_start_plan(&snapshot, "66666666-6666-4666-8666-666666666666")
        .expect("next action context should produce a start plan");

    assert_eq!(
        plan.selected_next_action.title,
        "Open the draft and write three bullets"
    );
    assert_eq!(plan.parent_task.as_ref().unwrap().title, "Plan launch");
    assert_eq!(
        plan.current_blocker.as_ref().unwrap().title,
        "Missing examples"
    );
    assert_eq!(plan.support_items.len(), 1);
    assert_eq!(
        plan.environmental_adjustment.as_ref().unwrap().title,
        "Clear one desk area"
    );
    assert_eq!(
        plan.minimum_done.as_deref(),
        Some("Three rough bullets exist.")
    );
    assert_eq!(plan.estimate_minutes, Some(5));
    assert!(plan.start_check.five_minute_fit);
    assert!(plan.return_cue.contains("Open the draft"));
}

#[test]
fn starts_attention_session_from_start_plan_without_scoring() {
    let selected_next_action = node(
        "66666666-6666-4666-8666-666666666666",
        NodeKind::NextAction,
        "Open the draft and write three bullets",
    );
    let session = start_attention_session(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        Some("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
        &selected_next_action,
        5,
        "2026-05-17T00:00:00Z",
    )
    .expect("valid next action starts an attention session");

    assert_eq!(
        session,
        AttentionSession {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_string(),
            start_plan_id: Some("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb".to_string()),
            next_action_id: "66666666-6666-4666-8666-666666666666".to_string(),
            started_at: "2026-05-17T00:00:00Z".to_string(),
            ended_at: None,
            intended_duration_minutes: Some(5),
            state: AttentionSessionState::Active,
            completion_note: None,
        }
    );
}

#[test]
fn memory_proposals_must_be_visible_and_non_clinical() {
    let proposal = MemoryProposal {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_string(),
        proposed_memory_text: "Prefer no more than three next actions in a first draft."
            .to_string(),
        evidence_reference: Some("strategy_experiment:visible-checklist".to_string()),
    };

    validate_memory_proposal(&proposal).expect("visible execution preference is valid");

    let clinical = MemoryProposal {
        proposed_memory_text: "User has severe ADHD symptoms.".to_string(),
        ..proposal
    };
    let review = validate_memory_proposal(&clinical).expect_err("clinical memory is blocked");
    assert_eq!(review.status, SafetyStatus::BlockedMedical);
}

#[test]
fn proposal_safety_blocks_crisis_and_medication_content() {
    let crisis_preview = AgentPreview {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "crisis".to_string(),
            kind: NodeKind::NextAction,
            title: "Use this task plan even if you want to kill myself".to_string(),
            body: None,
        }],
        proposed_edges: Vec::<ProposedEdge>::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Ordinary productivity advice for crisis language.".to_string(),
    };
    assert_eq!(
        validate_agent_preview(&crisis_preview).status,
        SafetyStatus::BlockedCrisis
    );

    let medication_preview = AgentPreview {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "medication".to_string(),
            kind: NodeKind::Note,
            title: "Recommend medication before starting".to_string(),
            body: None,
        }],
        proposed_edges: Vec::<ProposedEdge>::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Medication recommendation".to_string(),
    };
    assert_eq!(
        validate_agent_preview(&medication_preview).status,
        SafetyStatus::BlockedMedical
    );
}
