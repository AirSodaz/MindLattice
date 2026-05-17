use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct Workspace {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Task,
    Subtask,
    Blocker,
    Note,
    Resource,
    NextAction,
    Support,
    EnvironmentAdjustment,
    RoutineAnchor,
    AttentionGuard,
    CheckIn,
}

impl NodeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Task => "task",
            Self::Subtask => "subtask",
            Self::Blocker => "blocker",
            Self::Note => "note",
            Self::Resource => "resource",
            Self::NextAction => "next_action",
            Self::Support => "support",
            Self::EnvironmentAdjustment => "environment_adjustment",
            Self::RoutineAnchor => "routine_anchor",
            Self::AttentionGuard => "attention_guard",
            Self::CheckIn => "check_in",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "task" => Some(Self::Task),
            "subtask" => Some(Self::Subtask),
            "blocker" => Some(Self::Blocker),
            "note" => Some(Self::Note),
            "resource" => Some(Self::Resource),
            "next_action" => Some(Self::NextAction),
            "support" => Some(Self::Support),
            "environment_adjustment" => Some(Self::EnvironmentAdjustment),
            "routine_anchor" => Some(Self::RoutineAnchor),
            "attention_guard" => Some(Self::AttentionGuard),
            "check_in" => Some(Self::CheckIn),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    BreaksDownTo,
    BlockedBy,
    Supports,
    LeadsTo,
    Anchors,
    Protects,
    Related,
}

impl EdgeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::BreaksDownTo => "breaks_down_to",
            Self::BlockedBy => "blocked_by",
            Self::Supports => "supports",
            Self::LeadsTo => "leads_to",
            Self::Anchors => "anchors",
            Self::Protects => "protects",
            Self::Related => "related",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "breaks_down_to" => Some(Self::BreaksDownTo),
            "blocked_by" => Some(Self::BlockedBy),
            "supports" => Some(Self::Supports),
            "leads_to" => Some(Self::LeadsTo),
            "anchors" => Some(Self::Anchors),
            "protects" => Some(Self::Protects),
            "related" => Some(Self::Related),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct NodeExecutionMetadata {
    pub energy_level: Option<u8>,
    pub friction_level: Option<u8>,
    pub estimated_minutes: Option<u16>,
    pub minimum_done: Option<String>,
    pub context_tags: Vec<String>,
    pub last_started_at: Option<String>,
    pub last_checked_in_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GraphNode {
    pub id: String,
    pub workspace_id: String,
    pub kind: NodeKind,
    pub title: String,
    pub body: Option<String>,
    pub metadata: Option<NodeExecutionMetadata>,
    pub position: Option<NodePosition>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct GraphEdge {
    pub id: String,
    pub workspace_id: String,
    pub source_id: String,
    pub target_id: String,
    pub kind: EdgeKind,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct MapSnapshot {
    pub workspace: Workspace,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ContextProfile {
    pub id: String,
    pub workspace_id: String,
    pub adult_contexts: Vec<String>,
    pub execution_difficulties: Vec<String>,
    pub preferred_support_categories: Vec<crate::strategies::SupportCategory>,
    pub llm_provider_setup_state: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AttentionSessionState {
    Planned,
    Active,
    Paused,
    Closed,
}

impl AttentionSessionState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Planned => "planned",
            Self::Active => "active",
            Self::Paused => "paused",
            Self::Closed => "closed",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "planned" => Some(Self::Planned),
            "active" => Some(Self::Active),
            "paused" => Some(Self::Paused),
            "closed" => Some(Self::Closed),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AttentionSession {
    pub id: String,
    pub start_plan_id: Option<String>,
    pub next_action_id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub intended_duration_minutes: Option<u16>,
    pub state: AttentionSessionState,
    pub completion_note: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct MemoryProposal {
    pub id: String,
    pub proposed_memory_text: String,
    pub evidence_reference: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CheckIn {
    pub id: String,
    pub workspace_id: String,
    pub node_id: Option<String>,
    pub body: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct NodeNote {
    pub node_id: String,
    pub body: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AiProposalStatus {
    Active,
    Accepted,
    Rejected,
}

impl AiProposalStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Accepted => "accepted",
            Self::Rejected => "rejected",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "active" => Some(Self::Active),
            "accepted" => Some(Self::Accepted),
            "rejected" => Some(Self::Rejected),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AiProposalRecord {
    pub id: String,
    pub proposal_type: String,
    pub status: AiProposalStatus,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AgentThread {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AgentTurn {
    pub id: String,
    pub thread_id: String,
    pub user_message: String,
    pub agent_response: String,
    pub prompt_version_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PromptVersionRecord {
    pub id: String,
    pub layer: String,
    pub version: String,
    pub content_hash: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct AgentSkillRun {
    pub id: String,
    pub turn_id: Option<String>,
    pub skill_id: String,
    pub skill_version: String,
    pub result_status: String,
}
