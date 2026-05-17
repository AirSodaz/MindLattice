#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentIntent {
    CaptureTask,
    DecomposeOrReviseMap,
    FindBlocker,
    FindNextAction,
    DraftStartPlan,
    RevisePreview,
    RecordCheckIn,
    RecordStrategyExperiment,
    ProposePreferenceMemory,
    ImportOrExport,
    GeneralQuestion,
    SafetyRedirect,
}

impl AgentIntent {
    pub fn classify(message: &str) -> Self {
        let normalized = message.to_lowercase();
        if normalized.contains("kill myself")
            || normalized.contains("suicide")
            || normalized.contains("self-harm")
        {
            Self::SafetyRedirect
        } else if normalized.contains("revise") || normalized.contains("wrong") {
            Self::RevisePreview
        } else if normalized.contains("start plan") || normalized.contains("five-minute") {
            Self::DraftStartPlan
        } else if normalized.contains("timer helped") || normalized.contains("support helped") {
            Self::RecordStrategyExperiment
        } else if normalized.contains("check in") || normalized.contains("record that") {
            Self::RecordCheckIn
        } else if normalized.contains("blocker") || normalized.contains("blocked") {
            Self::FindBlocker
        } else if normalized.contains("smaller") || normalized.contains("next action") {
            Self::FindNextAction
        } else if normalized.contains("import") || normalized.contains("export") {
            Self::ImportOrExport
        } else if normalized.contains("remember") || normalized.contains("prefer") {
            Self::ProposePreferenceMemory
        } else if normalized.contains("break down") || normalized.contains("decompose") {
            Self::DecomposeOrReviseMap
        } else if normalized.contains("too much")
            || normalized.contains("do not know where to start")
        {
            Self::CaptureTask
        } else {
            Self::GeneralQuestion
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentSkillSpec {
    pub id: String,
    pub version: u16,
    pub trigger_conditions: Vec<String>,
    pub required_context: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub output_schema: String,
    pub safety_restrictions: Vec<String>,
    pub golden_cases: Vec<String>,
}

pub fn initial_skill_specs() -> Vec<AgentSkillSpec> {
    [
        ("capture_messy_task", "map.propose_nodes_edges"),
        ("decompose_to_star_map", "map.propose_nodes_edges"),
        ("identify_blockers", "map.propose_nodes_edges"),
        ("find_smaller_next_action", "start_plan.generate"),
        ("match_support_template", "support.search_templates"),
        ("draft_start_plan", "start_plan.generate"),
        ("revise_graph_preview", "map.revise_preview"),
        ("summarize_check_in", "check_in.propose"),
        (
            "extract_preference_from_experiment",
            "memory.propose_update",
        ),
        (
            "safe_redirect_for_crisis_or_medical_content",
            "safety.review",
        ),
    ]
    .into_iter()
    .map(|(id, tool)| AgentSkillSpec {
        id: id.to_string(),
        version: 1,
        trigger_conditions: vec![format!("Use when intent maps to {id}.")],
        required_context: vec!["latest_user_message".to_string(), "map_summary".to_string()],
        allowed_tools: vec![tool.to_string(), "proposal.validate".to_string()],
        output_schema: "agent_turn_response".to_string(),
        safety_restrictions: vec![
            "confirm-before-write".to_string(),
            "no medical, diagnostic, medication, symptom scoring, or crisis productivity advice"
                .to_string(),
        ],
        golden_cases: vec![format!(
            "{id} handles a low-risk execution-support example."
        )],
    })
    .collect()
}
