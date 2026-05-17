use crate::domain::{ContextProfile, GraphNode, NodeKind};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SupportCategory {
    SensoryEnvironment,
    TaskStructure,
    ExternalMemory,
    WrittenCommunication,
    RestAndSwitching,
    WorkStudyAdjustment,
}

impl SupportCategory {
    pub fn all() -> [Self; 6] {
        [
            Self::SensoryEnvironment,
            Self::TaskStructure,
            Self::ExternalMemory,
            Self::WrittenCommunication,
            Self::RestAndSwitching,
            Self::WorkStudyAdjustment,
        ]
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::SensoryEnvironment => "sensory_environment",
            Self::TaskStructure => "task_structure",
            Self::ExternalMemory => "external_memory",
            Self::WrittenCommunication => "written_communication",
            Self::RestAndSwitching => "rest_and_switching",
            Self::WorkStudyAdjustment => "work_study_adjustment",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "sensory_environment" => Some(Self::SensoryEnvironment),
            "task_structure" => Some(Self::TaskStructure),
            "external_memory" => Some(Self::ExternalMemory),
            "written_communication" => Some(Self::WrittenCommunication),
            "rest_and_switching" => Some(Self::RestAndSwitching),
            "work_study_adjustment" => Some(Self::WorkStudyAdjustment),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SupportTemplate {
    pub id: String,
    pub category: SupportCategory,
    pub title: String,
    pub steps: Vec<String>,
    pub default_contexts: Vec<String>,
    pub source_note: String,
    pub safety_note: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StrategyCard {
    pub id: String,
    pub title: String,
    pub when_to_use: String,
    pub steps: Vec<String>,
    pub source_note: String,
    pub safety_note: String,
}

pub fn list_support_templates() -> Vec<SupportTemplate> {
    vec![
        SupportTemplate {
            id: "quieter-workspace".to_string(),
            category: SupportCategory::SensoryEnvironment,
            title: "Quieter workspace".to_string(),
            steps: vec![
                "Move one distracting object out of view.".to_string(),
                "Choose headphones, white noise, or a quieter corner if available.".to_string(),
            ],
            default_contexts: vec!["work".to_string(), "study".to_string()],
            source_note: "General low-risk environment adjustment pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        SupportTemplate {
            id: "visible-checklist".to_string(),
            category: SupportCategory::TaskStructure,
            title: "Visible short checklist".to_string(),
            steps: vec![
                "Write no more than three visible steps.".to_string(),
                "Mark the minimum done line before starting.".to_string(),
            ],
            default_contexts: vec!["work".to_string(), "personal project".to_string()],
            source_note: "General task-structure support pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        SupportTemplate {
            id: "return-cue".to_string(),
            category: SupportCategory::ExternalMemory,
            title: "Return cue".to_string(),
            steps: vec![
                "Leave one note that says where to resume.".to_string(),
                "Place the note beside the task material or pinned workspace.".to_string(),
            ],
            default_contexts: vec!["work".to_string(), "home responsibility".to_string()],
            source_note: "General external-memory support pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        SupportTemplate {
            id: "written-steps-request".to_string(),
            category: SupportCategory::WrittenCommunication,
            title: "Request written steps".to_string(),
            steps: vec![
                "Ask for the next expected step in writing.".to_string(),
                "Copy the deadline or done criteria into the task note.".to_string(),
            ],
            default_contexts: vec!["work".to_string(), "study".to_string()],
            source_note: "General communication support pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        SupportTemplate {
            id: "transition-note".to_string(),
            category: SupportCategory::RestAndSwitching,
            title: "Transition note".to_string(),
            steps: vec![
                "Write what was open, what changed, and the next tiny action.".to_string(),
                "Set a planned restart point if the task cannot continue now.".to_string(),
            ],
            default_contexts: vec!["work".to_string(), "study".to_string()],
            source_note: "General task-switching support pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        SupportTemplate {
            id: "do-not-disturb-window".to_string(),
            category: SupportCategory::WorkStudyAdjustment,
            title: "Do-not-disturb window".to_string(),
            steps: vec![
                "Choose a short focus block that fits the current context.".to_string(),
                "Make interruptions visible only after the block ends.".to_string(),
            ],
            default_contexts: vec!["work".to_string(), "study".to_string()],
            source_note: "General work or study adjustment pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
    ]
}

pub fn adopt_support_template(
    workspace_id: &str,
    node_id: &str,
    template_id: &str,
) -> Option<GraphNode> {
    let template = list_support_templates()
        .into_iter()
        .find(|template| template.id == template_id)?;
    let body = format!(
        "Template: {}\n\nSteps:\n{}\n\nSafety: {}",
        template.id,
        template
            .steps
            .iter()
            .map(|step| format!("- {step}"))
            .collect::<Vec<_>>()
            .join("\n"),
        template.safety_note
    );

    Some(GraphNode {
        id: node_id.to_string(),
        workspace_id: workspace_id.to_string(),
        kind: NodeKind::Support,
        title: template.title,
        body: Some(body),
        metadata: None,
        position: None,
    })
}

pub fn list_strategy_cards() -> Vec<StrategyCard> {
    vec![
        StrategyCard {
            id: "make-it-visible".to_string(),
            title: "Make it visible".to_string(),
            when_to_use: "Use when the next step keeps disappearing from working memory."
                .to_string(),
            steps: vec![
                "Write the current task in one plain sentence.".to_string(),
                "Put the sentence where it stays visible while starting.".to_string(),
            ],
            source_note: "General external-memory strategy pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        StrategyCard {
            id: "shrink-the-start".to_string(),
            title: "Shrink the start".to_string(),
            when_to_use: "Use when the task feels too large to begin.".to_string(),
            steps: vec![
                "Name the smallest visible action.".to_string(),
                "Set a five-minute fit check before committing to more.".to_string(),
            ],
            source_note: "General task-start support pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
        StrategyCard {
            id: "leave-a-resume-point".to_string(),
            title: "Leave a resume point".to_string(),
            when_to_use: "Use before stopping, switching tasks, or taking a break.".to_string(),
            steps: vec![
                "Write what was just done.".to_string(),
                "Write the first action to take when returning.".to_string(),
            ],
            source_note: "General task-switching support pattern.".to_string(),
            safety_note: "Self-help execution support, not treatment advice.".to_string(),
        },
    ]
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExperimentContext {
    Work,
    Study,
    HomeResponsibility,
    PersonalProject,
    Custom,
}

impl ExperimentContext {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Work => "work",
            Self::Study => "study",
            Self::HomeResponsibility => "home_responsibility",
            Self::PersonalProject => "personal_project",
            Self::Custom => "custom",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "work" => Some(Self::Work),
            "study" => Some(Self::Study),
            "home_responsibility" => Some(Self::HomeResponsibility),
            "personal_project" => Some(Self::PersonalProject),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StrategyDecision {
    Keep,
    Revise,
    Pause,
    Remove,
}

impl StrategyDecision {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Keep => "keep",
            Self::Revise => "revise",
            Self::Pause => "pause",
            Self::Remove => "remove",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "keep" => Some(Self::Keep),
            "revise" => Some(Self::Revise),
            "pause" => Some(Self::Pause),
            "remove" => Some(Self::Remove),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StrategyExperiment {
    pub id: String,
    pub support_template_id: Option<String>,
    pub custom_support_title: Option<String>,
    pub context: ExperimentContext,
    pub helped_start: bool,
    pub helped_continue: bool,
    pub helped_return: bool,
    pub helped_clarify_next_action: bool,
    pub obstacle_note: Option<String>,
    pub next_decision: StrategyDecision,
}

#[derive(Debug, Eq, PartialEq)]
pub enum StrategyValidationError {
    MissingSupportReference,
    ClinicalScoringLanguage,
    ClinicalContextProfileLanguage,
}

pub fn validate_strategy_experiment(
    experiment: &StrategyExperiment,
) -> Result<(), StrategyValidationError> {
    if experiment
        .support_template_id
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
        && experiment
            .custom_support_title
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
    {
        return Err(StrategyValidationError::MissingSupportReference);
    }

    if experiment
        .obstacle_note
        .as_deref()
        .map(contains_clinical_score_language)
        .unwrap_or(false)
    {
        return Err(StrategyValidationError::ClinicalScoringLanguage);
    }

    Ok(())
}

fn contains_clinical_score_language(value: &str) -> bool {
    let normalized = value.to_lowercase().replace(['_', '-'], " ");
    normalized.contains("symptom score")
        || normalized.contains("severity")
        || normalized.contains("treatment outcome")
}

pub fn validate_context_profile(
    profile: &crate::domain::ContextProfile,
) -> Result<(), StrategyValidationError> {
    let text = profile
        .adult_contexts
        .iter()
        .chain(profile.execution_difficulties.iter())
        .chain(std::iter::once(&profile.llm_provider_setup_state))
        .map(String::as_str)
        .collect::<Vec<_>>()
        .join("\n");

    if contains_clinical_score_language(&text)
        || text.to_lowercase().contains("diagnosis")
        || text.to_lowercase().contains("medication")
    {
        return Err(StrategyValidationError::ClinicalContextProfileLanguage);
    }

    Ok(())
}

pub fn default_context_profile(id: &str, workspace_id: &str) -> ContextProfile {
    ContextProfile {
        id: id.to_string(),
        workspace_id: workspace_id.to_string(),
        adult_contexts: Vec::new(),
        execution_difficulties: Vec::new(),
        preferred_support_categories: Vec::new(),
        llm_provider_setup_state: "not_configured".to_string(),
    }
}
