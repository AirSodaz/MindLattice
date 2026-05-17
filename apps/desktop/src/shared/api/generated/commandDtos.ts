// Generated from apps/desktop/src-tauri/src/tauri_api.rs.
// Do not edit by hand. Update the Rust command DTO schema instead.

export type CommandNodeKind =
  | 'task'
  | 'subtask'
  | 'blocker'
  | 'note'
  | 'resource'
  | 'next_action'
  | 'support'
  | 'environment_adjustment'
  | 'routine_anchor'
  | 'attention_guard'
  | 'check_in';

export type CommandSupportCategory =
  | 'sensory_environment'
  | 'task_structure'
  | 'external_memory'
  | 'written_communication'
  | 'rest_and_switching'
  | 'work_study_adjustment';

export type CommandExperimentContext =
  | 'work'
  | 'study'
  | 'home_responsibility'
  | 'personal_project'
  | 'custom';

export type CommandStrategyDecision =
  | 'keep'
  | 'revise'
  | 'pause'
  | 'remove';

export type CommandAttentionSessionState =
  | 'planned'
  | 'active'
  | 'paused'
  | 'closed';

export type CommandWorkspace = {
  id: string;
  title: string;
};

export type CommandNode = {
  id: string;
  workspaceId: string;
  kind: CommandNodeKind;
  title: string;
  body: string | null;
  metadata: {
    minimumDone?: string;
    estimatedMinutes?: number;
  } | null;
  position?: {
    x: number;
    y: number;
  } | null;
};

export type CommandEdge = {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  kind: string;
};

export type CommandMapSnapshot = {
  workspace: CommandWorkspace;
  nodes: CommandNode[];
  edges: CommandEdge[];
};

export type CommandAgentResponse = {
  kind: 'PreviewProposed' | 'ShortAnswer' | 'Recovery';
  message: string;
  preview: CommandPreview | null;
};

export type CommandPreview = {
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
};

export type CommandStartPlan = {
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
};

export type CommandAttentionSession = {
  id: string;
  startPlanId: string | null;
  nextActionId: string;
  startedAt: string;
  endedAt: string | null;
  intendedDurationMinutes: number | null;
  state: CommandAttentionSessionState;
  completionNote: string | null;
};

export type CommandSupportTemplate = {
  id: string;
  category: CommandSupportCategory;
  title: string;
  steps: string[];
  defaultContexts: string[];
  sourceNote: string;
  safetyNote: string;
};

export type CommandStrategyCard = {
  id: string;
  title: string;
  whenToUse: string;
  steps: string[];
  sourceNote: string;
  safetyNote: string;
};

export type CommandStrategyExperiment = {
  id: string;
  supportTemplateId: string | null;
  customSupportTitle: string | null;
  context: CommandExperimentContext;
  helpedStart: boolean;
  helpedContinue: boolean;
  helpedReturn: boolean;
  helpedClarifyNextAction: boolean;
  obstacleNote: string | null;
  nextDecision: CommandStrategyDecision;
};

export type CommandContextProfile = {
  id: string;
  workspaceId: string;
  adultContexts: string[];
  executionDifficulties: string[];
  preferredSupportCategories: CommandSupportCategory[];
  llmProviderSetupState: string;
};

export type CommandMemory = {
  id: string;
  proposedMemoryText: string;
  evidenceReference: string | null;
};

export type CommandCheckIn = {
  id: string;
  workspaceId: string;
  nodeId: string | null;
  body: string;
};

export type CommandLlmSettings = {
  providerId: string;
  apiMode: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutSeconds: number;
};

export type CommandAppSettings = {
  llmSettings: CommandLlmSettings | null;
  themePreference: 'system' | 'light' | 'dark';
  languagePreference: 'system' | 'en' | 'zh-CN';
  interfacePreferencesSaved: boolean;
};

export type CommandLlmTestResult = {
  status: 'ok';
  model: string;
  message: string;
};

export type CommandVaultFile = {
  filename: string;
  content: string;
};

export type CommandVaultExport = {
  files: CommandVaultFile[];
};

export type CommandVaultImport = {
  nodesCreated: number;
  edgesCreated: number;
  nodes: CommandNode[];
  edges: CommandEdge[];
};
