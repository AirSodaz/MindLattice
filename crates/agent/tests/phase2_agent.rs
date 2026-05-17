use std::sync::Arc;

use mindlattice_agent::loop_state::{
    run_agent_turn, AgentError, AgentTurnRequest, AgentTurnResponseKind, AgentTurnRuntime,
    MockLlmProvider,
};
use mindlattice_agent::memory::retrieve_relevant_preferences;
use mindlattice_agent::prompts::{
    assemble_prompt_layers, prompt_asset_manifest, prompt_golden_fixtures,
};
use mindlattice_agent::skills::{initial_skill_specs, AgentIntent};
use mindlattice_agent::tools::{
    initial_tool_registry, validate_skill_tool_contracts, AgentToolInput, AgentToolOutput,
    AgentToolRouter, ToolRunError,
};
use mindlattice_core::domain::{
    CheckIn, EdgeKind, GraphEdge, GraphNode, MapSnapshot, MemoryProposal, NodeKind, Workspace,
};
use mindlattice_core::proposals::{AgentPreview, ProposedNode};
use mindlattice_core::strategies::{ExperimentContext, StrategyDecision, StrategyExperiment};

fn workspace() -> Workspace {
    Workspace {
        id: "11111111-1111-4111-8111-111111111111".to_string(),
        title: "Default workspace".to_string(),
    }
}

fn task_node() -> GraphNode {
    GraphNode {
        id: "22222222-2222-4222-8222-222222222222".to_string(),
        workspace_id: workspace().id,
        kind: NodeKind::Task,
        title: "Plan launch".to_string(),
        body: None,
        metadata: None,
        position: None,
    }
}

fn snapshot() -> MapSnapshot {
    MapSnapshot {
        workspace: workspace(),
        nodes: vec![task_node()],
        edges: Vec::<GraphEdge>::new(),
    }
}

fn llm(provider: MockLlmProvider) -> Arc<MockLlmProvider> {
    Arc::new(provider)
}

#[test]
fn initial_skill_specs_cover_required_first_release_skills() {
    let skills = initial_skill_specs();
    let ids = skills
        .iter()
        .map(|skill| skill.id.as_str())
        .collect::<Vec<_>>();

    for expected in [
        "capture_messy_task",
        "decompose_to_star_map",
        "identify_blockers",
        "find_smaller_next_action",
        "match_support_template",
        "draft_start_plan",
        "revise_graph_preview",
        "summarize_check_in",
        "extract_preference_from_experiment",
        "safe_redirect_for_crisis_or_medical_content",
    ] {
        assert!(ids.contains(&expected), "missing skill {expected}");
    }

    assert!(skills.iter().all(|skill| skill.version == 1));
    assert!(skills.iter().all(|skill| !skill.allowed_tools.is_empty()));
    assert!(skills.iter().all(|skill| !skill.golden_cases.is_empty()));
}

#[test]
fn initial_tool_registry_covers_documented_agent_tools() {
    let tools = initial_tool_registry();
    let ids = tools.iter().map(|tool| tool.id).collect::<Vec<_>>();

    assert_eq!(
        ids,
        vec![
            "map.summarize",
            "map.propose_nodes_edges",
            "map.revise_preview",
            "proposal.validate",
            "proposal.accept",
            "support.search_templates",
            "start_plan.generate",
            "check_in.propose",
            "strategy_experiment.propose",
            "memory.retrieve_preferences",
            "memory.propose_update",
            "safety.review",
            "vault.preview_import"
        ]
    );
    assert!(tools.iter().all(|tool| !tool.input_schema.is_empty()));
    assert!(tools.iter().all(|tool| !tool.output_schema.is_empty()));
}

#[test]
fn skill_allowed_tools_are_registered_contracts() {
    validate_skill_tool_contracts(&initial_skill_specs(), &initial_tool_registry())
        .expect("first-release skills use only registered tool contracts");
}

#[test]
fn typed_tool_router_runs_memory_retrieval_contract() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let output = router
        .run(
            "memory.retrieve_preferences",
            AgentToolInput::MemoryRetrieval {
                user_message: "Return to the draft after interruption.".to_string(),
                confirmed_memory: vec![
                    "Prefer one visible next action after interruptions.".to_string(),
                    "Prefer quiet color themes.".to_string(),
                ],
                limit: 1,
            },
        )
        .expect("registered memory tool runs");

    assert_eq!(
        output,
        AgentToolOutput::PreferenceMemoryMatches(vec![
            "Prefer one visible next action after interruptions.".to_string()
        ])
    );
}

#[test]
fn typed_tool_router_runs_memory_proposal_contract_without_persistence() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let proposal = MemoryProposal {
        id: "memory-proposal-1".to_string(),
        proposed_memory_text: "Prefer one visible next action after interruptions.".to_string(),
        evidence_reference: Some("check-in-1".to_string()),
    };

    let output = router
        .run(
            "memory.propose_update",
            AgentToolInput::MemoryProposal(proposal.clone()),
        )
        .expect("registered memory proposal tool runs");

    assert_eq!(output, AgentToolOutput::MemoryProposal(proposal));

    let clinical = MemoryProposal {
        id: "memory-proposal-2".to_string(),
        proposed_memory_text: "Severe ADHD symptoms require medication.".to_string(),
        evidence_reference: None,
    };
    let error = router
        .run(
            "memory.propose_update",
            AgentToolInput::MemoryProposal(clinical),
        )
        .expect_err("clinical memory proposal should be blocked");

    assert!(matches!(
        error,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "memory.propose_update"
    ));
}

#[test]
fn typed_tool_router_runs_safety_review_contract() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let output = router
        .run(
            "safety.review",
            AgentToolInput::SafetyReview {
                text: "Should I stop medication to focus?".to_string(),
            },
        )
        .expect("registered safety tool runs");

    match output {
        AgentToolOutput::SafetyReview(review) => {
            assert_eq!(
                review.status,
                mindlattice_core::safety::SafetyStatus::BlockedMedical
            );
        }
        other => panic!("unexpected tool output: {other:?}"),
    }
}

#[test]
fn typed_tool_router_runs_proposal_validation_contract() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let preview = AgentPreview {
        id: "preview-1".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "medical-1".to_string(),
            kind: NodeKind::Note,
            title: "Recommend medication before starting".to_string(),
            body: None,
        }],
        proposed_edges: Vec::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Medical suggestion".to_string(),
    };

    let output = router
        .run("proposal.validate", AgentToolInput::AgentPreview(preview))
        .expect("registered proposal validation tool runs");

    match output {
        AgentToolOutput::SafetyReview(review) => {
            assert_eq!(
                review.status,
                mindlattice_core::safety::SafetyStatus::BlockedMedical
            );
        }
        other => panic!("unexpected tool output: {other:?}"),
    }
}

#[test]
fn typed_tool_router_runs_start_plan_generation_contract() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let output = router
        .run(
            "start_plan.generate",
            AgentToolInput::StartPlan {
                snapshot: snapshot(),
                next_action_id: task_node().id,
            },
        )
        .expect_err("task node is not a next action");

    assert!(matches!(
        output,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "start_plan.generate"
    ));

    let next_action = GraphNode {
        id: "33333333-3333-4333-8333-333333333333".to_string(),
        workspace_id: workspace().id,
        kind: NodeKind::NextAction,
        title: "Open the draft and write three bullets".to_string(),
        body: None,
        metadata: None,
        position: None,
    };
    let map = MapSnapshot {
        workspace: workspace(),
        nodes: vec![task_node(), next_action.clone()],
        edges: vec![GraphEdge {
            id: "edge-1".to_string(),
            workspace_id: workspace().id,
            source_id: task_node().id,
            target_id: next_action.id.clone(),
            kind: EdgeKind::BreaksDownTo,
        }],
    };

    let output = router
        .run(
            "start_plan.generate",
            AgentToolInput::StartPlan {
                snapshot: map,
                next_action_id: next_action.id,
            },
        )
        .expect("registered start-plan tool runs");

    match output {
        AgentToolOutput::StartPlan(plan) => {
            assert_eq!(
                plan.selected_next_action.title,
                "Open the draft and write three bullets"
            );
            assert_eq!(plan.parent_task.expect("parent task").title, "Plan launch");
        }
        other => panic!("unexpected tool output: {other:?}"),
    }
}

#[test]
fn typed_tool_router_runs_support_search_contract() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let output = router
        .run(
            "support.search_templates",
            AgentToolInput::SupportSearch {
                query: "I need a return cue after interruptions.".to_string(),
                limit: 2,
            },
        )
        .expect("registered support-search tool runs");

    match output {
        AgentToolOutput::SupportTemplateMatches(matches) => {
            assert_eq!(matches[0].id, "return-cue");
            assert!(matches
                .iter()
                .all(|template| !template.safety_note.is_empty()));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }
}

#[test]
fn typed_tool_router_runs_map_summary_contract() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let next_action = GraphNode {
        id: "33333333-3333-4333-8333-333333333333".to_string(),
        workspace_id: workspace().id,
        kind: NodeKind::NextAction,
        title: "Open the draft and write three bullets".to_string(),
        body: None,
        metadata: None,
        position: None,
    };
    let map = MapSnapshot {
        workspace: workspace(),
        nodes: vec![task_node(), next_action],
        edges: vec![GraphEdge {
            id: "edge-1".to_string(),
            workspace_id: workspace().id,
            source_id: task_node().id,
            target_id: "33333333-3333-4333-8333-333333333333".to_string(),
            kind: EdgeKind::BreaksDownTo,
        }],
    };

    let output = router
        .run("map.summarize", AgentToolInput::MapSummary(map))
        .expect("registered map summary tool runs");

    match output {
        AgentToolOutput::MapSummary(summary) => {
            assert_eq!(summary.workspace_id, "11111111-1111-4111-8111-111111111111");
            assert_eq!(summary.node_count, 2);
            assert_eq!(summary.edge_count, 1);
            assert_eq!(summary.next_action_count, 1);
            assert_eq!(summary.blocker_count, 0);
            assert!(summary.focus_titles.contains(&"Plan launch".to_string()));
            assert!(summary
                .focus_titles
                .contains(&"Open the draft and write three bullets".to_string()));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }
}

#[test]
fn typed_tool_router_runs_map_proposal_contract_without_persistence() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let preview = AgentPreview {
        id: "preview-map-1".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "next-1".to_string(),
            kind: NodeKind::NextAction,
            title: "Open the draft and write three bullets".to_string(),
            body: Some("Minimum done: three bullets are visible.".to_string()),
        }],
        proposed_edges: Vec::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Draft map changes for review.".to_string(),
    };

    let output = router
        .run(
            "map.propose_nodes_edges",
            AgentToolInput::MapProposal(preview.clone()),
        )
        .expect("registered map proposal tool runs");

    assert_eq!(output, AgentToolOutput::AgentPreview(preview));

    let unsafe_preview = AgentPreview {
        id: "preview-map-2".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "medical-1".to_string(),
            kind: NodeKind::Note,
            title: "Recommend medication before starting".to_string(),
            body: None,
        }],
        proposed_edges: Vec::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Medical suggestion".to_string(),
    };
    let error = router
        .run(
            "map.propose_nodes_edges",
            AgentToolInput::MapProposal(unsafe_preview),
        )
        .expect_err("unsafe map proposal should be blocked");

    assert!(matches!(
        error,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "map.propose_nodes_edges"
    ));
}

#[test]
fn typed_tool_router_runs_map_revision_contract_without_persistence() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let revised_preview = AgentPreview {
        id: "preview-map-1-revised".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "blocker-1".to_string(),
            kind: NodeKind::Blocker,
            title: "Missing source material".to_string(),
            body: None,
        }],
        proposed_edges: Vec::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Revised map preview for review.".to_string(),
    };

    let output = router
        .run(
            "map.revise_preview",
            AgentToolInput::MapRevision(revised_preview.clone()),
        )
        .expect("registered map revision tool runs");

    assert_eq!(output, AgentToolOutput::AgentPreview(revised_preview));
}

#[test]
fn typed_tool_router_runs_proposal_accept_contract_as_write_plan() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let preview = AgentPreview {
        id: "preview-map-1".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "next-1".to_string(),
            kind: NodeKind::NextAction,
            title: "Open the draft and write three bullets".to_string(),
            body: None,
        }],
        proposed_edges: vec![mindlattice_core::proposals::ProposedEdge {
            id: "edge-1".to_string(),
            source_id: task_node().id,
            target_id: "next-1".to_string(),
            kind: EdgeKind::BreaksDownTo,
        }],
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Draft map changes for review.".to_string(),
    };

    let output = router
        .run(
            "proposal.accept",
            AgentToolInput::PreviewAccept {
                workspace_id: workspace().id,
                preview: preview.clone(),
                existing_node_ids: vec![task_node().id],
            },
        )
        .expect("registered proposal accept tool runs");

    match output {
        AgentToolOutput::AcceptedPreview(accepted) => {
            assert_eq!(accepted.preview_id, "preview-map-1");
            assert_eq!(accepted.workspace_id, workspace().id);
            assert_eq!(accepted.nodes_to_write.len(), 1);
            assert_eq!(accepted.nodes_to_write[0].id, "next-1");
            assert_eq!(accepted.edges_to_write.len(), 1);
            assert_eq!(accepted.edges_to_write[0].id, "edge-1");
            assert!(accepted.user_visible_summary.contains("1 node"));
            assert!(accepted.user_visible_summary.contains("1 edge"));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }

    let unsafe_preview = AgentPreview {
        id: "preview-map-2".to_string(),
        proposed_nodes: vec![ProposedNode {
            id: "medical-1".to_string(),
            kind: NodeKind::Note,
            title: "Recommend medication before starting".to_string(),
            body: None,
        }],
        proposed_edges: Vec::new(),
        proposed_memory: Vec::new(),
        proposed_check_ins: Vec::new(),
        proposed_strategy_experiments: Vec::new(),
        user_visible_summary: "Medical suggestion".to_string(),
    };
    let error = router
        .run(
            "proposal.accept",
            AgentToolInput::PreviewAccept {
                workspace_id: workspace().id,
                preview: unsafe_preview,
                existing_node_ids: vec![task_node().id],
            },
        )
        .expect_err("unsafe accepted preview should be blocked");

    assert!(matches!(
        error,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "proposal.accept"
    ));
}

#[test]
fn proposal_accept_write_plan_includes_non_graph_preview_payloads() {
    let router = AgentToolRouter::new(initial_tool_registry());
    let memory = MemoryProposal {
        id: "memory-preview-1".to_string(),
        proposed_memory_text: "Prefer a visible resume note after interruptions.".to_string(),
        evidence_reference: Some("check-in-preview-1".to_string()),
    };
    let check_in = CheckIn {
        id: "check-in-preview-1".to_string(),
        workspace_id: workspace().id,
        node_id: None,
        body: "Started, then got stuck looking for the source material.".to_string(),
    };
    let experiment = StrategyExperiment {
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
    let preview = AgentPreview {
        id: "preview-non-graph-1".to_string(),
        proposed_nodes: Vec::new(),
        proposed_edges: Vec::new(),
        proposed_memory: vec![memory.clone()],
        proposed_check_ins: vec![check_in.clone()],
        proposed_strategy_experiments: vec![experiment.clone()],
        user_visible_summary: "Review follow-up records before saving.".to_string(),
    };

    let output = router
        .run(
            "proposal.accept",
            AgentToolInput::PreviewAccept {
                workspace_id: workspace().id,
                preview,
                existing_node_ids: vec![task_node().id],
            },
        )
        .expect("registered proposal accept tool runs");

    match output {
        AgentToolOutput::AcceptedPreview(accepted) => {
            assert!(accepted.nodes_to_write.is_empty());
            assert!(accepted.edges_to_write.is_empty());
            assert_eq!(accepted.memory_to_write, vec![memory]);
            assert_eq!(accepted.check_ins_to_write, vec![check_in]);
            assert_eq!(accepted.strategy_experiments_to_write, vec![experiment]);
            assert!(accepted.user_visible_summary.contains("1 memory"));
            assert!(accepted.user_visible_summary.contains("1 check-in"));
            assert!(accepted
                .user_visible_summary
                .contains("1 strategy experiment"));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }
}

#[test]
fn typed_tool_router_runs_check_in_proposal_contract_without_persistence() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let output = router
        .run(
            "check_in.propose",
            AgentToolInput::CheckInProposal {
                id: "check-in-preview-1".to_string(),
                workspace_id: workspace().id,
                node_id: Some(task_node().id),
                body: "I started, then got stuck looking for the source.".to_string(),
            },
        )
        .expect("registered check-in proposal tool runs");

    match output {
        AgentToolOutput::CheckInPreview(preview) => {
            assert_eq!(preview.id, "check-in-preview-1");
            assert_eq!(preview.workspace_id, "11111111-1111-4111-8111-111111111111");
            assert_eq!(
                preview.node_id,
                Some("22222222-2222-4222-8222-222222222222".to_string())
            );
            assert_eq!(
                preview.body,
                "I started, then got stuck looking for the source."
            );
            assert_eq!(
                preview.review.status,
                mindlattice_core::safety::SafetyStatus::Allowed
            );
            assert!(preview.user_visible_summary.contains("review"));
            assert!(!preview
                .user_visible_summary
                .to_lowercase()
                .contains("score"));
            assert!(!preview
                .user_visible_summary
                .to_lowercase()
                .contains("streak"));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }

    let blocked = router
        .run(
            "check_in.propose",
            AgentToolInput::CheckInProposal {
                id: "check-in-preview-2".to_string(),
                workspace_id: workspace().id,
                node_id: None,
                body: "Symptom score improved after this plan.".to_string(),
            },
        )
        .expect_err("symptom-score check-in proposal should be blocked");

    assert!(matches!(
        blocked,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "check_in.propose"
    ));
}

#[test]
fn typed_tool_router_runs_strategy_experiment_proposal_contract_without_persistence() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let experiment = StrategyExperiment {
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
    let output = router
        .run(
            "strategy_experiment.propose",
            AgentToolInput::StrategyExperimentProposal(experiment.clone()),
        )
        .expect("registered strategy-experiment proposal tool runs");

    match output {
        AgentToolOutput::StrategyExperimentPreview(preview) => {
            assert_eq!(preview.experiment, experiment);
            assert_eq!(
                preview.review.status,
                mindlattice_core::safety::SafetyStatus::Allowed
            );
            assert!(preview.user_visible_summary.contains("review"));
            assert!(!preview
                .user_visible_summary
                .to_lowercase()
                .contains("score"));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }

    let invalid = StrategyExperiment {
        id: "strategy-preview-2".to_string(),
        support_template_id: None,
        custom_support_title: None,
        context: ExperimentContext::Work,
        helped_start: false,
        helped_continue: false,
        helped_return: false,
        helped_clarify_next_action: false,
        obstacle_note: Some("No support reference yet.".to_string()),
        next_decision: StrategyDecision::Pause,
    };
    let error = router
        .run(
            "strategy_experiment.propose",
            AgentToolInput::StrategyExperimentProposal(invalid),
        )
        .expect_err("strategy experiment without support reference should be blocked");

    assert!(matches!(
        error,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "strategy_experiment.propose"
    ));
}

#[test]
fn typed_tool_router_runs_vault_import_preview_contract_without_persistence() {
    let router = AgentToolRouter::new(initial_tool_registry());

    let output = router
        .run(
            "vault.preview_import",
            AgentToolInput::VaultImportPreview {
                workspace_id: workspace().id,
                files: vec![
                    mindlattice_vault::markdown::VaultImportFile {
                        filename: "Plan.md".to_string(),
                        content:
                            "---\nmindlattice_id: plan\nkind: task\n---\n\n# Plan\n\nSee [[Draft]]."
                                .to_string(),
                    },
                    mindlattice_vault::markdown::VaultImportFile {
                        filename: "Draft.md".to_string(),
                        content: "# Draft\n\nWrite the first paragraph.".to_string(),
                    },
                ],
            },
        )
        .expect("registered vault import preview tool runs");

    match output {
        AgentToolOutput::VaultImportPreview(preview) => {
            assert_eq!(preview.nodes_created, 2);
            assert_eq!(preview.edges_created, 1);
            assert_eq!(preview.nodes[0].workspace_id, workspace().id);
            assert_eq!(preview.nodes[0].title, "Plan");
            assert_eq!(preview.edges[0].kind, EdgeKind::Related);
            assert!(preview.user_visible_summary.contains("review"));
            assert!(preview.user_visible_summary.contains("2 Markdown files"));
        }
        other => panic!("unexpected tool output: {other:?}"),
    }

    let empty = router
        .run(
            "vault.preview_import",
            AgentToolInput::VaultImportPreview {
                workspace_id: workspace().id,
                files: Vec::new(),
            },
        )
        .expect_err("empty Vault import preview should be rejected");

    assert!(matches!(
        empty,
        ToolRunError::ToolFailed { tool_id, .. } if tool_id == "vault.preview_import"
    ));
}

#[test]
fn typed_tool_router_rejects_unknown_or_mismatched_tool_input() {
    let router = AgentToolRouter::new(initial_tool_registry());

    assert_eq!(
        router.run(
            "unknown.tool",
            AgentToolInput::SafetyReview {
                text: "plain task".to_string(),
            },
        ),
        Err(ToolRunError::UnknownTool("unknown.tool".to_string()))
    );
    assert_eq!(
        router.run(
            "safety.review",
            AgentToolInput::MemoryRetrieval {
                user_message: "plain task".to_string(),
                confirmed_memory: Vec::new(),
                limit: 1,
            },
        ),
        Err(ToolRunError::InputSchemaMismatch {
            tool_id: "safety.review".to_string(),
            expected_schema: "safety_review_request".to_string(),
        })
    );
}

#[test]
fn memory_retrieval_selects_relevant_confirmed_preferences() {
    let matches = retrieve_relevant_preferences(
        "I keep losing my place when I return to the draft after interruptions.",
        &[
            "Prefer one visible next action after interruptions.".to_string(),
            "Use a return cue when reopening draft work.".to_string(),
            "Prefer quiet color themes.".to_string(),
        ],
        2,
    );

    assert_eq!(
        matches,
        vec![
            "Use a return cue when reopening draft work.".to_string(),
            "Prefer one visible next action after interruptions.".to_string(),
        ]
    );
}

#[test]
fn prompt_assembly_records_ordered_versions() {
    let prompt = assemble_prompt_layers("decompose_to_star_map", "User message", "Runtime context")
        .expect("known skill prompt assembles");

    assert_eq!(
        prompt.version_trace,
        vec![
            "policy@v1",
            "role@v1",
            "workflow@v1",
            "tools@v1",
            "decompose_to_star_map@v1",
            "output_style@v1"
        ]
    );
    assert!(prompt.combined.contains("confirm-before-write"));
    assert!(prompt.combined.contains("Runtime context"));
}

#[test]
fn prompt_assembly_uses_versioned_asset_layers() {
    let manifest = prompt_asset_manifest();
    let layer_ids = manifest
        .iter()
        .map(|layer| format!("{}@v{}", layer.id, layer.version))
        .collect::<Vec<_>>();

    assert_eq!(
        layer_ids,
        vec![
            "policy@v1",
            "role@v1",
            "workflow@v1",
            "tools@v1",
            "output_style@v1"
        ]
    );
    assert!(manifest
        .iter()
        .all(|layer| layer.body.contains("MindLattice")));

    let prompt = assemble_prompt_layers("draft_start_plan", "Make this smaller", "node count 3")
        .expect("known skill prompt assembles");

    assert!(prompt.combined.contains("MindLattice system policy"));
    assert!(prompt.combined.contains("confirm-before-write"));
    assert!(prompt.combined.contains("Tool contracts"));
    assert!(prompt.combined.contains("Skill: draft_start_plan"));
}

#[test]
fn prompt_golden_fixtures_cover_product_review_scenarios() {
    let fixtures = prompt_golden_fixtures();
    let ids = fixtures
        .iter()
        .map(|fixture| fixture.id)
        .collect::<Vec<_>>();

    assert_eq!(
        ids,
        vec![
            "capture_task",
            "preview_revision",
            "start_mode_drafting",
            "support_matching",
            "medical_boundary_rejection",
            "crisis_redirection"
        ]
    );

    for fixture in fixtures {
        assert!(fixture.body.contains("Skill:"));
        assert!(fixture.body.contains("User input:"));
        assert!(fixture.body.contains("Expected behavior:"));
        assert!(fixture.body.contains("Forbidden behavior:"));
        assert!(fixture.body.contains("confirm-before-write"));
    }
}

#[test]
fn agent_turn_returns_validated_preview_without_persisting() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::with_preview_nodes(vec![
            ("subtask-1", NodeKind::Subtask, "Draft outline"),
            ("blocker-1", NodeKind::Blocker, "Missing examples"),
            (
                "next-1",
                NodeKind::NextAction,
                "Open the draft and write three bullets",
            ),
        ])),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };
    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: "Break down this launch task.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect("agent turn succeeds");

    assert_eq!(response.kind, AgentTurnResponseKind::PreviewProposed);
    let preview = response.preview.expect("preview returned");
    assert_eq!(preview.proposed_nodes.len(), 3);
    assert!(response.message.contains("Preview"));
}

#[test]
fn agent_turn_parses_structured_provider_preview_content() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::with_structured_content(
            r#"{
              "id": "preview-provider-1",
              "user_visible_summary": "Draft map changes from provider content.",
              "proposed_nodes": [
                {
                  "id": "next-provider-1",
                  "kind": "next_action",
                  "title": "Open the draft and write three bullets",
                  "body": "Minimum done: three bullets are visible."
                }
              ],
              "proposed_edges": [
                {
                  "id": "edge-provider-1",
                  "source_id": "22222222-2222-4222-8222-222222222222",
                  "target_id": "next-provider-1",
                  "kind": "breaks_down_to"
                }
              ]
            }"#,
        )),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };

    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: "Break down this launch task.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect("agent turn succeeds");

    let preview = response.preview.expect("provider preview returned");
    assert_eq!(preview.id, "preview-provider-1");
    assert_eq!(preview.proposed_nodes.len(), 1);
    assert_eq!(preview.proposed_nodes[0].id, "next-provider-1");
    assert_eq!(preview.proposed_nodes[0].kind, NodeKind::NextAction);
    assert_eq!(
        preview.proposed_nodes[0].body.as_deref(),
        Some("Minimum done: three bullets are visible.")
    );
    assert_eq!(preview.proposed_edges.len(), 1);
    assert_eq!(preview.proposed_edges[0].kind, EdgeKind::BreaksDownTo);
}

#[test]
fn agent_turn_requires_provider_setup_before_llm_workflow() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::empty()),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: false,
    };

    let error = run_agent_turn(
        AgentTurnRequest {
            user_message: "Break this down.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect_err("missing provider settings should be structured failure");

    assert_eq!(error, AgentError::MissingLlmProviderSettings);
}

#[test]
fn agent_turn_blocks_unsafe_llm_preview() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::with_preview_nodes(vec![(
            "medical-1",
            NodeKind::Note,
            "Recommend medication before starting",
        )])),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };

    let error = run_agent_turn(
        AgentTurnRequest {
            user_message: "What should I do?".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect_err("unsafe preview should be blocked");

    assert_eq!(error, AgentError::SafetyBlocked);
}

#[test]
fn malformed_provider_output_returns_recovery_response() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::malformed_output()),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };

    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: "Break this down.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect("malformed provider output should recover without a raw provider error");

    assert_eq!(response.kind, AgentTurnResponseKind::Recovery);
    assert_eq!(response.preview, None);
    assert!(response.message.contains("could not read"));
    assert!(response.message.contains("try again"));
}

#[test]
fn malformed_provider_preview_content_returns_recovery_response() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::with_structured_content(
            r#"{"proposed_nodes":[]}"#,
        )),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };

    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: "Break this down.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect("malformed structured provider content should recover");

    assert_eq!(response.kind, AgentTurnResponseKind::Recovery);
    assert_eq!(response.preview, None);
    assert!(response.message.contains("could not read"));
}

#[test]
fn agent_turn_enforces_tool_budget() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::empty()),
        tool_budget: 0,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };

    let error = run_agent_turn(
        AgentTurnRequest {
            user_message: "Break this down.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect_err("zero budget should stop the turn");

    assert_eq!(error, AgentError::ToolBudgetExhausted);
}

#[test]
fn intent_classifier_covers_revision_and_start_plan_language() {
    assert_eq!(
        AgentIntent::classify("This blocker is wrong; revise the preview"),
        AgentIntent::RevisePreview
    );
    assert_eq!(
        AgentIntent::classify("Give me a five-minute start plan"),
        AgentIntent::DraftStartPlan
    );
    assert_eq!(
        AgentIntent::classify("Record that the timer helped"),
        AgentIntent::RecordStrategyExperiment
    );
}

#[test]
fn mock_preview_edges_remain_confirm_before_write() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::with_preview_edge(EdgeKind::BreaksDownTo)),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };
    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: "Add one smaller action.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: Vec::new(),
        },
        runtime,
    )
    .expect("agent turn succeeds");

    let preview = response.preview.expect("preview returned");
    assert_eq!(preview.proposed_edges.len(), 1);
    assert!(response.message.contains("accept"));
}

#[test]
fn agent_turn_includes_retrieved_memory_in_prompt_context() {
    let runtime = AgentTurnRuntime {
        llm: llm(MockLlmProvider::empty()),
        tool_budget: 4,
        timeout_budget_ms: 1_000,
        llm_configured: true,
    };
    let response = run_agent_turn(
        AgentTurnRequest {
            user_message: "I need to return to this draft after interruption.".to_string(),
            selected_node_id: Some(task_node().id),
            map_snapshot: snapshot(),
            active_preview_id: None,
            confirmed_memory: vec![
                "Prefer one visible next action after interruptions.".to_string(),
                "Prefer quiet color themes.".to_string(),
            ],
        },
        runtime,
    )
    .expect("agent turn succeeds");

    assert!(response
        .prompt_context
        .contains("Prefer one visible next action after interruptions."));
    assert!(!response
        .prompt_context
        .contains("Prefer quiet color themes."));
}
