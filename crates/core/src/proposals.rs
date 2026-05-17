use crate::domain::{CheckIn, EdgeKind, MemoryProposal, NodeKind};
use crate::safety::{review_text_for_safety, SafetyReview, SafetyStatus};
use crate::strategies::{validate_strategy_experiment, StrategyExperiment};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProposedNode {
    pub id: String,
    pub kind: NodeKind,
    pub title: String,
    pub body: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProposedEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub kind: EdgeKind,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AgentPreview {
    pub id: String,
    pub proposed_nodes: Vec<ProposedNode>,
    pub proposed_edges: Vec<ProposedEdge>,
    pub proposed_memory: Vec<MemoryProposal>,
    pub proposed_check_ins: Vec<CheckIn>,
    pub proposed_strategy_experiments: Vec<StrategyExperiment>,
    pub user_visible_summary: String,
}

pub fn validate_agent_preview(preview: &AgentPreview) -> SafetyReview {
    let mut limit_reasons = Vec::new();
    if preview.proposed_nodes.len() > 7 {
        limit_reasons.push("Preview proposes more than 7 nodes.".to_string());
    }
    if preview.proposed_edges.len() > 10 {
        limit_reasons.push("Preview proposes more than 10 edges.".to_string());
    }
    if preview.proposed_memory.len() > 3 {
        limit_reasons.push("Preview proposes more than 3 memory updates.".to_string());
    }
    if preview.proposed_check_ins.len() > 3 {
        limit_reasons.push("Preview proposes more than 3 check-ins.".to_string());
    }
    if preview.proposed_strategy_experiments.len() > 3 {
        limit_reasons.push("Preview proposes more than 3 strategy experiments.".to_string());
    }
    let next_actions = preview
        .proposed_nodes
        .iter()
        .filter(|node| node.kind == NodeKind::NextAction)
        .count();
    if next_actions > 3 {
        limit_reasons.push("Preview proposes more than 3 next actions.".to_string());
    }

    if !limit_reasons.is_empty() {
        return SafetyReview {
            status: SafetyStatus::BlockedLimits,
            reasons: limit_reasons,
        };
    }

    let combined_text = preview
        .proposed_nodes
        .iter()
        .flat_map(|node| [Some(node.title.as_str()), node.body.as_deref()])
        .flatten()
        .chain(
            preview
                .proposed_memory
                .iter()
                .flat_map(|memory| {
                    [
                        Some(memory.proposed_memory_text.as_str()),
                        memory.evidence_reference.as_deref(),
                    ]
                })
                .flatten(),
        )
        .chain(
            preview
                .proposed_check_ins
                .iter()
                .map(|check_in| check_in.body.as_str()),
        )
        .chain(
            preview
                .proposed_strategy_experiments
                .iter()
                .flat_map(|experiment| {
                    [
                        experiment.support_template_id.as_deref(),
                        experiment.custom_support_title.as_deref(),
                        experiment.obstacle_note.as_deref(),
                    ]
                })
                .flatten(),
        )
        .chain(std::iter::once(preview.user_visible_summary.as_str()))
        .collect::<Vec<_>>()
        .join("\n");

    let review = review_text_for_safety(&combined_text);
    if review.status != SafetyStatus::Allowed {
        return review;
    }

    let invalid_strategy_experiment = preview
        .proposed_strategy_experiments
        .iter()
        .any(|experiment| validate_strategy_experiment(experiment).is_err());
    if invalid_strategy_experiment {
        return SafetyReview {
            status: SafetyStatus::BlockedLimits,
            reasons: vec!["Preview contains an invalid strategy experiment.".to_string()],
        };
    }

    SafetyReview::allowed()
}

pub fn validate_memory_proposal(proposal: &MemoryProposal) -> Result<(), SafetyReview> {
    let review = review_text_for_safety(&proposal.proposed_memory_text);
    if review.status == SafetyStatus::Allowed {
        Ok(())
    } else {
        Err(review)
    }
}
