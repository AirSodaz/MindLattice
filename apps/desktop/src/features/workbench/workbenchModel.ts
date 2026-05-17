import type { CommandNodeKind } from '../../shared/api/generated/commandDtos';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type WorkbenchShortcutAction = 'focus-capture' | 'save-selected-node' | 'start-mode';
export type WorkbenchViewMode = 'map' | 'start';
export type ProviderReadiness = 'not_configured' | 'editing' | 'testing' | 'configured' | 'failed';
export type TurnState = 'idle' | 'submitting' | 'drafting' | 'validating' | 'awaiting_review' | 'blocked' | 'failed';
export type WorkbenchTaskPanel = 'support' | 'memory' | 'vault' | 'settings' | 'diagnostics' | null;
export type RightPaneMode =
  | 'setup'
  | 'empty'
  | 'preview'
  | 'canvas'
  | 'start'
  | 'safety'
  | 'advanced_map'
  | 'task_panel';
export type WorkbenchDrawer =
  | null
  | 'preview'
  | 'inspector'
  | 'support'
  | 'start'
  | 'vault'
  | 'memory'
  | 'settings';

export type ActiveAttentionSession = {
  intendedDurationMinutes: number | null;
  startedAt: string;
  state: string;
};

export type WorkbenchShortcutEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

export type WorkbenchNodeKind = CommandNodeKind;

export type WorkbenchNode = {
  id: string;
  kind: WorkbenchNodeKind;
  title: string;
  body?: string | null;
  status: string;
  x: number;
  y: number;
  minimumDone?: string;
  estimateMinutes?: number;
};

export type WorkbenchEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: string;
};

export type ReactFlowCanvasSize = {
  width: number;
  height: number;
};

export type ReactFlowWorkbenchNode = {
  id: string;
  type: 'workbenchNode';
  position: { x: number; y: number };
  selected: boolean;
  draggable: boolean;
  data: {
    kind: WorkbenchNodeKind;
    title: string;
    status: string;
    body?: string | null;
  };
};

export type ReactFlowWorkbenchEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
  data: {
    kind: string;
  };
};

export type ReactFlowWorkbenchElements = {
  nodes: ReactFlowWorkbenchNode[];
  edges: ReactFlowWorkbenchEdge[];
};

export type AgentPreviewModel = {
  id: string;
  proposedNodes: WorkbenchNode[];
  proposedEdges: Array<{ id: string; sourceId: string; targetId: string; kind: string }>;
  proposedMemory?: unknown[];
  proposedCheckIns?: unknown[];
  proposedStrategyExperiments?: unknown[];
};

export type WorkbenchModel = {
  viewMode: WorkbenchViewMode;
  focusTaskTitle: string;
  selectedNodeId: string;
  nodes: WorkbenchNode[];
  edges: WorkbenchEdge[];
  activePreview: AgentPreviewModel | null;
  messages: Array<{ id: string; sender: 'user' | 'agent'; body: string }>;
  startPlan: {
    nextAction: string;
    minimumDone: string;
    checks: string[];
  };
};

export type StartModeDetail = {
  label: string;
  value: string;
};

export type StartModeView = {
  nextAction: string;
  minimumDone: string;
  checks: string[];
  details: StartModeDetail[];
};

export type StartTimerState = {
  label: string;
  elapsedMinutes: number;
  remainingMinutes: number;
  isOverPlannedTime: boolean;
};

export type PresentedCommandError = {
  message: string;
  detail: string;
};

export type RightPaneSelectionInput = {
  providerSetupRequired: boolean;
  setupRequested: boolean;
  safetyRedirectActive: boolean;
  activePreview: AgentPreviewModel | null;
  viewMode: WorkbenchViewMode;
  hasGraphContext: boolean;
  advancedMapRequested: boolean;
  startRequested: boolean;
  taskPanel: WorkbenchTaskPanel;
};

export function drawerTitle(drawer: WorkbenchDrawer): string {
  const titles: Record<Exclude<WorkbenchDrawer, null>, string> = {
    preview: 'Agent preview',
    inspector: 'Selected node',
    support: 'Support templates',
    start: 'Start Mode',
    vault: 'Vault import/export',
    memory: 'Preference memory',
    settings: 'Settings',
  };
  return drawer ? titles[drawer] : 'Context drawer';
}

export function selectRightPaneMode(input: RightPaneSelectionInput): RightPaneMode {
  if (input.providerSetupRequired && input.setupRequested) {
    return 'setup';
  }
  if (input.safetyRedirectActive) {
    return 'safety';
  }
  if (input.activePreview) {
    return 'preview';
  }
  if (input.viewMode === 'start' || input.startRequested) {
    return 'start';
  }
  if (input.advancedMapRequested) {
    return 'advanced_map';
  }
  if (input.taskPanel) {
    return 'task_panel';
  }
  if (input.hasGraphContext) {
    return 'canvas';
  }
  return 'empty';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

export function resolveWorkbenchShortcut(event: WorkbenchShortcutEvent): WorkbenchShortcutAction | null {
  const usesPrimaryModifier = Boolean(event.ctrlKey || event.metaKey);
  if (!usesPrimaryModifier || event.altKey || event.shiftKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === 'k') {
    return 'focus-capture';
  }
  if (key === 's') {
    return 'save-selected-node';
  }
  if (key === 'enter') {
    return 'start-mode';
  }

  return null;
}

export function buildInitialWorkbench(): WorkbenchModel {
  return {
    viewMode: 'map',
    focusTaskTitle: 'Plan launch notes',
    selectedNodeId: 'task-1',
    nodes: [
      {
        id: 'task-1',
        kind: 'task',
        title: 'Plan launch notes',
        status: 'Active',
        x: 43,
        y: 42,
        minimumDone: 'A rough outline exists.',
        estimateMinutes: 20,
      },
      {
        id: 'blocker-1',
        kind: 'blocker',
        title: 'Missing examples',
        status: 'Visible',
        x: 20,
        y: 31,
      },
      {
        id: 'resource-1',
        kind: 'resource',
        title: 'Reference notes',
        status: 'Nearby',
        x: 18,
        y: 62,
      },
      {
        id: 'support-1',
        kind: 'support',
        title: 'Visible short checklist',
        status: 'Adopted',
        x: 64,
        y: 24,
      },
      {
        id: 'next-1',
        kind: 'next_action',
        title: 'Open the draft and write three bullets',
        status: 'Next',
        x: 67,
        y: 63,
        minimumDone: 'Three rough bullets exist.',
        estimateMinutes: 5,
      },
    ],
    edges: [],
    activePreview: {
      id: 'preview-1',
      proposedNodes: [
        {
          id: 'draft-next-2',
          kind: 'next_action',
          title: 'Find one example to paste below the outline',
          status: 'Draft',
          x: 46,
          y: 76,
          minimumDone: 'One example link is visible.',
          estimateMinutes: 5,
        },
      ],
      proposedEdges: [{ id: 'draft-edge-1', sourceId: 'task-1', targetId: 'draft-next-2', kind: 'breaks_down_to' }],
    },
    messages: [
      {
        id: 'agent-1',
        sender: 'agent',
        body: 'I drafted one smaller next action and kept it as a preview. Nothing is saved until you accept it.',
      },
      {
        id: 'user-1',
        sender: 'user',
        body: 'Only keep the action that helps me start in five minutes.',
      },
    ],
    startPlan: {
      nextAction: 'Open the draft and write three bullets',
      minimumDone: 'Stop after three rough bullets. No polish yet.',
      checks: ['Material visible', 'Distraction named', 'Five-minute fit', 'Return cue ready'],
    },
  };
}

export function getSelectedNode(model: WorkbenchModel): WorkbenchNode | undefined {
  return model.nodes.find((node) => node.id === model.selectedNodeId);
}

export function buildStartModeView(model: WorkbenchModel): StartModeView {
  const nextActionNode = model.nodes.find((node) => node.title === model.startPlan.nextAction) ?? model.nodes.find((node) => node.kind === 'next_action');
  const parentTask = model.nodes.find((node) => node.kind === 'task');
  const currentBlocker = model.nodes.find((node) => node.kind === 'blocker');
  const support =
    model.nodes.find((node) => node.kind === 'support') ??
    model.nodes.find((node) => node.kind === 'environment_adjustment');
  const estimateMinutes = nextActionNode?.estimateMinutes;
  const returnCue = model.startPlan.checks.find((check) => check.toLowerCase().startsWith('return to:'));

  return {
    nextAction: model.startPlan.nextAction,
    minimumDone: model.startPlan.minimumDone,
    checks: model.startPlan.checks,
    details: [
      parentTask ? { label: 'Parent task', value: parentTask.title } : null,
      estimateMinutes ? { label: 'Estimate', value: `${estimateMinutes} min` } : null,
      currentBlocker ? { label: 'Current blocker', value: currentBlocker.title } : null,
      support ? { label: support.kind === 'environment_adjustment' ? 'Adjustment' : 'Support', value: support.title } : null,
      { label: 'Return cue', value: returnCue ?? `Return to: ${model.startPlan.nextAction}` },
    ].filter((detail): detail is StartModeDetail => detail !== null),
  };
}

export function enterStartMode(model: WorkbenchModel): WorkbenchModel {
  if (!model.nodes.some((node) => node.kind === 'next_action')) {
    return model;
  }

  return {
    ...model,
    viewMode: 'start',
  };
}

export function leaveStartMode(model: WorkbenchModel): WorkbenchModel {
  return {
    ...model,
    viewMode: 'map',
  };
}

export function buildStartTimerState(
  session: ActiveAttentionSession | null,
  nowIso: string,
): StartTimerState | null {
  if (!session || session.state !== 'active') {
    return null;
  }

  const startedAtMs = Date.parse(session.startedAt);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    return null;
  }

  const elapsedMinutes = Math.max(0, Math.floor((nowMs - startedAtMs) / 60_000));
  const intendedDurationMinutes = session.intendedDurationMinutes ?? 5;
  const remainingMinutes = Math.max(0, intendedDurationMinutes - elapsedMinutes);

  return {
    label: `${elapsedMinutes} min elapsed`,
    elapsedMinutes,
    remainingMinutes,
    isOverPlannedTime: remainingMinutes === 0 && elapsedMinutes > intendedDurationMinutes,
  };
}

export function followUpPromptOptions(): string[] {
  return [
    'Did you start?',
    'Where did it get stuck?',
    'Did this support help?',
    'Should the next action be smaller?',
    'What needs to be visible next time?',
  ];
}

export function presentCommandError(error: unknown): PresentedCommandError {
  if (error instanceof Error) {
    return {
      message: error.message,
      detail: error.message,
    };
  }
  if (typeof error === 'string') {
    return {
      message: error,
      detail: error,
    };
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : 'Something went wrong.';
    const detail = typeof record.code === 'string' ? record.code : JSON.stringify(record);
    return { message, detail };
  }

  return {
    message: 'Something went wrong.',
    detail: 'Unknown command error.',
  };
}

export function previewWriteSummary(preview: AgentPreviewModel | null): string {
  if (!preview) {
    return 'No active preview.';
  }
  const nodeCount = preview.proposedNodes.length;
  const edgeCount = preview.proposedEdges.length;
  const memoryCount = preview.proposedMemory?.length ?? 0;
  const checkInCount = preview.proposedCheckIns?.length ?? 0;
  const strategyExperimentCount = preview.proposedStrategyExperiments?.length ?? 0;
  return `Accepting will add ${nodeCount} draft node${nodeCount === 1 ? '' : 's'}, ${edgeCount} draft edge${
    edgeCount === 1 ? '' : 's'
  }, ${memoryCount} memory update${memoryCount === 1 ? '' : 's'}, ${checkInCount} check-in${
    checkInCount === 1 ? '' : 's'
  }, and ${strategyExperimentCount} strategy experiment${strategyExperimentCount === 1 ? '' : 's'}.`;
}

export function reactFlowElementsFromWorkbench(
  model: WorkbenchModel,
  canvasSize: ReactFlowCanvasSize,
): ReactFlowWorkbenchElements {
  const persistedNodes = model.nodes.map((node) => reactFlowNodeFromWorkbenchNode(model, node, canvasSize, false));
  const previewNodes =
    model.activePreview?.proposedNodes.map((node) =>
      reactFlowNodeFromWorkbenchNode(model, node, canvasSize, true),
    ) ?? [];
  const persistedEdges = model.edges.map((edge) => reactFlowEdgeFromWorkbenchEdge(edge, false));
  const previewEdges =
    model.activePreview?.proposedEdges.map((edge) => reactFlowEdgeFromWorkbenchEdge(edge, true)) ?? [];

  return {
    nodes: [...persistedNodes, ...previewNodes],
    edges: [...persistedEdges, ...previewEdges],
  };
}

export function percentFromReactFlowPosition(
  position: { x: number; y: number },
  canvasSize: ReactFlowCanvasSize,
): { x: number; y: number } {
  if (canvasSize.width <= 0 || canvasSize.height <= 0) {
    return { x: 50, y: 50 };
  }

  return {
    x: clampPercent((position.x / canvasSize.width) * 100),
    y: clampPercent((position.y / canvasSize.height) * 100),
  };
}

function reactFlowNodeFromWorkbenchNode(
  model: WorkbenchModel,
  node: WorkbenchNode,
  canvasSize: ReactFlowCanvasSize,
  isPreview: boolean,
): ReactFlowWorkbenchNode {
  return {
    id: node.id,
    type: 'workbenchNode',
    position: {
      x: Math.round((node.x / 100) * canvasSize.width),
      y: Math.round((node.y / 100) * canvasSize.height),
    },
    selected: !isPreview && node.id === model.selectedNodeId,
    draggable: !isPreview,
    data: {
      kind: node.kind,
      title: node.title,
      status: isPreview ? 'Draft' : node.status,
      body: node.body,
    },
  };
}

function reactFlowEdgeFromWorkbenchEdge(
  edge: { id: string; sourceId: string; targetId: string; kind: string },
  isPreview: boolean,
): ReactFlowWorkbenchEdge {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.kind.replaceAll('_', ' '),
    animated: isPreview,
    data: {
      kind: edge.kind,
    },
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function applyAgentPreview(model: WorkbenchModel): WorkbenchModel {
  if (!model.activePreview) {
    return model;
  }
  return {
    ...model,
    nodes: [...model.nodes, ...model.activePreview.proposedNodes.map((node) => ({ ...node, status: 'Next' }))],
    activePreview: null,
  };
}

export function rejectActivePreview(model: WorkbenchModel): WorkbenchModel {
  return {
    ...model,
    activePreview: null,
  };
}
