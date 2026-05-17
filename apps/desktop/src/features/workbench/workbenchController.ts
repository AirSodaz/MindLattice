import {
  commandPreviewToWorkbenchPreview,
  mapSnapshotToWorkbenchEdges,
  mapSnapshotToWorkbenchNodes,
  type CommandClient,
  type CommandAttentionSession,
  type CommandCheckIn,
  type CommandContextProfile,
  type CommandMemory,
  type CommandPreview,
  type CommandStartPlan,
  type CommandSupportCategory,
  type CommandStrategyExperiment,
  type CommandSupportTemplate,
  type CommandVaultFile,
} from '../../shared/api/commandClient';
import { buildInitialWorkbench, type WorkbenchModel, type WorkbenchNodeKind } from './workbenchModel';
import type { PresentedCommandError } from './workbenchModel';

export type WorkbenchScreenState = {
  workspaceId: string;
  contextProfile: CommandContextProfile;
  supportTemplates: CommandSupportTemplate[];
  checkIns: CommandCheckIn[];
  preferenceMemory: CommandMemory[];
  pendingMemoryProposals: CommandMemory[];
  strategyExperiments: CommandStrategyExperiment[];
  pendingStrategyExperiments: CommandStrategyExperiment[];
  pendingVaultImport: VaultImportPreview | null;
  attentionSession: CommandAttentionSession | null;
  lastError: PresentedCommandError | null;
  workbench: WorkbenchModel;
};

export type VaultImportPreview = {
  files: CommandVaultFile[];
  fileCount: number;
  totalBytes: number;
};

export async function initializeWorkbench(client: CommandClient): Promise<WorkbenchScreenState> {
  const workspace = await client.workspaceOpenDefault();
  const [snapshot, supportTemplates, preferenceMemory, checkIns, contextProfile] = await Promise.all([
    client.mapGet(workspace.id),
    client.supportTemplatesList(),
    client.agentMemoryList(workspace.id),
    client.checkInList(workspace.id),
    client.contextProfileGet(workspace.id),
  ]);
  const nodes = mapSnapshotToWorkbenchNodes(snapshot);
  const edges = mapSnapshotToWorkbenchEdges(snapshot);
  const focusNode = nodes.find((node) => node.kind === 'task') ?? nodes[0];
  const startPlan = await startPlanForNodes(client, workspace.id, nodes);

  return {
    workspaceId: workspace.id,
    contextProfile,
    supportTemplates,
    checkIns,
    preferenceMemory,
    pendingMemoryProposals: [],
    strategyExperiments: [],
    pendingStrategyExperiments: [],
    pendingVaultImport: null,
    attentionSession: null,
    lastError: null,
    workbench: {
      ...buildInitialWorkbench(),
      focusTaskTitle: focusNode?.title ?? workspace.title,
      selectedNodeId: focusNode?.id ?? '',
      nodes,
      edges,
      activePreview: null,
      startPlan: startPlan ?? buildInitialWorkbench().startPlan,
      messages: [
        {
          id: 'agent-1',
          sender: 'agent',
          body: 'Tell me what feels messy. I will draft map changes as a preview before anything is saved.',
        },
      ],
    },
  };
}

export async function connectExistingNodes(
  client: CommandClient,
  state: WorkbenchScreenState,
  sourceId: string,
  targetId: string,
  edgeKind: string,
): Promise<WorkbenchScreenState> {
  const sourceNode = state.workbench.nodes.find((node) => node.id === sourceId);
  const targetNode = state.workbench.nodes.find((node) => node.id === targetId);
  const trimmedEdgeKind = edgeKind.trim();
  if (!sourceNode || !targetNode || sourceNode.id === targetNode.id || !trimmedEdgeKind) {
    return state;
  }

  await client.edgeCreate(state.workspaceId, sourceNode.id, targetNode.id, trimmedEdgeKind);
  const reloadedState = await reloadMap(client, state);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Connected ${sourceNode.title} to ${targetNode.title}.`,
        },
      ],
    },
  };
}

export async function moveNode(
  client: CommandClient,
  state: WorkbenchScreenState,
  nodeId: string,
  x: number,
  y: number,
): Promise<WorkbenchScreenState> {
  const node = state.workbench.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return state;
  }

  const boundedX = clampCanvasPercent(x);
  const boundedY = clampCanvasPercent(y);
  await client.nodeMove(node.id, boundedX, boundedY);
  return reloadMap(client, state, node.id);
}

export async function recordStrategyExperiment(
  client: CommandClient,
  state: WorkbenchScreenState,
  experiment: Omit<CommandStrategyExperiment, 'id'>,
): Promise<WorkbenchScreenState> {
  const savedExperiment = await client.strategyExperimentCreate({
    ...experiment,
    obstacleNote: experiment.obstacleNote?.trim() ? experiment.obstacleNote.trim() : null,
    id: `strategy-experiment-${state.strategyExperiments.length + 1}`,
  });
  const supportLabel = savedExperiment.supportTemplateId ?? savedExperiment.customSupportTitle ?? 'custom support';

  return {
    ...state,
    strategyExperiments: [...state.strategyExperiments, savedExperiment],
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Strategy experiment recorded: ${savedExperiment.nextDecision} ${supportLabel}.`,
        },
      ],
    },
  };
}

export function previewVaultImport(
  state: WorkbenchScreenState,
  files: CommandVaultFile[],
): WorkbenchScreenState {
  const markdownFiles = files.filter((file) => file.filename.toLowerCase().endsWith('.md'));
  if (markdownFiles.length === 0) {
    return state;
  }

  const pendingVaultImport: VaultImportPreview = {
    files: markdownFiles,
    fileCount: markdownFiles.length,
    totalBytes: markdownFiles.reduce((sum, file) => sum + file.content.length, 0),
  };

  return {
    ...state,
    pendingVaultImport,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Vault import preview ready: ${pendingVaultImport.fileCount} Markdown file${
            pendingVaultImport.fileCount === 1 ? '' : 's'
          }.`,
        },
      ],
    },
  };
}

export async function acceptVaultImportPreview(
  client: CommandClient,
  state: WorkbenchScreenState,
): Promise<WorkbenchScreenState> {
  if (!state.pendingVaultImport) {
    return state;
  }

  const importResult = await client.vaultImport(state.workspaceId, state.pendingVaultImport.files);
  const reloadedState = await reloadMap(client, {
    ...state,
    pendingVaultImport: null,
  });

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Vault import accepted: ${importResult.nodesCreated} node${
            importResult.nodesCreated === 1 ? '' : 's'
          } and ${importResult.edgesCreated} edge${importResult.edgesCreated === 1 ? '' : 's'} imported.`,
        },
      ],
    },
  };
}

export function rejectVaultImportPreview(state: WorkbenchScreenState): WorkbenchScreenState {
  if (!state.pendingVaultImport) {
    return state;
  }

  return {
    ...state,
    pendingVaultImport: null,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: 'Vault import preview rejected.',
        },
      ],
    },
  };
}

export function draftStrategyExperiment(
  state: WorkbenchScreenState,
  experiment: Omit<CommandStrategyExperiment, 'id'>,
): WorkbenchScreenState {
  const proposal: CommandStrategyExperiment = {
    ...experiment,
    obstacleNote: experiment.obstacleNote?.trim() ? experiment.obstacleNote.trim() : null,
    id: `strategy-experiment-proposal-${state.pendingStrategyExperiments.length + 1}`,
  };
  const supportLabel = proposal.supportTemplateId ?? proposal.customSupportTitle ?? 'custom support';

  return {
    ...state,
    pendingStrategyExperiments: [...state.pendingStrategyExperiments, proposal],
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Strategy experiment proposed for review: ${proposal.nextDecision} ${supportLabel}.`,
        },
      ],
    },
  };
}

export async function acceptStrategyExperimentProposal(
  client: CommandClient,
  state: WorkbenchScreenState,
  proposalId: string,
): Promise<WorkbenchScreenState> {
  const proposal = state.pendingStrategyExperiments.find((experiment) => experiment.id === proposalId);
  if (!proposal) {
    return state;
  }

  const savedExperiment = await client.strategyExperimentCreate(proposal);
  const supportLabel = savedExperiment.supportTemplateId ?? savedExperiment.customSupportTitle ?? 'custom support';

  return {
    ...state,
    pendingStrategyExperiments: state.pendingStrategyExperiments.filter((experiment) => experiment.id !== proposalId),
    strategyExperiments: [...state.strategyExperiments, savedExperiment],
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Strategy experiment accepted: ${savedExperiment.nextDecision} ${supportLabel}.`,
        },
      ],
    },
  };
}

export function rejectStrategyExperimentProposal(
  state: WorkbenchScreenState,
  proposalId: string,
): WorkbenchScreenState {
  const proposal = state.pendingStrategyExperiments.find((experiment) => experiment.id === proposalId);
  if (!proposal) {
    return state;
  }

  return {
    ...state,
    pendingStrategyExperiments: state.pendingStrategyExperiments.filter((experiment) => experiment.id !== proposalId),
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: 'Strategy experiment proposal rejected.',
        },
      ],
    },
  };
}

export async function updatePreferenceMemory(
  client: CommandClient,
  state: WorkbenchScreenState,
  memoryId: string,
  proposedMemoryText: string,
): Promise<WorkbenchScreenState> {
  const trimmedText = proposedMemoryText.trim();
  const existingMemory = state.preferenceMemory.find((memory) => memory.id === memoryId);
  if (!existingMemory || !trimmedText) {
    return state;
  }

  const updatedMemory = await client.agentMemoryUpdate(state.workspaceId, {
    ...existingMemory,
    proposedMemoryText: trimmedText,
  });
  const preferenceMemory = state.preferenceMemory.map((memory) =>
    memory.id === updatedMemory.id ? updatedMemory : memory,
  );

  return {
    ...state,
    preferenceMemory,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Preference memory updated: ${updatedMemory.proposedMemoryText}`,
        },
      ],
    },
  };
}

export async function acceptPreferenceMemoryProposal(
  client: CommandClient,
  state: WorkbenchScreenState,
  proposalId: string,
  proposedMemoryText: string,
): Promise<WorkbenchScreenState> {
  const proposal = state.pendingMemoryProposals.find((memory) => memory.id === proposalId);
  const trimmedText = proposedMemoryText.trim();
  if (!proposal || !trimmedText) {
    return state;
  }

  const acceptedMemory = await client.agentMemoryUpdate(state.workspaceId, {
    ...proposal,
    proposedMemoryText: trimmedText,
  });

  return {
    ...state,
    preferenceMemory: [...state.preferenceMemory, acceptedMemory],
    pendingMemoryProposals: state.pendingMemoryProposals.filter((memory) => memory.id !== proposalId),
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Preference memory accepted: ${acceptedMemory.proposedMemoryText}`,
        },
      ],
    },
  };
}

export function rejectPreferenceMemoryProposal(
  state: WorkbenchScreenState,
  proposalId: string,
): WorkbenchScreenState {
  const proposal = state.pendingMemoryProposals.find((memory) => memory.id === proposalId);
  if (!proposal) {
    return state;
  }

  return {
    ...state,
    pendingMemoryProposals: state.pendingMemoryProposals.filter((memory) => memory.id !== proposalId),
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: 'Preference memory proposal rejected.',
        },
      ],
    },
  };
}

export async function deletePreferenceMemory(
  client: CommandClient,
  state: WorkbenchScreenState,
  memoryId: string,
): Promise<WorkbenchScreenState> {
  const existingMemory = state.preferenceMemory.find((memory) => memory.id === memoryId);
  if (!existingMemory) {
    return state;
  }

  await client.agentMemoryDelete(state.workspaceId, memoryId);

  return {
    ...state,
    preferenceMemory: state.preferenceMemory.filter((memory) => memory.id !== memoryId),
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: 'Preference memory removed.',
        },
      ],
    },
  };
}

export async function startAttentionSession(
  client: CommandClient,
  state: WorkbenchScreenState,
  startedAt: string,
): Promise<WorkbenchScreenState> {
  const nextAction = state.workbench.nodes.find((node) => node.kind === 'next_action');
  if (!nextAction) {
    return state;
  }

  const attentionSession = await client.attentionSessionStart(
    nextAction.id,
    nextAction.estimateMinutes ?? 5,
    startedAt,
  );

  return {
    ...state,
    attentionSession,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Started focus session: ${nextAction.title}.`,
        },
      ],
    },
  };
}

export async function closeAttentionSession(
  client: CommandClient,
  state: WorkbenchScreenState,
  endedAt: string,
  completionNote: string,
): Promise<WorkbenchScreenState> {
  if (!state.attentionSession) {
    return state;
  }

  const trimmedNote = completionNote.trim();
  const closedSession = await client.attentionSessionClose(
    state.attentionSession.id,
    endedAt,
    trimmedNote.length > 0 ? trimmedNote : null,
  );

  return {
    ...state,
    attentionSession: null,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Closed focus session: ${closedSession.completionNote ?? 'No note recorded.'}`,
        },
      ],
    },
  };
}

export async function createCheckIn(
  client: CommandClient,
  state: WorkbenchScreenState,
  body: string,
): Promise<WorkbenchScreenState> {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return state;
  }

  const nextAction = state.workbench.nodes.find((node) => node.kind === 'next_action');
  const checkIn = await client.checkInCreate(state.workspaceId, nextAction?.id ?? null, trimmedBody);
  const memoryProposal: CommandMemory = {
    id: `memory-proposal-${checkIn.id}`,
    proposedMemoryText: checkIn.body,
    evidenceReference: checkIn.id,
  };

  return {
    ...state,
    checkIns: [...state.checkIns, checkIn],
    pendingMemoryProposals: [...state.pendingMemoryProposals, memoryProposal],
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Check-in saved: ${checkIn.body}`,
        },
        {
          id: `agent-${state.workbench.messages.length + 2}`,
          sender: 'agent',
          body: `Preference memory proposed for review: ${memoryProposal.proposedMemoryText}`,
        },
      ],
    },
  };
}

export async function adoptSupportTemplate(
  client: CommandClient,
  state: WorkbenchScreenState,
  templateId: string,
): Promise<WorkbenchScreenState> {
  const customTemplate = state.supportTemplates.find(
    (template) => template.id === templateId && template.id.startsWith('custom-support-template-'),
  );
  const adoptedNode = customTemplate
    ? await createSupportNodeFromTemplate(client, state.workspaceId, customTemplate)
    : await client.supportAdopt(state.workspaceId, templateId);
  const reloadedState = await reloadMap(client, state, adoptedNode.id);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Support adopted: ${adoptedNode.title}.`,
        },
      ],
    },
  };
}

export function saveCustomSupportTemplate(
  state: WorkbenchScreenState,
  title: string,
  body: string,
): WorkbenchScreenState {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle) {
    return state;
  }

  const template: CommandSupportTemplate = {
    id: `custom-support-template-${nextCustomSupportTemplateSequence(state.supportTemplates)}`,
    category: 'task_structure',
    title: trimmedTitle,
    steps: [trimmedBody || trimmedTitle],
    defaultContexts: ['custom'],
    sourceNote: 'User-created reusable support template.',
    safetyNote: 'Self-help execution support, not treatment advice.',
  };

  return {
    ...state,
    supportTemplates: [...state.supportTemplates, template],
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Custom support template saved: ${template.title}.`,
        },
      ],
    },
  };
}

export async function updateSupportNode(
  client: CommandClient,
  state: WorkbenchScreenState,
  supportNodeId: string,
  title: string,
  body: string,
): Promise<WorkbenchScreenState> {
  const supportNode = state.workbench.nodes.find((node) => node.id === supportNodeId && node.kind === 'support');
  const trimmedTitle = title.trim();
  if (!supportNode || !trimmedTitle) {
    return state;
  }

  const updatedNode = await client.nodeUpdate(
    supportNode.id,
    'support',
    trimmedTitle,
    body.trim().length > 0 ? body.trim() : null,
  );
  const reloadedState = await reloadMap(client, state, updatedNode.id);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Support updated: ${updatedNode.title}.`,
        },
      ],
    },
  };
}

export async function discardSupportNode(
  client: CommandClient,
  state: WorkbenchScreenState,
  supportNodeId: string,
): Promise<WorkbenchScreenState> {
  const supportNode = state.workbench.nodes.find((node) => node.id === supportNodeId && node.kind === 'support');
  if (!supportNode) {
    return state;
  }

  await client.supportDiscard(supportNode.id);
  const reloadedState = await reloadMap(client, state);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      selectedNodeId:
        reloadedState.workbench.selectedNodeId === supportNode.id
          ? reloadedState.workbench.nodes[0]?.id ?? ''
          : reloadedState.workbench.selectedNodeId,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Support discarded: ${supportNode.title}.`,
        },
      ],
    },
  };
}

export async function createCustomSupportNode(
  client: CommandClient,
  state: WorkbenchScreenState,
  title: string,
  body: string,
): Promise<WorkbenchScreenState> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return state;
  }

  const createdNode = await client.nodeCreate(state.workspaceId, 'support', trimmedTitle);
  const updatedNode = await client.nodeUpdate(
    createdNode.id,
    'support',
    trimmedTitle,
    body.trim().length > 0 ? body.trim() : null,
  );
  const reloadedState = await reloadMap(client, state, updatedNode.id);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Custom support created: ${updatedNode.title}.`,
        },
      ],
    },
  };
}

async function createSupportNodeFromTemplate(
  client: CommandClient,
  workspaceId: string,
  template: CommandSupportTemplate,
) {
  const createdNode = await client.nodeCreate(workspaceId, 'support', template.title);
  const body = `Template: ${template.id}\n\nSteps:\n${template.steps.map((step) => `- ${step}`).join('\n')}\n\nSafety: ${
    template.safetyNote
  }`;
  return client.nodeUpdate(createdNode.id, 'support', template.title, body);
}

function nextCustomSupportTemplateSequence(templates: CommandSupportTemplate[]): number {
  const sequences = templates
    .map((template) => template.id.match(/^custom-support-template-(\d+)$/)?.[1])
    .filter((sequence): sequence is string => Boolean(sequence))
    .map((sequence) => Number.parseInt(sequence, 10))
    .filter(Number.isFinite);
  return Math.max(0, ...sequences) + 1;
}

export async function createFocusTask(
  client: CommandClient,
  state: WorkbenchScreenState,
  title: string,
): Promise<WorkbenchScreenState> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return state;
  }

  const taskNode = await client.nodeCreate(state.workspaceId, 'task', trimmedTitle);
  const reloadedState = await reloadMap(client, state, taskNode.id);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: sentenceWithTitle('Created focus task', taskNode.title),
        },
      ],
    },
  };
}

export async function addConnectedNode(
  client: CommandClient,
  state: WorkbenchScreenState,
  kind: WorkbenchNodeKind,
  title: string,
): Promise<WorkbenchScreenState> {
  const selectedNodeId = state.workbench.selectedNodeId;
  const trimmedTitle = title.trim();
  if (!selectedNodeId || !trimmedTitle) {
    return state;
  }

  const node = await client.nodeCreate(state.workspaceId, kind, trimmedTitle);
  await client.edgeCreate(state.workspaceId, selectedNodeId, node.id, edgeKindForNode(kind));
  const reloadedState = await reloadMap(client, state, node.id);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Added ${kind.replace('_', ' ')}: ${node.title}.`,
        },
      ],
    },
  };
}

export async function saveSelectedNodeDetails(
  client: CommandClient,
  state: WorkbenchScreenState,
  title: string,
  body: string,
): Promise<WorkbenchScreenState> {
  const selectedNode = state.workbench.nodes.find((node) => node.id === state.workbench.selectedNodeId);
  const trimmedTitle = title.trim();
  if (!selectedNode || !trimmedTitle) {
    return state;
  }

  const updatedNode = await client.nodeUpdate(
    selectedNode.id,
    selectedNode.kind,
    trimmedTitle,
    body.trim().length > 0 ? body.trim() : null,
  );
  const reloadedState = await reloadMap(client, state, updatedNode.id);

  return {
    ...reloadedState,
    workbench: {
      ...reloadedState.workbench,
      messages: [
        ...reloadedState.workbench.messages,
        {
          id: `agent-${reloadedState.workbench.messages.length + 1}`,
          sender: 'agent',
          body: `Saved node: ${updatedNode.title}.`,
        },
      ],
    },
  };
}

export async function submitAgentMessage(
  client: CommandClient,
  state: WorkbenchScreenState,
  message: string,
): Promise<WorkbenchScreenState> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return state;
  }
  if (state.contextProfile.llmProviderSetupState !== 'configured') {
    return createFocusTask(client, state, trimmedMessage);
  }

  const response = await client.agentTurnSubmit(
    state.workspaceId,
    state.workbench.selectedNodeId || null,
    trimmedMessage,
  );
  const reviewState = queuePreviewReviewProposals(state, response.preview ?? null);

  return {
    ...reviewState,
    workbench: {
      ...reviewState.workbench,
      activePreview: response.preview ? activeGraphPreviewOrNull(response.preview) : null,
      messages: [
        ...reviewState.workbench.messages,
        {
          id: `user-${reviewState.workbench.messages.length + 1}`,
          sender: 'user',
          body: trimmedMessage,
        },
        {
          id: `agent-${reviewState.workbench.messages.length + 2}`,
          sender: 'agent',
          body: response.message,
        },
      ],
    },
  };
}

export async function saveLlmSettings(
  client: CommandClient,
  state: WorkbenchScreenState,
  baseUrl: string,
  apiKey: string,
  model: string,
  timeoutSeconds: number,
): Promise<WorkbenchScreenState> {
  await client.settingsUpdateLlm(baseUrl.trim(), apiKey.trim(), model.trim(), timeoutSeconds);
  const contextProfile = await client.contextProfileUpdate({
    ...state.contextProfile,
    llmProviderSetupState: 'configured',
  });

  return {
    ...state,
    contextProfile,
    lastError: null,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: 'LLM provider configured for local review.',
        },
      ],
    },
  };
}

export async function saveOnboardingProfile(
  client: CommandClient,
  state: WorkbenchScreenState,
  adultContexts: string[],
  executionDifficulties: string[],
  preferredSupportCategories: CommandSupportCategory[],
): Promise<WorkbenchScreenState> {
  const contextProfile = await client.contextProfileUpdate({
    ...state.contextProfile,
    adultContexts: cleanStringList(adultContexts),
    executionDifficulties: cleanStringList(executionDifficulties),
    preferredSupportCategories,
  });

  return {
    ...state,
    contextProfile,
    lastError: null,
    workbench: {
      ...state.workbench,
      messages: [
        ...state.workbench.messages,
        {
          id: `agent-${state.workbench.messages.length + 1}`,
          sender: 'agent',
          body: 'Onboarding preferences saved for local support matching.',
        },
      ],
    },
  };
}

function cleanStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

export async function reviseActivePreview(
  client: CommandClient,
  state: WorkbenchScreenState,
  message: string,
): Promise<WorkbenchScreenState> {
  const preview = state.workbench.activePreview;
  const trimmedMessage = message.trim();
  if (!preview || !trimmedMessage) {
    return state;
  }

  const response = await client.agentPreviewRevise(state.workspaceId, preview.id, trimmedMessage);
  const reviewState = queuePreviewReviewProposals(state, response.preview ?? null);

  return {
    ...reviewState,
    workbench: {
      ...reviewState.workbench,
      activePreview: response.preview ? activeGraphPreviewOrNull(response.preview) : preview,
      messages: [
        ...reviewState.workbench.messages,
        {
          id: `user-${reviewState.workbench.messages.length + 1}`,
          sender: 'user',
          body: trimmedMessage,
        },
        {
          id: `agent-${reviewState.workbench.messages.length + 2}`,
          sender: 'agent',
          body: response.message,
        },
      ],
    },
  };
}

function queuePreviewReviewProposals(
  state: WorkbenchScreenState,
  preview: CommandPreview | null,
): WorkbenchScreenState {
  if (!preview) {
    return state;
  }
  if (hasGraphPreviewContent(preview)) {
    return state;
  }

  return {
    ...state,
    pendingMemoryProposals: [...state.pendingMemoryProposals, ...(preview.proposedMemory ?? [])],
    pendingStrategyExperiments: [
      ...state.pendingStrategyExperiments,
      ...(preview.proposedStrategyExperiments ?? []),
    ],
  };
}

function activeGraphPreviewOrNull(preview: CommandPreview): WorkbenchModel['activePreview'] {
  if (!hasGraphPreviewContent(preview)) {
    return null;
  }
  return commandPreviewToWorkbenchPreview(preview);
}

function hasGraphPreviewContent(preview: CommandPreview): boolean {
  return preview.proposedNodes.length > 0 || preview.proposedEdges.length > 0;
}

export async function acceptActivePreview(
  client: CommandClient,
  state: WorkbenchScreenState,
): Promise<WorkbenchScreenState> {
  const preview = state.workbench.activePreview;
  if (!preview) {
    return state;
  }

  await client.agentPreviewAccept(state.workspaceId, preview.id);
  return reloadMap(client, {
    ...state,
    workbench: {
      ...state.workbench,
      activePreview: null,
    },
  });
}

export async function rejectActivePreview(
  client: CommandClient,
  state: WorkbenchScreenState,
): Promise<WorkbenchScreenState> {
  const preview = state.workbench.activePreview;
  if (!preview) {
    return state;
  }

  await client.agentPreviewReject(preview.id);
  return {
    ...state,
    workbench: {
      ...state.workbench,
      activePreview: null,
    },
  };
}

async function reloadMap(
  client: CommandClient,
  state: WorkbenchScreenState,
  preferredSelectedNodeId?: string,
): Promise<WorkbenchScreenState> {
  const snapshot = await client.mapGet(state.workspaceId);
  const nodes = mapSnapshotToWorkbenchNodes(snapshot);
  const edges = mapSnapshotToWorkbenchEdges(snapshot);
  const startPlan = await startPlanForNodes(client, state.workspaceId, nodes);
  const selectedNodeId = preferredSelectedNodeId ?? state.workbench.selectedNodeId;
  const selectedNodeExists = nodes.some((node) => node.id === selectedNodeId);

  return {
    ...state,
    workbench: {
      ...state.workbench,
      focusTaskTitle: nodes.find((node) => node.kind === 'task')?.title ?? state.workbench.focusTaskTitle,
      selectedNodeId: selectedNodeExists ? selectedNodeId : (nodes[0]?.id ?? ''),
      nodes,
      edges,
      startPlan: startPlan ?? state.workbench.startPlan,
    },
  };
}

async function startPlanForNodes(
  client: CommandClient,
  workspaceId: string,
  nodes: WorkbenchModel['nodes'],
): Promise<WorkbenchModel['startPlan'] | null> {
  const nextAction = nodes.find((node) => node.kind === 'next_action');
  if (!nextAction) {
    return null;
  }

  return startPlanToWorkbench(await client.startPlanGet(workspaceId, nextAction.id));
}

function startPlanToWorkbench(startPlan: CommandStartPlan): WorkbenchModel['startPlan'] {
  return {
    nextAction: startPlan.selectedNextAction.title,
    minimumDone: startPlan.minimumDone ?? 'Define the smallest visible finish line.',
    checks: [
      startPlan.startCheck.neededMaterials.length > 0
        ? `Materials: ${startPlan.startCheck.neededMaterials.join(', ')}`
        : 'Materials ready',
      startPlan.startCheck.currentDistraction
        ? `Distraction: ${startPlan.startCheck.currentDistraction}`
        : 'No distraction named',
      startPlan.startCheck.fiveMinuteFit ? 'Five-minute fit' : 'Make it smaller',
      startPlan.startCheck.reopenTarget,
    ],
  };
}

function edgeKindForNode(kind: WorkbenchNodeKind): string {
  if (kind === 'blocker') {
    return 'blocked_by';
  }
  if (kind === 'support' || kind === 'resource' || kind === 'environment_adjustment') {
    return 'supports';
  }
  if (kind === 'routine_anchor') {
    return 'anchors';
  }
  if (kind === 'attention_guard') {
    return 'protects';
  }
  if (kind === 'next_action' || kind === 'subtask') {
    return 'breaks_down_to';
  }
  return 'related';
}

function clampCanvasPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function sentenceWithTitle(prefix: string, title: string): string {
  return /[.!?]$/.test(title) ? `${prefix}: ${title}` : `${prefix}: ${title}.`;
}
