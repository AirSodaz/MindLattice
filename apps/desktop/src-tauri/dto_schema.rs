struct TypeAlias {
    name: &'static str,
    body: TypeBody,
}

enum TypeBody {
    Union(&'static [&'static str]),
    Object(&'static [&'static str]),
    Raw(&'static str),
}

const NODE_KIND_VALUES: &[&str] = &[
    "task",
    "subtask",
    "blocker",
    "note",
    "resource",
    "next_action",
    "support",
    "environment_adjustment",
    "routine_anchor",
    "attention_guard",
    "check_in",
];

const SUPPORT_CATEGORY_VALUES: &[&str] = &[
    "sensory_environment",
    "task_structure",
    "external_memory",
    "written_communication",
    "rest_and_switching",
    "work_study_adjustment",
];

const EXPERIMENT_CONTEXT_VALUES: &[&str] = &[
    "work",
    "study",
    "home_responsibility",
    "personal_project",
    "custom",
];

const STRATEGY_DECISION_VALUES: &[&str] = &["keep", "revise", "pause", "remove"];
const ATTENTION_SESSION_STATE_VALUES: &[&str] = &["planned", "active", "paused", "closed"];

const COMMAND_DTO_TYPES: &[TypeAlias] = &[
    TypeAlias {
        name: "CommandNodeKind",
        body: TypeBody::Union(NODE_KIND_VALUES),
    },
    TypeAlias {
        name: "CommandSupportCategory",
        body: TypeBody::Union(SUPPORT_CATEGORY_VALUES),
    },
    TypeAlias {
        name: "CommandExperimentContext",
        body: TypeBody::Union(EXPERIMENT_CONTEXT_VALUES),
    },
    TypeAlias {
        name: "CommandStrategyDecision",
        body: TypeBody::Union(STRATEGY_DECISION_VALUES),
    },
    TypeAlias {
        name: "CommandAttentionSessionState",
        body: TypeBody::Union(ATTENTION_SESSION_STATE_VALUES),
    },
    TypeAlias {
        name: "CommandWorkspace",
        body: TypeBody::Object(&["id: string", "title: string"]),
    },
    TypeAlias {
        name: "CommandNode",
        body: TypeBody::Object(&[
            "id: string",
            "workspaceId: string",
            "kind: CommandNodeKind",
            "title: string",
            "body: string | null",
            "metadata: {\n    minimumDone?: string;\n    estimatedMinutes?: number;\n  } | null",
            "position?: {\n    x: number;\n    y: number;\n  } | null",
        ]),
    },
    TypeAlias {
        name: "CommandEdge",
        body: TypeBody::Object(&[
            "id: string",
            "workspaceId: string",
            "sourceId: string",
            "targetId: string",
            "kind: string",
        ]),
    },
    TypeAlias {
        name: "CommandMapSnapshot",
        body: TypeBody::Object(&[
            "workspace: CommandWorkspace",
            "nodes: CommandNode[]",
            "edges: CommandEdge[]",
        ]),
    },
    TypeAlias {
        name: "CommandAgentResponse",
        body: TypeBody::Object(&[
            "kind: 'PreviewProposed' | 'ShortAnswer' | 'Recovery'",
            "message: string",
            "preview: CommandPreview | null",
        ]),
    },
    TypeAlias {
        name: "CommandPreview",
        body: TypeBody::Raw(
            r#"{
  id: string;
  proposedNodes: Array<{
    id: string;
    kind: CommandNodeKind;
    title: string;
    body: string | null;
  }>;
  proposedEdges: Array<{ id: string; sourceId: string; targetId: string; kind: string }>;
  proposedMemory: CommandMemory[];
  proposedCheckIns: CommandCheckIn[];
  proposedStrategyExperiments: CommandStrategyExperiment[];
  userVisibleSummary: string;
}"#,
        ),
    },
    TypeAlias {
        name: "CommandStartPlan",
        body: TypeBody::Raw(
            r#"{
  selectedNextAction: CommandNode;
  parentTask: CommandNode | null;
  supportItems: CommandNode[];
  environmentalAdjustment: CommandNode | null;
  currentBlocker: CommandNode | null;
  minimumDone: string | null;
  estimateMinutes: number | null;
  returnCue: string;
  startCheck: {
    neededMaterials: string[];
    currentDistraction: string | null;
    fiveMinuteFit: boolean;
    reopenTarget: string;
  };
}"#,
        ),
    },
    TypeAlias {
        name: "CommandAttentionSession",
        body: TypeBody::Object(&[
            "id: string",
            "startPlanId: string | null",
            "nextActionId: string",
            "startedAt: string",
            "endedAt: string | null",
            "intendedDurationMinutes: number | null",
            "state: CommandAttentionSessionState",
            "completionNote: string | null",
        ]),
    },
    TypeAlias {
        name: "CommandSupportTemplate",
        body: TypeBody::Object(&[
            "id: string",
            "category: CommandSupportCategory",
            "title: string",
            "steps: string[]",
            "defaultContexts: string[]",
            "sourceNote: string",
            "safetyNote: string",
        ]),
    },
    TypeAlias {
        name: "CommandStrategyCard",
        body: TypeBody::Object(&[
            "id: string",
            "title: string",
            "whenToUse: string",
            "steps: string[]",
            "sourceNote: string",
            "safetyNote: string",
        ]),
    },
    TypeAlias {
        name: "CommandStrategyExperiment",
        body: TypeBody::Object(&[
            "id: string",
            "supportTemplateId: string | null",
            "customSupportTitle: string | null",
            "context: CommandExperimentContext",
            "helpedStart: boolean",
            "helpedContinue: boolean",
            "helpedReturn: boolean",
            "helpedClarifyNextAction: boolean",
            "obstacleNote: string | null",
            "nextDecision: CommandStrategyDecision",
        ]),
    },
    TypeAlias {
        name: "CommandContextProfile",
        body: TypeBody::Object(&[
            "id: string",
            "workspaceId: string",
            "adultContexts: string[]",
            "executionDifficulties: string[]",
            "preferredSupportCategories: CommandSupportCategory[]",
            "llmProviderSetupState: string",
        ]),
    },
    TypeAlias {
        name: "CommandMemory",
        body: TypeBody::Object(&[
            "id: string",
            "proposedMemoryText: string",
            "evidenceReference: string | null",
        ]),
    },
    TypeAlias {
        name: "CommandCheckIn",
        body: TypeBody::Object(&[
            "id: string",
            "workspaceId: string",
            "nodeId: string | null",
            "body: string",
        ]),
    },
    TypeAlias {
        name: "CommandLlmSettings",
        body: TypeBody::Object(&[
            "baseUrl: string",
            "apiKey: string",
            "model: string",
            "timeoutSeconds: number",
        ]),
    },
    TypeAlias {
        name: "CommandVaultFile",
        body: TypeBody::Object(&["filename: string", "content: string"]),
    },
    TypeAlias {
        name: "CommandVaultExport",
        body: TypeBody::Object(&["files: CommandVaultFile[]"]),
    },
    TypeAlias {
        name: "CommandVaultImport",
        body: TypeBody::Object(&[
            "nodesCreated: number",
            "edgesCreated: number",
            "nodes: CommandNode[]",
            "edges: CommandEdge[]",
        ]),
    },
];

pub fn command_dto_typescript() -> String {
    let mut output = String::from(
        "// Generated from apps/desktop/src-tauri/src/tauri_api.rs.\n\
         // Do not edit by hand. Update the Rust command DTO schema instead.\n\n",
    );
    for (index, alias) in COMMAND_DTO_TYPES.iter().enumerate() {
        output.push_str(&render_type_alias(alias));
        if index + 1 < COMMAND_DTO_TYPES.len() {
            output.push('\n');
        }
    }
    output
}

fn render_type_alias(alias: &TypeAlias) -> String {
    match &alias.body {
        TypeBody::Union(values) => {
            let variants = values
                .iter()
                .map(|value| format!("  | '{value}'"))
                .collect::<Vec<_>>()
                .join("\n");
            format!("export type {} =\n{};\n", alias.name, variants)
        }
        TypeBody::Object(fields) => {
            let fields = fields
                .iter()
                .map(|field| format!("  {field};"))
                .collect::<Vec<_>>()
                .join("\n");
            format!("export type {} = {{\n{}\n}};\n", alias.name, fields)
        }
        TypeBody::Raw(raw) => format!("export type {} = {};\n", alias.name, raw),
    }
}
