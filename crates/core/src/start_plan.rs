use crate::domain::{
    AttentionSession, AttentionSessionState, EdgeKind, GraphNode, MapSnapshot, NodeKind,
};
use crate::graph::{validate_graph, GraphValidationError};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StartCheck {
    pub needed_materials: Vec<String>,
    pub current_distraction: Option<String>,
    pub five_minute_fit: bool,
    pub reopen_target: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct StartPlan {
    pub selected_next_action: GraphNode,
    pub parent_task: Option<GraphNode>,
    pub support_items: Vec<GraphNode>,
    pub environmental_adjustment: Option<GraphNode>,
    pub current_blocker: Option<GraphNode>,
    pub minimum_done: Option<String>,
    pub estimate_minutes: Option<u16>,
    pub return_cue: String,
    pub start_check: StartCheck,
}

#[derive(Debug, Eq, PartialEq)]
pub enum StartPlanError {
    InvalidGraph(GraphValidationError),
    NextActionNotFound(String),
    NodeIsNotNextAction { node_id: String, kind: NodeKind },
    InvalidAttentionSessionNode { node_id: String, kind: NodeKind },
}

pub fn generate_start_plan(
    snapshot: &MapSnapshot,
    next_action_id: &str,
) -> Result<StartPlan, StartPlanError> {
    validate_graph(snapshot).map_err(StartPlanError::InvalidGraph)?;

    let next_action = snapshot
        .nodes
        .iter()
        .find(|node| node.id == next_action_id)
        .cloned()
        .ok_or_else(|| StartPlanError::NextActionNotFound(next_action_id.to_string()))?;

    if next_action.kind != NodeKind::NextAction {
        return Err(StartPlanError::NodeIsNotNextAction {
            node_id: next_action.id,
            kind: next_action.kind,
        });
    }

    let parent_task = snapshot
        .edges
        .iter()
        .find(|edge| edge.kind == EdgeKind::BreaksDownTo && edge.target_id == next_action_id)
        .and_then(|edge| node_by_id(snapshot, &edge.source_id))
        .filter(|node| matches!(node.kind, NodeKind::Task | NodeKind::Subtask))
        .cloned();

    let current_blocker = snapshot
        .edges
        .iter()
        .find(|edge| edge.kind == EdgeKind::BlockedBy && edge.source_id == next_action_id)
        .and_then(|edge| node_by_id(snapshot, &edge.target_id))
        .cloned();

    let mut support_items = snapshot
        .edges
        .iter()
        .filter(|edge| edge.kind == EdgeKind::Supports && edge.target_id == next_action_id)
        .filter_map(|edge| node_by_id(snapshot, &edge.source_id))
        .filter(|node| node.kind == NodeKind::Support)
        .take(3)
        .cloned()
        .collect::<Vec<_>>();
    support_items.truncate(3);

    let environmental_adjustment = snapshot
        .edges
        .iter()
        .filter(|edge| edge.kind == EdgeKind::Supports && edge.target_id == next_action_id)
        .filter_map(|edge| node_by_id(snapshot, &edge.source_id))
        .find(|node| node.kind == NodeKind::EnvironmentAdjustment)
        .cloned();

    let metadata = next_action.metadata.as_ref();
    let minimum_done = metadata.and_then(|metadata| metadata.minimum_done.clone());
    let estimate_minutes = metadata.and_then(|metadata| metadata.estimated_minutes);
    let return_cue = format!("Return to: {}", next_action.title);

    Ok(StartPlan {
        selected_next_action: next_action.clone(),
        parent_task,
        support_items,
        environmental_adjustment,
        current_blocker,
        minimum_done,
        estimate_minutes,
        return_cue: return_cue.clone(),
        start_check: StartCheck {
            needed_materials: Vec::new(),
            current_distraction: None,
            five_minute_fit: estimate_minutes.map(|minutes| minutes <= 5).unwrap_or(true),
            reopen_target: return_cue,
        },
    })
}

fn node_by_id<'a>(snapshot: &'a MapSnapshot, node_id: &str) -> Option<&'a GraphNode> {
    snapshot.nodes.iter().find(|node| node.id == node_id)
}

pub fn start_attention_session(
    id: &str,
    start_plan_id: Option<&str>,
    selected_next_action: &GraphNode,
    intended_duration_minutes: u16,
    started_at: &str,
) -> Result<AttentionSession, StartPlanError> {
    if selected_next_action.kind != NodeKind::NextAction {
        return Err(StartPlanError::InvalidAttentionSessionNode {
            node_id: selected_next_action.id.clone(),
            kind: selected_next_action.kind,
        });
    }

    Ok(AttentionSession {
        id: id.to_string(),
        start_plan_id: start_plan_id.map(ToOwned::to_owned),
        next_action_id: selected_next_action.id.clone(),
        started_at: started_at.to_string(),
        ended_at: None,
        intended_duration_minutes: Some(intended_duration_minutes),
        state: AttentionSessionState::Active,
        completion_note: None,
    })
}
