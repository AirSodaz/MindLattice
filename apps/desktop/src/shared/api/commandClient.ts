import type {
  AgentPreviewModel,
  WorkbenchEdge,
  WorkbenchNode,
} from '../../features/workbench/workbenchModel';
import type {
  CommandAgentResponse,
  CommandAppSettings,
  CommandAttentionSession,
  CommandCheckIn,
  CommandContextProfile,
  CommandEdge,
  CommandExperimentContext,
  CommandLlmSettings,
  CommandLlmTestResult,
  CommandMapSnapshot,
  CommandMemory,
  CommandNode,
  CommandNodeKind,
  CommandPreview,
  CommandStartPlan,
  CommandStrategyCard,
  CommandStrategyDecision,
  CommandStrategyExperiment,
  CommandSupportCategory,
  CommandSupportTemplate,
  CommandVaultExport,
  CommandVaultFile,
  CommandVaultImport,
  CommandWorkspace,
} from './generated/commandDtos';

export type CommandVaultFolderExport = {
  directory: string;
  filesWritten: number;
};

export type VaultExportProfile = 'obsidian_readable' | 'plain_markdown';

export type {
  CommandAgentResponse,
  CommandAppSettings,
  CommandAttentionSession,
  CommandCheckIn,
  CommandContextProfile,
  CommandEdge,
  CommandExperimentContext,
  CommandLlmSettings,
  CommandLlmTestResult,
  CommandMapSnapshot,
  CommandMemory,
  CommandNode,
  CommandNodeKind,
  CommandPreview,
  CommandStartPlan,
  CommandStrategyCard,
  CommandStrategyDecision,
  CommandStrategyExperiment,
  CommandSupportCategory,
  CommandSupportTemplate,
  CommandVaultExport,
  CommandVaultFile,
  CommandVaultImport,
  CommandWorkspace,
} from './generated/commandDtos';

export type CommandClient = {
  workspaceOpenDefault: () => Promise<CommandWorkspace>;
  mapGet: (workspaceId: string) => Promise<CommandMapSnapshot>;
  nodeCreate: (workspaceId: string, kind: CommandNodeKind, title: string) => Promise<CommandNode>;
  nodeUpdate: (
    nodeId: string,
    kind: CommandNodeKind,
    title: string,
    body: string | null,
  ) => Promise<CommandNode>;
  nodeMove: (nodeId: string, x: number, y: number) => Promise<CommandNode>;
  edgeCreate: (workspaceId: string, sourceId: string, targetId: string, kind: string) => Promise<CommandEdge>;
  edgeDelete: (edgeId: string) => Promise<void>;
  supportTemplatesList: () => Promise<CommandSupportTemplate[]>;
  supportAdopt: (workspaceId: string, templateId: string) => Promise<CommandNode>;
  supportDiscard: (supportNodeId: string) => Promise<void>;
  strategyCardsList: () => Promise<CommandStrategyCard[]>;
  strategyExperimentCreate: (experiment: CommandStrategyExperiment) => Promise<CommandStrategyExperiment>;
  attentionSessionStart: (
    nextActionId: string,
    intendedDurationMinutes: number,
    startedAt: string,
  ) => Promise<CommandAttentionSession>;
  contextProfileGet: (workspaceId: string) => Promise<CommandContextProfile>;
  contextProfileUpdate: (profile: CommandContextProfile) => Promise<CommandContextProfile>;
  agentTurnSubmit: (
    workspaceId: string,
    selectedNodeId: string | null,
    message: string,
  ) => Promise<CommandAgentResponse>;
  agentPreviewGet: (previewId: string) => Promise<CommandPreview | null>;
  agentPreviewAccept: (workspaceId: string, previewId: string) => Promise<void>;
  agentPreviewReject: (previewId: string) => Promise<void>;
  agentPreviewRevise: (
    workspaceId: string,
    previewId: string,
    message: string,
  ) => Promise<CommandAgentResponse>;
  startPlanGet: (workspaceId: string, nextActionId: string) => Promise<CommandStartPlan>;
  attentionSessionClose: (
    sessionId: string,
    endedAt: string,
    completionNote: string | null,
  ) => Promise<CommandAttentionSession>;
  agentMemoryList: (workspaceId: string) => Promise<CommandMemory[]>;
  agentMemoryUpdate: (workspaceId: string, memory: CommandMemory) => Promise<CommandMemory>;
  agentMemoryDelete: (workspaceId: string, memoryId: string) => Promise<void>;
  vaultExport: (workspaceId: string, profile?: VaultExportProfile) => Promise<CommandVaultExport>;
  vaultExportToFolder: (workspaceId: string, profile?: VaultExportProfile) => Promise<CommandVaultFolderExport | null>;
  vaultPickImportFolder: () => Promise<CommandVaultFile[]>;
  vaultImport: (workspaceId: string, files: CommandVaultFile[]) => Promise<CommandVaultImport>;
  checkInCreate: (workspaceId: string, nodeId: string | null, body: string) => Promise<CommandCheckIn>;
  checkInList: (workspaceId: string) => Promise<CommandCheckIn[]>;
  settingsGetApp: () => Promise<CommandAppSettings>;
  settingsTestLlm: (
    providerId: string,
    apiMode: string,
    baseUrl: string,
    apiKey: string,
    model: string,
    timeoutSeconds: number,
  ) => Promise<CommandLlmTestResult>;
  settingsUpdateLlm: (
    providerId: string,
    apiMode: string,
    baseUrl: string,
    apiKey: string,
    model: string,
    timeoutSeconds: number,
  ) => Promise<CommandLlmSettings>;
  settingsUpdateInterface: (
    themePreference: CommandAppSettings['themePreference'],
    languagePreference: CommandAppSettings['languagePreference'],
  ) => Promise<CommandAppSettings>;
};

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type NativeVaultFileEntry = {
  name?: string;
  isFile?: boolean;
  isDirectory?: boolean;
};

export type NativeVaultFileTransport = {
  openDialog: (options: Record<string, unknown>) => Promise<string | string[] | null>;
  readDir?: (directory: string) => Promise<NativeVaultFileEntry[]>;
  readTextFile?: (path: string) => Promise<string>;
  writeTextFile?: (path: string, content: string) => Promise<void>;
  joinPath?: (...parts: string[]) => Promise<string>;
};

export type CommandClientRuntime = {
  isTauri?: boolean;
  invoke?: TauriInvoke;
};

const initialWorkspace: CommandWorkspace = { id: 'default-workspace', title: 'Default workspace' };

export function createCommandClient(runtime: CommandClientRuntime = browserRuntime()): CommandClient {
  if (runtime.isTauri && runtime.invoke) {
    return createTauriCommandClient(runtime.invoke);
  }
  return createMockCommandClient();
}

export function createTauriCommandClient(
  invoke: TauriInvoke,
  nativeVaultTransport: NativeVaultFileTransport = tauriNativeVaultTransport(),
): CommandClient {
  return {
    workspaceOpenDefault: () => invoke<CommandWorkspace>('workspace_open_default'),
    mapGet: (workspaceId) => invoke<CommandMapSnapshot>('map_get', { workspaceId }),
    nodeCreate: (workspaceId, kind, title) =>
      invoke<CommandNode>('node_create', { workspaceId, kind, title }),
    nodeUpdate: (nodeId, kind, title, body) =>
      invoke<CommandNode>('node_update', { nodeId, kind, title, body }),
    nodeMove: (nodeId, x, y) => invoke<CommandNode>('node_move', { nodeId, x, y }),
    edgeCreate: (workspaceId, sourceId, targetId, kind) =>
      invoke<CommandEdge>('edge_create', { workspaceId, sourceId, targetId, kind }),
    edgeDelete: (edgeId) => invoke<void>('edge_delete', { edgeId }),
    supportTemplatesList: () => invoke<CommandSupportTemplate[]>('support_templates_list'),
    supportAdopt: (workspaceId, templateId) =>
      invoke<CommandNode>('support_adopt', { workspaceId, templateId }),
    supportDiscard: (supportNodeId) => invoke<void>('support_discard', { supportNodeId }),
    strategyCardsList: () => invoke<CommandStrategyCard[]>('strategy_cards_list'),
    strategyExperimentCreate: (experiment) =>
      invoke<CommandStrategyExperiment>('strategy_experiment_create', { experiment }),
    attentionSessionStart: (nextActionId, intendedDurationMinutes, startedAt) =>
      invoke<CommandAttentionSession>('attention_session_start', {
        nextActionId,
        intendedDurationMinutes,
        startedAt,
      }),
    contextProfileGet: (workspaceId) => invoke<CommandContextProfile>('context_profile_get', { workspaceId }),
    contextProfileUpdate: (profile) =>
      invoke<CommandContextProfile>('context_profile_update', { profile }),
    agentTurnSubmit: (workspaceId, selectedNodeId, message) =>
      invoke<CommandAgentResponse>('agent_turn_submit', { workspaceId, selectedNodeId, message }),
    agentPreviewGet: (previewId) => invoke<CommandPreview | null>('agent_preview_get', { previewId }),
    agentPreviewAccept: (workspaceId, previewId) =>
      invoke<void>('agent_preview_accept', { workspaceId, previewId }),
    agentPreviewReject: (previewId) => invoke<void>('agent_preview_reject', { previewId }),
    agentPreviewRevise: (workspaceId, previewId, message) =>
      invoke<CommandAgentResponse>('agent_preview_revise', { workspaceId, previewId, message }),
    startPlanGet: (workspaceId, nextActionId) =>
      invoke<CommandStartPlan>('start_plan_get', { workspaceId, nextActionId }),
    attentionSessionClose: (sessionId, endedAt, completionNote) =>
      invoke<CommandAttentionSession>('attention_session_close', { sessionId, endedAt, completionNote }),
    agentMemoryList: (workspaceId) => invoke<CommandMemory[]>('agent_memory_list', { workspaceId }),
    agentMemoryUpdate: (workspaceId, memory) =>
      invoke<CommandMemory>('agent_memory_update', { workspaceId, memory }),
    agentMemoryDelete: (workspaceId, memoryId) =>
      invoke<void>('agent_memory_delete', { workspaceId, memoryId }),
    vaultExport: async (workspaceId, profile = 'obsidian_readable') => {
      const exported = await invoke<CommandVaultExport>('vault_export', { workspaceId });
      return applyVaultExportProfile(exported, profile);
    },
    vaultExportToFolder: async (workspaceId, profile = 'obsidian_readable') => {
      if (!nativeVaultTransport.writeTextFile || !nativeVaultTransport.joinPath) {
        throw new Error('Native Vault export transport is unavailable.');
      }
      const directory = await pickSingleDirectory(nativeVaultTransport, {
        canCreateDirectories: true,
        directory: true,
        multiple: false,
        title: 'Choose Markdown export folder',
      });
      if (!directory) {
        return null;
      }
      const exported = applyVaultExportProfile(await invoke<CommandVaultExport>('vault_export', { workspaceId }), profile);
      await Promise.all(
        exported.files.map(async (file) => {
          const path = await nativeVaultTransport.joinPath!(directory, file.filename);
          await nativeVaultTransport.writeTextFile!(path, file.content);
        }),
      );
      return { directory, filesWritten: exported.files.length };
    },
    vaultPickImportFolder: async () => {
      if (!nativeVaultTransport.readDir || !nativeVaultTransport.readTextFile || !nativeVaultTransport.joinPath) {
        throw new Error('Native Vault import transport is unavailable.');
      }
      const directory = await pickSingleDirectory(nativeVaultTransport, {
        directory: true,
        multiple: false,
        recursive: false,
        title: 'Choose Markdown import folder',
      });
      if (!directory) {
        return [];
      }
      const entries = await nativeVaultTransport.readDir(directory);
      return Promise.all(
        entries
          .filter((entry) => entry.isFile && entry.name?.toLowerCase().endsWith('.md'))
          .map(async (entry) => {
            const filename = entry.name!;
            const path = await nativeVaultTransport.joinPath!(directory, filename);
            return {
              filename,
              content: await nativeVaultTransport.readTextFile!(path),
            };
          }),
      );
    },
    vaultImport: (workspaceId, files) => invoke<CommandVaultImport>('vault_import', { workspaceId, files }),
    checkInCreate: (workspaceId, nodeId, body) =>
      invoke<CommandCheckIn>('check_in_create', { workspaceId, nodeId, body }),
    checkInList: (workspaceId) => invoke<CommandCheckIn[]>('check_in_list', { workspaceId }),
    settingsGetApp: () => invoke<CommandAppSettings>('settings_get_app'),
    settingsTestLlm: (providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds) =>
      invoke<CommandLlmTestResult>('settings_test_llm', { providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds }),
    settingsUpdateLlm: (providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds) =>
      invoke<CommandLlmSettings>('settings_update_llm', { providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds }),
    settingsUpdateInterface: (themePreference, languagePreference) =>
      invoke<CommandAppSettings>('settings_update_interface', { themePreference, languagePreference }),
  };
}

export function createMockCommandClient(): CommandClient {
  const state: {
    workspace: CommandWorkspace;
    nodes: CommandNode[];
    edges: CommandEdge[];
    activePreviews: CommandPreview[];
    contextProfile: CommandContextProfile;
    memory: CommandMemory[];
    settings: CommandLlmSettings | null;
    themePreference: CommandAppSettings['themePreference'];
    languagePreference: CommandAppSettings['languagePreference'];
    interfacePreferencesSaved: boolean;
    nextNodeSequence: number;
    nextEdgeSequence: number;
    nextSessionSequence: number;
    nextCheckInSequence: number;
    checkIns: CommandCheckIn[];
  } = {
    workspace: initialWorkspace,
    nodes: initialNodes(),
    edges: [],
    activePreviews: [],
    contextProfile: {
      id: 'context-profile-1',
      workspaceId: initialWorkspace.id,
      adultContexts: [],
      executionDifficulties: [],
      preferredSupportCategories: [],
      llmProviderSetupState: 'not_configured',
    },
    memory: [],
    settings: null,
    themePreference: 'system',
    languagePreference: 'system',
    interfacePreferencesSaved: false,
    nextNodeSequence: 1,
    nextEdgeSequence: 1,
    nextSessionSequence: 1,
    nextCheckInSequence: 1,
    checkIns: [],
  };

  return {
    async workspaceOpenDefault() {
      return state.workspace;
    },
    async mapGet(workspaceId) {
      return {
        workspace: { ...state.workspace, id: workspaceId },
        nodes: state.nodes.map((node) => ({ ...node, workspaceId })),
        edges: state.edges.map((edge) => ({ ...edge, workspaceId })),
      };
    },
    async nodeCreate(workspaceId, kind, title) {
      const node = {
        id: `node-${state.nextNodeSequence++}`,
        workspaceId,
        kind,
        title,
        body: null,
        metadata: null,
      };
      state.nodes.push(node);
      return { ...node };
    },
    async nodeUpdate(nodeId, kind, title, body) {
      const node = state.nodes.find((item) => item.id === nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      node.kind = kind;
      node.title = title;
      node.body = body;
      return { ...node };
    },
    async nodeMove(nodeId, x, y) {
      const node = state.nodes.find((item) => item.id === nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      node.position = { x, y };
      return { ...node };
    },
    async edgeCreate(workspaceId, sourceId, targetId, kind) {
      const edge = {
        id: `edge-${state.nextEdgeSequence++}`,
        workspaceId,
        sourceId,
        targetId,
        kind,
      };
      state.edges.push(edge);
      return { ...edge };
    },
    async edgeDelete(edgeId) {
      state.edges = state.edges.filter((edge) => edge.id !== edgeId);
    },
    async supportTemplatesList() {
      return supportTemplates().map((template) => ({ ...template, steps: [...template.steps] }));
    },
    async supportAdopt(workspaceId, templateId) {
      const template = supportTemplates().find((item) => item.id === templateId);
      if (!template) {
        throw new Error(`Support template not found: ${templateId}`);
      }
      const node = {
        id: `support-${state.nextNodeSequence++}`,
        workspaceId,
        kind: 'support' as const,
        title: template.title,
        body: `Template: ${template.id}\n\nSteps:\n${template.steps.map((step) => `- ${step}`).join('\n')}\n\nSafety: ${
          template.safetyNote
        }`,
        metadata: null,
      };
      state.nodes.push(node);
      return { ...node };
    },
    async supportDiscard(supportNodeId) {
      const node = state.nodes.find((item) => item.id === supportNodeId);
      if (!node) {
        throw new Error(`Node not found: ${supportNodeId}`);
      }
      if (node.kind !== 'support') {
        throw new Error(`Node is not a support: ${supportNodeId}`);
      }
      state.nodes = state.nodes.filter((item) => item.id !== supportNodeId);
      state.edges = state.edges.filter((edge) => edge.sourceId !== supportNodeId && edge.targetId !== supportNodeId);
    },
    async strategyCardsList() {
      return strategyCards().map((card) => ({ ...card, steps: [...card.steps] }));
    },
    async strategyExperimentCreate(experiment) {
      return { ...experiment };
    },
    async attentionSessionStart(nextActionId, intendedDurationMinutes, startedAt) {
      const node = state.nodes.find((item) => item.id === nextActionId);
      if (!node) {
        throw new Error(`Node not found: ${nextActionId}`);
      }
      if (node.kind !== 'next_action') {
        throw new Error(`Node is not a next action: ${nextActionId}`);
      }
      return {
        id: `attention-session-${state.nextSessionSequence++}`,
        startPlanId: null,
        nextActionId,
        startedAt,
        endedAt: null,
        intendedDurationMinutes,
        state: 'active',
        completionNote: null,
      };
    },
    async contextProfileGet(workspaceId) {
      return { ...state.contextProfile, workspaceId };
    },
    async contextProfileUpdate(profile) {
      state.contextProfile = {
        ...profile,
        adultContexts: [...profile.adultContexts],
        executionDifficulties: [...profile.executionDifficulties],
        preferredSupportCategories: [...profile.preferredSupportCategories],
      };
      return { ...state.contextProfile };
    },
    async agentTurnSubmit(_workspaceId, selectedNodeId, _message) {
      if (state.contextProfile.llmProviderSetupState !== 'configured') {
        throw new Error('Configure an LLM provider first.');
      }
      const preview: CommandPreview = {
        id: 'preview-1',
        proposedNodes: [
          {
            id: 'draft-next-2',
            kind: 'next_action',
            title: 'Find one example to paste below the outline',
            body: null,
          },
        ],
        proposedEdges: selectedNodeId
          ? [{ id: 'draft-edge-1', sourceId: selectedNodeId, targetId: 'draft-next-2', kind: 'breaks_down_to' }]
          : [],
        proposedMemory: [],
        proposedCheckIns: [],
        proposedStrategyExperiments: [],
        userVisibleSummary: 'Draft map changes for review.',
      };
      state.activePreviews = [preview];
      return {
        kind: 'PreviewProposed',
        message: 'Preview drafted. Review it, revise it, or accept it before anything is saved.',
        preview,
      };
    },
    async agentPreviewGet(previewId) {
      return state.activePreviews.find((preview) => preview.id === previewId) ?? null;
    },
    async agentPreviewAccept(workspaceId, previewId) {
      const preview = state.activePreviews.find((item) => item.id === previewId);
      if (!preview) {
        throw new Error(`Preview not found: ${previewId}`);
      }
      state.nodes.push(
        ...preview.proposedNodes.map((node) => ({
          id: node.id,
          workspaceId,
          kind: node.kind,
          title: node.title,
          body: node.body,
          metadata: null,
        })),
      );
      state.edges.push(...preview.proposedEdges.map((edge) => ({ ...edge, workspaceId })));
      state.memory.push(...(preview.proposedMemory ?? []));
      state.checkIns.push(...(preview.proposedCheckIns ?? []));
      state.activePreviews = state.activePreviews.filter((item) => item.id !== previewId);
    },
    async agentPreviewReject(previewId) {
      state.activePreviews = state.activePreviews.filter((item) => item.id !== previewId);
    },
    async agentPreviewRevise(_workspaceId, previewId, _message) {
      const preview = state.activePreviews.find((item) => item.id === previewId);
      if (!preview) {
        throw new Error(`Preview not found: ${previewId}`);
      }
      const revisedPreview: CommandPreview = {
        id: 'preview-2',
        proposedNodes: [
          {
            id: 'draft-next-revised',
            kind: 'next_action',
            title: 'Write one rough bullet',
            body: null,
          },
        ],
        proposedEdges: [],
        proposedMemory: [],
        proposedCheckIns: [],
        proposedStrategyExperiments: [],
        userVisibleSummary: 'Smaller draft map changes for review.',
      };
      state.activePreviews = [revisedPreview];
      return {
        kind: 'PreviewProposed',
        message: 'Preview revised. Review it, revise it, or accept it before anything is saved.',
        preview: revisedPreview,
      };
    },
    async startPlanGet(_workspaceId, nextActionId) {
      const selectedNextAction =
        state.nodes.find((node) => node.id === nextActionId) ??
        state.nodes.find((node) => node.kind === 'next_action') ??
        state.nodes[0];
      return {
        selectedNextAction,
        parentTask: state.nodes.find((node) => node.kind === 'task') ?? null,
        supportItems: state.nodes.filter((node) => node.kind === 'support').slice(0, 3),
        environmentalAdjustment: state.nodes.find((node) => node.kind === 'environment_adjustment') ?? null,
        currentBlocker: state.nodes.find((node) => node.kind === 'blocker') ?? null,
        minimumDone: selectedNextAction.metadata?.minimumDone ?? null,
        estimateMinutes: selectedNextAction.metadata?.estimatedMinutes ?? null,
        returnCue: `Return to: ${selectedNextAction.title}`,
        startCheck: {
          neededMaterials: [],
          currentDistraction: null,
          fiveMinuteFit: true,
          reopenTarget: `Return to: ${selectedNextAction.title}`,
        },
      };
    },
    async attentionSessionClose(sessionId, endedAt, completionNote) {
      return {
        id: sessionId,
        startPlanId: null,
        nextActionId: 'next-1',
        startedAt: '2026-05-17T00:00:00Z',
        endedAt,
        intendedDurationMinutes: 5,
        state: 'closed',
        completionNote,
      };
    },
    async agentMemoryList(_workspaceId) {
      return state.memory.map((memory) => ({ ...memory }));
    },
    async agentMemoryUpdate(_workspaceId, memory) {
      const existingIndex = state.memory.findIndex((item) => item.id === memory.id);
      if (existingIndex >= 0) {
        state.memory[existingIndex] = { ...memory };
      } else {
        state.memory.push({ ...memory });
      }
      return { ...memory };
    },
    async agentMemoryDelete(_workspaceId, memoryId) {
      state.memory = state.memory.filter((memory) => memory.id !== memoryId);
    },
    async vaultExport(workspaceId, profile = 'obsidian_readable') {
      const exported = {
        files: state.nodes.map((node) => ({
          filename: `${node.title}.md`,
          content: `---\nmindlattice_id: ${node.id}\nkind: ${node.kind}\n---\n\n# ${node.title}\n${node.body ?? ''}`.trimEnd(),
        })),
      };
      return applyVaultExportProfile(exported, profile);
    },
    async vaultExportToFolder(workspaceId, profile = 'obsidian_readable') {
      const exported = await this.vaultExport(workspaceId, profile);
      return { directory: 'mock-vault', filesWritten: exported.files.length };
    },
    async vaultPickImportFolder() {
      return [];
    },
    async vaultImport(workspaceId, files) {
      const importedNodes = files.map((file, index) => {
        const title = titleFromMarkdown(file.content) ?? file.filename.replace(/\.md$/i, '');
        return {
          id: `vault-node-${index + 1}`,
          workspaceId,
          kind: 'note' as const,
          title,
          body: bodyFromMarkdown(file.content),
          metadata: null,
        };
      });
      state.nodes.push(...importedNodes);
      return {
        nodesCreated: importedNodes.length,
        edgesCreated: 0,
        nodes: importedNodes,
        edges: [],
      };
    },
    async checkInCreate(workspaceId, nodeId, body) {
      const checkIn = {
        id: `check-in-${state.nextCheckInSequence++}`,
        workspaceId,
        nodeId,
        body,
      };
      state.checkIns.push(checkIn);
      return { ...checkIn };
    },
    async checkInList(workspaceId) {
      return state.checkIns
        .filter((checkIn) => checkIn.workspaceId === workspaceId)
        .map((checkIn) => ({ ...checkIn }));
    },
    async settingsGetApp() {
      return {
        llmSettings: state.settings ? { ...state.settings } : null,
        themePreference: state.themePreference,
        languagePreference: state.languagePreference,
        interfacePreferencesSaved: state.interfacePreferencesSaved,
      };
    },
    async settingsTestLlm(providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds) {
      if (!providerId.trim() || !apiMode.trim() || !baseUrl.trim() || !apiKey.trim() || !model.trim() || timeoutSeconds <= 0) {
        throw new Error('Complete provider settings before testing.');
      }
      return {
        status: 'ok',
        model: model.trim(),
        message: 'Connection test succeeded.',
      };
    },
    async settingsUpdateLlm(providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds) {
      if (!providerId.trim() || !apiMode.trim() || !baseUrl.trim() || !apiKey.trim() || !model.trim() || timeoutSeconds <= 0) {
        throw new Error('Complete provider settings before saving.');
      }
      state.settings = { providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds };
      state.contextProfile = {
        ...state.contextProfile,
        llmProviderSetupState: 'configured',
      };
      return { ...state.settings };
    },
    async settingsUpdateInterface(themePreference, languagePreference) {
      if (!isThemePreference(themePreference) || !isLanguagePreference(languagePreference)) {
        throw new Error('Invalid interface preferences.');
      }
      state.themePreference = themePreference;
      state.languagePreference = languagePreference;
      state.interfacePreferencesSaved = true;
      return this.settingsGetApp();
    },
  };
}

export function mapSnapshotToWorkbenchNodes(snapshot: CommandMapSnapshot): WorkbenchNode[] {
  return snapshot.nodes.map((node, index) => {
    const position = node.position ?? positionForNode(node.kind, index);
    return {
      id: node.id,
      kind: node.kind,
      title: node.title,
      body: node.body,
      status: node.kind === 'next_action' ? 'Next' : 'Active',
      x: position.x,
      y: position.y,
      minimumDone: node.metadata?.minimumDone,
      estimateMinutes: node.metadata?.estimatedMinutes,
    };
  });
}

export function mapSnapshotToWorkbenchEdges(snapshot: CommandMapSnapshot): WorkbenchEdge[] {
  return snapshot.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    kind: edge.kind,
  }));
}

export function commandPreviewToWorkbenchPreview(preview: CommandPreview): AgentPreviewModel {
  return {
    id: preview.id,
    proposedNodes: preview.proposedNodes.map((node, index) => {
      const position = positionForNode(node.kind, index + 10);
      return {
        id: node.id,
        kind: node.kind,
        title: node.title,
        body: node.body,
        status: 'Draft',
        x: position.x,
        y: position.y,
      };
    }),
    proposedEdges: preview.proposedEdges,
    proposedMemory: preview.proposedMemory ?? [],
    proposedCheckIns: preview.proposedCheckIns ?? [],
    proposedStrategyExperiments: preview.proposedStrategyExperiments ?? [],
  };
}

function initialNodes(): CommandNode[] {
  return [
    {
      id: 'task-1',
      workspaceId: initialWorkspace.id,
      kind: 'task',
      title: 'Plan launch notes',
      body: null,
      metadata: { minimumDone: 'A rough outline exists.', estimatedMinutes: 20 },
    },
    {
      id: 'next-1',
      workspaceId: initialWorkspace.id,
      kind: 'next_action',
      title: 'Open the draft and write three bullets',
      body: null,
      metadata: { minimumDone: 'Three rough bullets exist.', estimatedMinutes: 5 },
    },
  ];
}

function supportTemplates(): CommandSupportTemplate[] {
  return [
    {
      id: 'quieter-workspace',
      category: 'sensory_environment',
      title: 'Quieter workspace',
      steps: ['Move one distracting object out of view.', 'Choose headphones, white noise, or a quieter corner.'],
      defaultContexts: ['work', 'study'],
      sourceNote: 'General low-risk environment adjustment pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
    {
      id: 'visible-checklist',
      category: 'task_structure',
      title: 'Visible short checklist',
      steps: ['Write no more than three visible steps.', 'Mark the minimum done line before starting.'],
      defaultContexts: ['work', 'personal project'],
      sourceNote: 'General task-structure support pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
  ];
}

function strategyCards(): CommandStrategyCard[] {
  return [
    {
      id: 'make-it-visible',
      title: 'Make it visible',
      whenToUse: 'Use when the next step keeps disappearing from working memory.',
      steps: ['Write the current task in one plain sentence.', 'Put the sentence where it stays visible.'],
      sourceNote: 'General external-memory strategy pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
    {
      id: 'shrink-the-start',
      title: 'Shrink the start',
      whenToUse: 'Use when the task feels too large to begin.',
      steps: ['Name the smallest visible action.', 'Set a five-minute fit check before committing to more.'],
      sourceNote: 'General task-start support pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
  ];
}

function positionForNode(kind: CommandNodeKind, index: number): { x: number; y: number } {
  const positions: Partial<Record<CommandNodeKind, { x: number; y: number }>> = {
    task: { x: 43, y: 42 },
    next_action: { x: 67, y: 63 },
    blocker: { x: 20, y: 31 },
    resource: { x: 18, y: 62 },
    support: { x: 64, y: 24 },
  };
  return positions[kind] ?? { x: 30 + index * 8, y: 50 };
}

function isThemePreference(value: string): value is CommandAppSettings['themePreference'] {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isLanguagePreference(value: string): value is CommandAppSettings['languagePreference'] {
  return value === 'system' || value === 'en' || value === 'zh-CN';
}

function titleFromMarkdown(content: string): string | null {
  return content
    .split(/\r?\n/)
    .find((line) => line.startsWith('# '))
    ?.slice(2)
    .trim() ?? null;
}

function bodyFromMarkdown(content: string): string | null {
  const body = content
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('---') && !line.includes(': ') && !line.startsWith('# '))
    .join('\n')
    .trim();
  return body.length > 0 ? body : null;
}

async function pickSingleDirectory(
  nativeVaultTransport: NativeVaultFileTransport,
  options: Record<string, unknown>,
): Promise<string | null> {
  const selected = await nativeVaultTransport.openDialog(options);
  if (Array.isArray(selected)) {
    return selected[0] ?? null;
  }
  return selected;
}

function tauriNativeVaultTransport(): NativeVaultFileTransport {
  return {
    openDialog: async (options) => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      return open(options);
    },
    readDir: async (directory) => {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      return readDir(directory);
    },
    readTextFile: async (path) => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      return readTextFile(path);
    },
    writeTextFile: async (path, content) => {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, content);
    },
    joinPath: async (...parts) => {
      const { join } = await import('@tauri-apps/api/path');
      return join(...parts);
    },
  };
}

function browserRuntime(): CommandClientRuntime {
  const windowWithTauri = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: unknown;
  };
  if (!windowWithTauri.__TAURI_INTERNALS__) {
    return { isTauri: false };
  }
  return {
    isTauri: true,
    invoke: async (command, args) => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke(command, args);
    },
  };
}

function applyVaultExportProfile(
  exported: CommandVaultExport,
  profile: VaultExportProfile,
): CommandVaultExport {
  if (profile === 'obsidian_readable') {
    return exported;
  }

  return {
    files: exported.files.map((file) => ({
      ...file,
      content: stripYamlFrontmatter(file.content).trimStart(),
    })),
  };
}

function stripYamlFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return content;
  }
  const endIndex = normalized.indexOf('\n---', 4);
  if (endIndex < 0) {
    return content;
  }
  const afterFence = normalized.slice(endIndex + '\n---'.length);
  return afterFence.startsWith('\n') ? afterFence.slice(1) : afterFence;
}
