use crate::skills::initial_skill_specs;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssembledPrompt {
    pub combined: String,
    pub version_trace: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PromptAssetLayer {
    pub id: &'static str,
    pub version: u16,
    pub body: &'static str,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PromptGoldenFixture {
    pub id: &'static str,
    pub body: &'static str,
}

#[derive(Debug, Eq, PartialEq)]
pub enum PromptError {
    UnknownSkill(String),
}

pub fn prompt_asset_manifest() -> Vec<PromptAssetLayer> {
    vec![
        PromptAssetLayer {
            id: "policy",
            version: 1,
            body: include_str!("../prompts/policy.v1.md"),
        },
        PromptAssetLayer {
            id: "role",
            version: 1,
            body: include_str!("../prompts/role.v1.md"),
        },
        PromptAssetLayer {
            id: "workflow",
            version: 1,
            body: include_str!("../prompts/workflow.v1.md"),
        },
        PromptAssetLayer {
            id: "tools",
            version: 1,
            body: include_str!("../prompts/tools.v1.md"),
        },
        PromptAssetLayer {
            id: "output_style",
            version: 1,
            body: include_str!("../prompts/output_style.v1.md"),
        },
    ]
}

pub fn prompt_golden_fixtures() -> Vec<PromptGoldenFixture> {
    vec![
        PromptGoldenFixture {
            id: "capture_task",
            body: include_str!("../prompt_golden/capture_task.md"),
        },
        PromptGoldenFixture {
            id: "preview_revision",
            body: include_str!("../prompt_golden/preview_revision.md"),
        },
        PromptGoldenFixture {
            id: "start_mode_drafting",
            body: include_str!("../prompt_golden/start_mode_drafting.md"),
        },
        PromptGoldenFixture {
            id: "support_matching",
            body: include_str!("../prompt_golden/support_matching.md"),
        },
        PromptGoldenFixture {
            id: "medical_boundary_rejection",
            body: include_str!("../prompt_golden/medical_boundary_rejection.md"),
        },
        PromptGoldenFixture {
            id: "crisis_redirection",
            body: include_str!("../prompt_golden/crisis_redirection.md"),
        },
    ]
}

pub fn assemble_prompt_layers(
    skill_id: &str,
    user_message: &str,
    runtime_context: &str,
) -> Result<AssembledPrompt, PromptError> {
    let skill = initial_skill_specs()
        .into_iter()
        .find(|skill| skill.id == skill_id)
        .ok_or_else(|| PromptError::UnknownSkill(skill_id.to_string()))?;
    let skill_version = format!("{}@v{}", skill.id, skill.version);
    let asset_layers = prompt_asset_manifest();
    let mut version_trace = asset_layers
        .iter()
        .take(4)
        .map(prompt_layer_version)
        .collect::<Vec<_>>();
    version_trace.push(skill_version);
    version_trace.extend(asset_layers.iter().skip(4).map(prompt_layer_version));

    let mut prompt_sections = asset_layers
        .iter()
        .take(4)
        .map(|layer| layer.body.trim().to_string())
        .collect::<Vec<_>>();
    prompt_sections.push(format!(
        "Skill: {} uses {:?}.",
        skill.id, skill.allowed_tools
    ));
    prompt_sections.extend(
        asset_layers
            .iter()
            .skip(4)
            .map(|layer| layer.body.trim().to_string()),
    );
    prompt_sections.push(format!("User: {user_message}"));
    prompt_sections.push(format!("Runtime context: {runtime_context}"));
    let combined = prompt_sections.join("\n");

    Ok(AssembledPrompt {
        combined,
        version_trace,
    })
}

fn prompt_layer_version(layer: &PromptAssetLayer) -> String {
    format!("{}@v{}", layer.id, layer.version)
}
