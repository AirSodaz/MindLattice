use std::collections::{HashMap, HashSet};

use crate::domain::{EdgeKind, GraphEdge, MapSnapshot, NodeKind};

#[derive(Debug, Eq, PartialEq)]
pub enum GraphValidationError {
    EmptyWorkspaceId,
    DuplicateNodeId(String),
    DuplicateEdgeId(String),
    NodeWorkspaceMismatch {
        node_id: String,
        workspace_id: String,
    },
    EdgeWorkspaceMismatch {
        edge_id: String,
        workspace_id: String,
    },
    EdgeEndpointMissing {
        edge_id: String,
        missing_node_id: String,
    },
    InvalidEdgeForNodeKinds {
        edge_id: String,
        kind: EdgeKind,
        source_kind: NodeKind,
        target_kind: NodeKind,
    },
}

pub fn validate_graph(snapshot: &MapSnapshot) -> Result<(), GraphValidationError> {
    if snapshot.workspace.id.trim().is_empty() {
        return Err(GraphValidationError::EmptyWorkspaceId);
    }

    let mut seen_nodes = HashSet::new();
    let mut nodes_by_id = HashMap::new();
    for node in &snapshot.nodes {
        if node.workspace_id != snapshot.workspace.id {
            return Err(GraphValidationError::NodeWorkspaceMismatch {
                node_id: node.id.clone(),
                workspace_id: node.workspace_id.clone(),
            });
        }
        if !seen_nodes.insert(node.id.clone()) {
            return Err(GraphValidationError::DuplicateNodeId(node.id.clone()));
        }
        nodes_by_id.insert(node.id.as_str(), node.kind);
    }

    let mut seen_edges = HashSet::new();
    for edge in &snapshot.edges {
        if edge.workspace_id != snapshot.workspace.id {
            return Err(GraphValidationError::EdgeWorkspaceMismatch {
                edge_id: edge.id.clone(),
                workspace_id: edge.workspace_id.clone(),
            });
        }
        if !seen_edges.insert(edge.id.clone()) {
            return Err(GraphValidationError::DuplicateEdgeId(edge.id.clone()));
        }

        let source_kind = match nodes_by_id.get(edge.source_id.as_str()).copied() {
            Some(kind) => kind,
            None => {
                return Err(GraphValidationError::EdgeEndpointMissing {
                    edge_id: edge.id.clone(),
                    missing_node_id: edge.source_id.clone(),
                })
            }
        };
        let target_kind = match nodes_by_id.get(edge.target_id.as_str()).copied() {
            Some(kind) => kind,
            None => {
                return Err(GraphValidationError::EdgeEndpointMissing {
                    edge_id: edge.id.clone(),
                    missing_node_id: edge.target_id.clone(),
                })
            }
        };

        if !edge_kind_accepts(edge, source_kind, target_kind) {
            return Err(GraphValidationError::InvalidEdgeForNodeKinds {
                edge_id: edge.id.clone(),
                kind: edge.kind,
                source_kind,
                target_kind,
            });
        }
    }

    Ok(())
}

fn edge_kind_accepts(edge: &GraphEdge, source_kind: NodeKind, target_kind: NodeKind) -> bool {
    match edge.kind {
        EdgeKind::BreaksDownTo => is_work_kind(source_kind) && is_work_kind(target_kind),
        EdgeKind::BlockedBy => is_work_kind(source_kind) && target_kind == NodeKind::Blocker,
        EdgeKind::Supports => is_context_kind(source_kind) && is_work_kind(target_kind),
        EdgeKind::LeadsTo => {
            is_work_kind(source_kind)
                && matches!(
                    target_kind,
                    NodeKind::Task | NodeKind::Subtask | NodeKind::NextAction | NodeKind::CheckIn
                )
        }
        EdgeKind::Anchors => source_kind == NodeKind::RoutineAnchor && is_work_kind(target_kind),
        EdgeKind::Protects => source_kind == NodeKind::AttentionGuard && is_work_kind(target_kind),
        EdgeKind::Related => true,
    }
}

fn is_work_kind(kind: NodeKind) -> bool {
    matches!(
        kind,
        NodeKind::Task | NodeKind::Subtask | NodeKind::NextAction
    )
}

fn is_context_kind(kind: NodeKind) -> bool {
    matches!(
        kind,
        NodeKind::Note
            | NodeKind::Resource
            | NodeKind::Support
            | NodeKind::EnvironmentAdjustment
            | NodeKind::RoutineAnchor
            | NodeKind::AttentionGuard
            | NodeKind::CheckIn
    )
}
