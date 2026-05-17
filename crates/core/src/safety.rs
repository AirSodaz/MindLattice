#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SafetyStatus {
    Allowed,
    BlockedMedical,
    BlockedCrisis,
    BlockedLimits,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SafetyReview {
    pub status: SafetyStatus,
    pub reasons: Vec<String>,
}

impl SafetyReview {
    pub fn allowed() -> Self {
        Self {
            status: SafetyStatus::Allowed,
            reasons: Vec::new(),
        }
    }
}

pub fn review_text_for_safety(text: &str) -> SafetyReview {
    let normalized = text.to_lowercase().replace(['_', '-'], " ");
    let crisis_terms = [
        "self-harm",
        "suicide",
        "kill myself",
        "end my life",
        "mania",
        "psychosis",
        "substance-use risk",
    ];
    let medical_terms = [
        "diagnose",
        "diagnosis",
        "treat adhd",
        "treatment plan",
        "therapy plan",
        "medication recommendation",
        "recommend medication",
        "stop medication",
        "symptom score",
        "symptom severity",
        "clinical recommendation",
        "adhd symptoms",
        "reduce adhd symptoms",
        "severe adhd",
        "for your adhd",
    ];

    if crisis_terms.iter().any(|term| normalized.contains(term)) {
        return SafetyReview {
            status: SafetyStatus::BlockedCrisis,
            reasons: vec!["Crisis language cannot enter ordinary task advice.".to_string()],
        };
    }

    if medical_terms.iter().any(|term| normalized.contains(term)) {
        return SafetyReview {
            status: SafetyStatus::BlockedMedical,
            reasons: vec![
                "Medical, diagnostic, medication, treatment, or symptom language is blocked."
                    .to_string(),
            ],
        };
    }

    SafetyReview::allowed()
}

pub fn validate_check_in_text(text: &str) -> SafetyReview {
    review_text_for_safety(text)
}
