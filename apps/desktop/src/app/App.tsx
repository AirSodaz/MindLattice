import type { Node, OnNodeDrag } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import {
  acceptActivePreview,
  addConnectedNode,
  connectExistingNodes,
  adoptSupportTemplate,
  createCheckIn,
  createCustomSupportNode,
  deletePreferenceMemory,
  acceptPreferenceMemoryProposal,
  acceptStrategyExperimentProposal,
  acceptVaultImportPreview,
  draftStrategyExperiment,
  initializeWorkbench,
  moveNode,
  previewVaultImport,
  rejectVaultImportPreview,
  rejectStrategyExperimentProposal,
  rejectPreferenceMemoryProposal,
  rejectActivePreview,
  saveCustomSupportTemplate,
  saveLlmSettings,
  testLlmSettings,
  saveOnboardingProfile,
  reviseActivePreview,
  saveSelectedNodeDetails,
  closeAttentionSession,
  startAttentionSession,
  discardSupportNode,
  updateSupportNode,
  updatePreferenceMemory,
  submitAgentMessage,
  type WorkbenchScreenState,
} from '../features/workbench/workbenchController';
import { AdvancedMapPanel } from '../features/workbench/components/AdvancedMapPanel';
import { AgentPanel } from '../features/workbench/components/AgentPanel';
import { EmptyContextPanel } from '../features/workbench/components/EmptyContextPanel';
import { PreviewReviewPanel } from '../features/workbench/components/PreviewReviewPanel';
import { ProviderSetupPanel } from '../features/workbench/components/ProviderSetupPanel';
import { StartPanel } from '../features/workbench/components/StartPanel';
import { TurnCanvasPanel } from '../features/workbench/components/TurnCanvasPanel';
import { TurnContextPane } from '../features/workbench/components/TurnContextPane';
import { WorkbenchTaskPanels } from '../features/workbench/components/WorkbenchTaskPanels';
import type { WorkbenchFlowNodeData } from '../features/workbench/components/WorkbenchFlow';
import {
  buildInitialWorkbench,
  buildStartModeView,
  buildStartTimerState,
  enterStartMode,
  followUpPromptOptions,
  getSelectedNode,
  leaveStartMode,
  percentFromReactFlowPosition,
  presentCommandError,
  reactFlowElementsFromWorkbench,
  resolveTheme,
  resolveWorkbenchShortcut,
  selectRightPaneMode,
  type ThemePreference,
  type WorkbenchTaskPanel,
  type WorkbenchNodeKind,
} from '../features/workbench/workbenchModel';
import { buildSettingsSections } from '../features/settings/settingsModel';
import { createCommandClient } from '../shared/api/commandClient';
import type {
  CommandExperimentContext,
  CommandStrategyDecision,
  CommandSupportCategory,
} from '../shared/api/commandClient';

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const surroundingNodeOptions: Array<{ value: WorkbenchNodeKind; label: string }> = [
  { value: 'next_action', label: 'Next action' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'resource', label: 'Resource' },
  { value: 'note', label: 'Note' },
  { value: 'support', label: 'Support' },
];

const edgeKindOptions = [
  { value: 'breaks_down_to', label: 'Breaks down to' },
  { value: 'blocked_by', label: 'Blocked by' },
  { value: 'supports', label: 'Supports' },
  { value: 'related', label: 'Related' },
  { value: 'anchors', label: 'Anchors' },
  { value: 'protects', label: 'Protects' },
];

const adultContextOptions = ['work', 'study', 'home responsibility', 'personal project'];
const executionDifficultyOptions = ['task initiation', 'prioritizing', 'return after interruption', 'keeping context visible'];
const supportCategoryOptions: Array<{ value: CommandSupportCategory; label: string }> = [
  { value: 'sensory_environment', label: 'Sensory environment' },
  { value: 'task_structure', label: 'Task structure' },
  { value: 'external_memory', label: 'External memory' },
  { value: 'written_communication', label: 'Written communication' },
  { value: 'rest_and_switching', label: 'Rest and switching' },
  { value: 'work_study_adjustment', label: 'Work/study adjustment' },
];

const flowCanvasSize = { width: 1000, height: 700 };

export function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [requestedPane, setRequestedPane] = useState<'setup' | 'advanced_map' | 'start' | null>(null);
  const [activeTaskPanel, setActiveTaskPanel] = useState<WorkbenchTaskPanel>(null);
  const [screenState, setScreenState] = useState<WorkbenchScreenState>(() => ({
    workspaceId: '',
    contextProfile: {
      id: 'context-profile-loading',
      workspaceId: '',
      adultContexts: [],
      executionDifficulties: [],
      preferredSupportCategories: [],
      llmProviderSetupState: 'not_configured',
    },
    supportTemplates: [],
    checkIns: [],
    preferenceMemory: [],
    pendingMemoryProposals: [],
    strategyExperiments: [],
    pendingStrategyExperiments: [],
    pendingVaultImport: null,
    providerTestResult: null,
    providerTestedSettings: null,
    attentionSession: null,
    lastError: null,
    workbench: {
      ...buildInitialWorkbench(),
      activePreview: null,
      messages: [
        {
          id: 'agent-1',
          sender: 'agent',
          body: 'Opening your local workspace.',
        },
      ],
    },
  }));
  const [composerValue, setComposerValue] = useState('Break this down into one visible start.');
  const [llmBaseUrl, setLlmBaseUrl] = useState('http://localhost:11434/v1');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [llmTimeoutSeconds, setLlmTimeoutSeconds] = useState(30);
  const [isLlmSaving, setIsLlmSaving] = useState(false);
  const [isLlmTesting, setIsLlmTesting] = useState(false);
  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [isNodeSaving, setIsNodeSaving] = useState(false);
  const [isEdgeSaving, setIsEdgeSaving] = useState(false);
  const [isSessionBusy, setIsSessionBusy] = useState(false);
  const [isSupportAdopting, setIsSupportAdopting] = useState(false);
  const [isSupportSaving, setIsSupportSaving] = useState(false);
  const [isCustomSupportCreating, setIsCustomSupportCreating] = useState(false);
  const [isCustomSupportTemplateSaving, setIsCustomSupportTemplateSaving] = useState(false);
  const [isCheckInSaving, setIsCheckInSaving] = useState(false);
  const [isMemorySaving, setIsMemorySaving] = useState(false);
  const [isExperimentSaving, setIsExperimentSaving] = useState(false);
  const [sessionCompletionNote, setSessionCompletionNote] = useState('');
  const [timerNowIso, setTimerNowIso] = useState(() => new Date().toISOString());
  const [checkInDraft, setCheckInDraft] = useState('');
  const [vaultImportFilename, setVaultImportFilename] = useState('Imported.md');
  const [vaultImportContent, setVaultImportContent] = useState('');
  const [vaultExportSummary, setVaultExportSummary] = useState('');
  const [isVaultBusy, setIsVaultBusy] = useState(false);
  const [experimentSupportId, setExperimentSupportId] = useState('');
  const [experimentContext, setExperimentContext] = useState<CommandExperimentContext>('work');
  const [experimentDecision, setExperimentDecision] = useState<CommandStrategyDecision>('keep');
  const [experimentObstacle, setExperimentObstacle] = useState('');
  const [experimentHelped, setExperimentHelped] = useState({
    start: true,
    continue: false,
    return: false,
    clarify: false,
  });
  const commandClient = useMemo(() => createCommandClient(), []);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const { supportTemplates, workbench } = screenState;
  const isLlmConfigured = screenState.contextProfile.llmProviderSetupState === 'configured';
  const settingsSections = useMemo(
    () => buildSettingsSections(screenState.contextProfile),
    [screenState.contextProfile],
  );
  const resolvedTheme = resolveTheme(themePreference, false);
  const selectedNode = useMemo(() => getSelectedNode(workbench), [workbench]);
  const [nodeTitleDraft, setNodeTitleDraft] = useState(selectedNode?.title ?? '');
  const [nodeBodyDraft, setNodeBodyDraft] = useState('');
  const [newNodeKind, setNewNodeKind] = useState<WorkbenchNodeKind>('next_action');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [edgeSourceId, setEdgeSourceId] = useState('');
  const [edgeTargetId, setEdgeTargetId] = useState('');
  const [edgeKind, setEdgeKind] = useState('breaks_down_to');
  const [memoryDrafts, setMemoryDrafts] = useState<Record<string, string>>({});
  const [pendingMemoryDrafts, setPendingMemoryDrafts] = useState<Record<string, string>>({});
  const [supportDrafts, setSupportDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [onboardingContexts, setOnboardingContexts] = useState<string[]>([]);
  const [onboardingDifficulties, setOnboardingDifficulties] = useState<string[]>([]);
  const [onboardingSupportCategories, setOnboardingSupportCategories] = useState<CommandSupportCategory[]>([]);
  const [customSupportTitle, setCustomSupportTitle] = useState('');
  const [customSupportBody, setCustomSupportBody] = useState('');
  const adoptedSupports = useMemo(
    () => workbench.nodes.filter((node) => node.kind === 'support'),
    [workbench.nodes],
  );
  const startModeView = useMemo(() => buildStartModeView(workbench), [workbench]);
  const hasStartableAction = workbench.nodes.some((node) => node.kind === 'next_action');
  const isStartModeFocused = workbench.viewMode === 'start';
  const startTimerState = useMemo(
    () => buildStartTimerState(screenState.attentionSession, timerNowIso),
    [screenState.attentionSession, timerNowIso],
  );
  const followUpPrompts = useMemo(() => followUpPromptOptions(), []);
  const flowElements = useMemo(
    () => reactFlowElementsFromWorkbench(workbench, flowCanvasSize),
    [workbench],
  );
  const rightPaneMode = selectRightPaneMode({
    providerSetupRequired: !isLlmConfigured,
    setupRequested: requestedPane === 'setup' || !isLlmConfigured,
    safetyRedirectActive: false,
    activePreview: workbench.activePreview,
    viewMode: workbench.viewMode,
    hasGraphContext: workbench.nodes.length > 0,
    advancedMapRequested: requestedPane === 'advanced_map',
    startRequested: requestedPane === 'start',
    taskPanel: activeTaskPanel,
  });

  const handleSaveSelectedNode = useCallback(async () => {
    if (isNodeSaving || !selectedNode) {
      return;
    }
    setIsNodeSaving(true);
    try {
      setScreenState({ ...(await saveSelectedNodeDetails(commandClient, screenState, nodeTitleDraft, nodeBodyDraft)), lastError: null });
    } catch (error) {
      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
    } finally {
      setIsNodeSaving(false);
    }
  }, [commandClient, isNodeSaving, nodeBodyDraft, nodeTitleDraft, screenState, selectedNode]);

  const handleStartAttentionSession = useCallback(async () => {
    if (isSessionBusy || screenState.attentionSession || !workbench.nodes.some((node) => node.kind === 'next_action')) {
      return;
    }
    setIsSessionBusy(true);
    try {
      setScreenState({ ...(await startAttentionSession(commandClient, screenState, new Date().toISOString())), lastError: null });
    } catch (error) {
      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
    } finally {
      setIsSessionBusy(false);
    }
  }, [commandClient, isSessionBusy, screenState, workbench.nodes]);

  const handleVaultExportToFolder = useCallback(async () => {
    if (isVaultBusy || !screenState.workspaceId) {
      return;
    }
    setIsVaultBusy(true);
    try {
      const result = await commandClient.vaultExportToFolder(screenState.workspaceId);
      setVaultExportSummary(
        result
          ? `${result.filesWritten} Markdown file${result.filesWritten === 1 ? '' : 's'} exported to ${result.directory}.`
          : 'Export cancelled.',
      );
      setScreenState((current) => ({ ...current, lastError: null }));
    } catch (error) {
      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
    } finally {
      setIsVaultBusy(false);
    }
  }, [commandClient, isVaultBusy, screenState.workspaceId]);

  const handleVaultPickImportFolder = useCallback(async () => {
    if (isVaultBusy || !screenState.workspaceId) {
      return;
    }
    setIsVaultBusy(true);
    try {
      const files = await commandClient.vaultPickImportFolder();
      setScreenState((current) => ({ ...previewVaultImport(current, files), lastError: null }));
    } catch (error) {
      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
    } finally {
      setIsVaultBusy(false);
    }
  }, [commandClient, isVaultBusy, screenState.workspaceId]);

  const handleNodeDragStop: OnNodeDrag<Node<WorkbenchFlowNodeData, 'workbenchNode'>> = useCallback(
    async (_event, node) => {
      if (node.id.startsWith('draft-')) {
        return;
      }
      const position = percentFromReactFlowPosition(node.position, flowCanvasSize);
      setScreenState(await moveNode(commandClient, screenState, node.id, position.x, position.y));
    },
    [commandClient, screenState],
  );

  useEffect(() => {
    let isCurrent = true;

    initializeWorkbench(commandClient)
      .then((nextState) => {
        if (isCurrent) {
          setScreenState(nextState);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          const presentedError = presentCommandError(error);
          setScreenState((current) => ({
            ...current,
            lastError: presentedError,
            workbench: {
              ...current.workbench,
              messages: [
                ...current.workbench.messages,
                {
                  id: `agent-${current.workbench.messages.length + 1}`,
                  sender: 'agent',
                  body: presentedError.message,
                },
              ],
            },
          }));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [commandClient]);

  useEffect(() => {
    setNodeTitleDraft(selectedNode?.title ?? '');
    setNodeBodyDraft(selectedNode?.body ?? '');
  }, [selectedNode?.body, selectedNode?.id, selectedNode?.title]);

  useEffect(() => {
    setMemoryDrafts(
      Object.fromEntries(
        screenState.preferenceMemory.map((memory) => [memory.id, memory.proposedMemoryText]),
      ),
    );
  }, [screenState.preferenceMemory]);

  useEffect(() => {
    setPendingMemoryDrafts(
      Object.fromEntries(
        screenState.pendingMemoryProposals.map((memory) => [memory.id, memory.proposedMemoryText]),
      ),
    );
  }, [screenState.pendingMemoryProposals]);

  useEffect(() => {
    setExperimentSupportId((current) => current || screenState.supportTemplates[0]?.id || '');
  }, [screenState.supportTemplates]);

  useEffect(() => {
    setOnboardingContexts(screenState.contextProfile.adultContexts);
    setOnboardingDifficulties(screenState.contextProfile.executionDifficulties);
    setOnboardingSupportCategories(screenState.contextProfile.preferredSupportCategories);
  }, [screenState.contextProfile]);

  useEffect(() => {
    setSupportDrafts((current) =>
      Object.fromEntries(
        adoptedSupports.map((support) => {
          const existing = current[support.id];
          return [
            support.id,
            {
              title: existing?.title ?? support.title,
              body: existing?.body ?? support.body ?? '',
            },
          ];
        }),
      ),
    );
  }, [adoptedSupports]);

  useEffect(() => {
    setEdgeSourceId((current) => current || workbench.selectedNodeId || workbench.nodes[0]?.id || '');
    setEdgeTargetId((current) => current || workbench.nodes.find((node) => node.id !== workbench.selectedNodeId)?.id || '');
  }, [workbench.nodes, workbench.selectedNodeId]);

  useEffect(() => {
    if (!screenState.attentionSession) {
      return;
    }

    setTimerNowIso(new Date().toISOString());
    const intervalId = window.setInterval(() => setTimerNowIso(new Date().toISOString()), 60_000);
    return () => window.clearInterval(intervalId);
  }, [screenState.attentionSession]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = resolveWorkbenchShortcut(event);
      if (!shortcut) {
        return;
      }
      event.preventDefault();

      if (shortcut === 'focus-capture') {
        composerInputRef.current?.focus();
        composerInputRef.current?.select();
        return;
      }
      if (shortcut === 'save-selected-node') {
        void handleSaveSelectedNode();
        return;
      }
      setRequestedPane(null);
      setActiveTaskPanel(null);
      setScreenState((current) => ({
        ...current,
        workbench: enterStartMode(current.workbench),
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSaveSelectedNode]);

  const clearProviderTestResult = useCallback(() => {
    setScreenState((current) =>
      current.providerTestResult || current.providerTestedSettings
        ? { ...current, providerTestResult: null, providerTestedSettings: null }
        : current,
    );
  }, []);
  const handleLlmBaseUrlChange = useCallback(
    (value: string) => {
      setLlmBaseUrl(value);
      clearProviderTestResult();
    },
    [clearProviderTestResult],
  );
  const handleLlmApiKeyChange = useCallback(
    (value: string) => {
      setLlmApiKey(value);
      clearProviderTestResult();
    },
    [clearProviderTestResult],
  );
  const handleLlmModelChange = useCallback(
    (value: string) => {
      setLlmModel(value);
      clearProviderTestResult();
    },
    [clearProviderTestResult],
  );
  const handleLlmTimeoutSecondsChange = useCallback(
    (value: number) => {
      setLlmTimeoutSeconds(value);
      clearProviderTestResult();
    },
    [clearProviderTestResult],
  );

  return (
    <main className={`app-shell ${isStartModeFocused ? 'is-start-mode' : ''}`} data-theme={resolvedTheme}>
      <AgentPanel
        composerInputRef={composerInputRef}
        composerValue={composerValue}
        isAgentBusy={isAgentBusy}
        isLlmConfigured={isLlmConfigured}
        onComposerChange={setComposerValue}
        onConfigureLlm={() => {
          setRequestedPane('setup');
          setActiveTaskPanel(null);
        }}
        onSubmit={async () => {
          if (isAgentBusy) {
            return;
          }
          setIsAgentBusy(true);
          try {
            const nextState = workbench.activePreview
              ? await reviseActivePreview(commandClient, screenState, composerValue)
              : await submitAgentMessage(commandClient, screenState, composerValue);
            setScreenState({ ...nextState, lastError: null });
            setComposerValue('');
            setRequestedPane(null);
            setActiveTaskPanel(null);
          } catch (error) {
            setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
          } finally {
            setIsAgentBusy(false);
          }
        }}
        workbench={workbench}
        workspaceReady={Boolean(screenState.workspaceId)}
      />

      {screenState.lastError ? (
        <div className="error-notice" role="alert">
          <strong>{screenState.lastError.message}</strong>
          <span>{screenState.lastError.detail}</span>
        </div>
      ) : null}

      {!isStartModeFocused ? (
        <TurnContextPane
          advancedMap={
            <AdvancedMapPanel
              edgeKind={edgeKind}
              edgeKindOptions={edgeKindOptions}
              edgeSourceId={edgeSourceId}
              edgeTargetId={edgeTargetId}
              edges={workbench.edges}
              isEdgeSaving={isEdgeSaving}
              isNodeSaving={isNodeSaving}
              newNodeKind={newNodeKind}
              newNodeTitle={newNodeTitle}
              nodeBodyDraft={nodeBodyDraft}
              nodeTitleDraft={nodeTitleDraft}
              nodes={workbench.nodes}
              onAddConnectedNode={async () => {
                setIsNodeSaving(true);
                try {
                  setScreenState(await addConnectedNode(commandClient, screenState, newNodeKind, newNodeTitle));
                  setNewNodeTitle('');
                } finally {
                  setIsNodeSaving(false);
                }
              }}
              onConnectNodes={async () => {
                setIsEdgeSaving(true);
                try {
                  setScreenState(await connectExistingNodes(commandClient, screenState, edgeSourceId, edgeTargetId, edgeKind));
                } finally {
                  setIsEdgeSaving(false);
                }
              }}
              onEdgeKindChange={setEdgeKind}
              onEdgeSourceIdChange={setEdgeSourceId}
              onEdgeTargetIdChange={setEdgeTargetId}
              onNewNodeKindChange={setNewNodeKind}
              onNewNodeTitleChange={setNewNodeTitle}
              onNodeBodyDraftChange={setNodeBodyDraft}
              onNodeTitleDraftChange={setNodeTitleDraft}
              onSaveSelectedNode={handleSaveSelectedNode}
              selectedNode={selectedNode}
              surroundingNodeOptions={surroundingNodeOptions}
            />
          }
          canvas={
            <TurnCanvasPanel
              elements={flowElements}
              focusTaskTitle={workbench.focusTaskTitle}
              hasActivePreview={Boolean(workbench.activePreview)}
              onNodeClick={(nodeId) => {
                setScreenState((current) => ({
                  ...current,
                  workbench: { ...current.workbench, selectedNodeId: nodeId },
                }));
                setRequestedPane('advanced_map');
                setActiveTaskPanel(null);
              }}
              onNodeDragStop={handleNodeDragStop}
              onOpenAdvancedMap={() => {
                setRequestedPane('advanced_map');
                setActiveTaskPanel(null);
              }}
              onOpenPreview={() => {
                setRequestedPane(null);
                setActiveTaskPanel(null);
              }}
              onOpenStart={() => {
                setRequestedPane('start');
                setActiveTaskPanel(null);
              }}
              onOpenTaskPanel={(panel) => {
                setRequestedPane(null);
                setActiveTaskPanel(panel);
              }}
              resolvedTheme={resolvedTheme}
              selectedNode={selectedNode}
              startModeView={startModeView}
              workbench={workbench}
            />
          }
          empty={<EmptyContextPanel isLlmConfigured={isLlmConfigured} onConfigureLlm={() => setRequestedPane('setup')} />}
          mode={rightPaneMode}
          onBackToCanvas={() => {
            setRequestedPane(null);
            setActiveTaskPanel(null);
          }}
          preview={
            <PreviewReviewPanel
              activePreview={workbench.activePreview}
              onAccept={async () => {
                setScreenState(await acceptActivePreview(commandClient, screenState));
                setRequestedPane(null);
              }}
              onReject={async () => {
                setScreenState(await rejectActivePreview(commandClient, screenState));
                setRequestedPane(null);
              }}
            />
          }
          setup={
            <ProviderSetupPanel
              apiKey={llmApiKey}
              baseUrl={llmBaseUrl}
              isSaving={isLlmSaving}
              isTesting={isLlmTesting}
              model={llmModel}
              onApiKeyChange={handleLlmApiKeyChange}
              onBaseUrlChange={handleLlmBaseUrlChange}
              onModelChange={handleLlmModelChange}
              onSave={async () => {
                if (isLlmSaving || !llmBaseUrl.trim() || !llmApiKey.trim() || !llmModel.trim()) {
                  return;
                }
                setIsLlmSaving(true);
                try {
                  setScreenState(
                    await saveLlmSettings(
                      commandClient,
                      screenState,
                      llmBaseUrl,
                      llmApiKey,
                      llmModel,
                      llmTimeoutSeconds,
                    ),
                  );
                  setRequestedPane(null);
                } catch (error) {
                  setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                } finally {
                  setIsLlmSaving(false);
                }
              }}
              onTest={async () => {
                if (isLlmTesting || !llmBaseUrl.trim() || !llmApiKey.trim() || !llmModel.trim()) {
                  return;
                }
                setIsLlmTesting(true);
                try {
                  setScreenState(
                    await testLlmSettings(
                      commandClient,
                      screenState,
                      llmBaseUrl,
                      llmApiKey,
                      llmModel,
                      llmTimeoutSeconds,
                    ),
                  );
                } catch (error) {
                  setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                } finally {
                  setIsLlmTesting(false);
                }
              }}
              onTimeoutSecondsChange={handleLlmTimeoutSecondsChange}
              testResult={screenState.providerTestResult}
              timeoutSeconds={llmTimeoutSeconds}
            />
          }
          start={
            <StartPanel
              attentionSession={screenState.attentionSession}
              checkInDraft={checkInDraft}
              checkIns={screenState.checkIns}
              followUpPrompts={followUpPrompts}
              hasStartableAction={hasStartableAction}
              isCheckInSaving={isCheckInSaving}
              isSessionBusy={isSessionBusy}
              onCheckInDraftChange={setCheckInDraft}
              onCloseSession={async () => {
                setIsSessionBusy(true);
                try {
                  setScreenState(
                    await closeAttentionSession(
                      commandClient,
                      screenState,
                      new Date().toISOString(),
                      sessionCompletionNote,
                    ),
                  );
                  setSessionCompletionNote('');
                } finally {
                  setIsSessionBusy(false);
                }
              }}
              onEnterFocusMode={() => {
                setRequestedPane(null);
                setActiveTaskPanel(null);
                setScreenState((current) => ({
                  ...current,
                  workbench: enterStartMode(current.workbench),
                }));
              }}
              onSaveCheckIn={async () => {
                setIsCheckInSaving(true);
                try {
                  setScreenState(await createCheckIn(commandClient, screenState, checkInDraft));
                  setCheckInDraft('');
                } finally {
                  setIsCheckInSaving(false);
                }
              }}
              onSessionCompletionNoteChange={setSessionCompletionNote}
              onStartSession={handleStartAttentionSession}
              sessionCompletionNote={sessionCompletionNote}
              startModeView={startModeView}
              startTimerState={startTimerState}
              workspaceReady={Boolean(screenState.workspaceId)}
            />
          }
          taskPanel={activeTaskPanel}
          taskPanels={
            <WorkbenchTaskPanels
              activePanel={activeTaskPanel}
              adoptedSupports={adoptedSupports}
              customSupportBody={customSupportBody}
              customSupportTitle={customSupportTitle}
              experimentContext={experimentContext}
              experimentDecision={experimentDecision}
              experimentHelped={experimentHelped}
              experimentObstacle={experimentObstacle}
              experimentSupportId={experimentSupportId}
              isCustomSupportCreating={isCustomSupportCreating}
              isCustomSupportTemplateSaving={isCustomSupportTemplateSaving}
              isExperimentSaving={isExperimentSaving}
              isMemorySaving={isMemorySaving}
              isSupportAdopting={isSupportAdopting}
              isSupportSaving={isSupportSaving}
              isVaultBusy={isVaultBusy}
              memoryDrafts={memoryDrafts}
              onAcceptMemoryProposal={async (memoryId, text) => {
                setIsMemorySaving(true);
                try {
                  setScreenState(await acceptPreferenceMemoryProposal(commandClient, screenState, memoryId, text));
                } finally {
                  setIsMemorySaving(false);
                }
              }}
              onAcceptStrategyExperiment={async (experimentId) => {
                setIsExperimentSaving(true);
                try {
                  setScreenState(await acceptStrategyExperimentProposal(commandClient, screenState, experimentId));
                } finally {
                  setIsExperimentSaving(false);
                }
              }}
              onAcceptVaultImport={async () => {
                setIsVaultBusy(true);
                try {
                  setScreenState(await acceptVaultImportPreview(commandClient, screenState));
                  setVaultImportContent('');
                } catch (error) {
                  setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                } finally {
                  setIsVaultBusy(false);
                }
              }}
              onAdoptSupportTemplate={async (templateId) => {
                setIsSupportAdopting(true);
                try {
                  setScreenState(await adoptSupportTemplate(commandClient, screenState, templateId));
                } finally {
                  setIsSupportAdopting(false);
                }
              }}
              onCreateCustomSupport={async () => {
                setIsCustomSupportCreating(true);
                try {
                  setScreenState(await createCustomSupportNode(commandClient, screenState, customSupportTitle, customSupportBody));
                  setCustomSupportTitle('');
                  setCustomSupportBody('');
                } finally {
                  setIsCustomSupportCreating(false);
                }
              }}
              onCustomSupportBodyChange={setCustomSupportBody}
              onCustomSupportTitleChange={setCustomSupportTitle}
              onDeleteMemory={async (memoryId) => {
                setIsMemorySaving(true);
                try {
                  setScreenState(await deletePreferenceMemory(commandClient, screenState, memoryId));
                } finally {
                  setIsMemorySaving(false);
                }
              }}
              onDiscardSupport={async (supportId) => {
                setIsSupportSaving(true);
                try {
                  setScreenState(await discardSupportNode(commandClient, screenState, supportId));
                } finally {
                  setIsSupportSaving(false);
                }
              }}
              onExperimentContextChange={setExperimentContext}
              onExperimentDecisionChange={setExperimentDecision}
              onExperimentHelpedChange={(key, value) => {
                setExperimentHelped((current) => ({ ...current, [key]: value }));
              }}
              onExperimentObstacleChange={setExperimentObstacle}
              onExperimentSupportIdChange={setExperimentSupportId}
              onMemoryDraftChange={(memoryId, value) => {
                setMemoryDrafts((current) => ({ ...current, [memoryId]: value }));
              }}
              onPendingMemoryDraftChange={(memoryId, value) => {
                setPendingMemoryDrafts((current) => ({ ...current, [memoryId]: value }));
              }}
              onPreviewStrategyExperiment={() => {
                setScreenState((current) =>
                  draftStrategyExperiment(current, {
                    supportTemplateId: experimentSupportId || null,
                    customSupportTitle: null,
                    context: experimentContext,
                    helpedStart: experimentHelped.start,
                    helpedContinue: experimentHelped.continue,
                    helpedReturn: experimentHelped.return,
                    helpedClarifyNextAction: experimentHelped.clarify,
                    obstacleNote: experimentObstacle,
                    nextDecision: experimentDecision,
                  }),
                );
              }}
              onPreviewVaultImport={(files) => {
                setScreenState((current) => previewVaultImport(current, files));
              }}
              onRejectMemoryProposal={(memoryId) => {
                setScreenState((current) => rejectPreferenceMemoryProposal(current, memoryId));
              }}
              onRejectStrategyExperiment={(experimentId) => {
                setScreenState((current) => rejectStrategyExperimentProposal(current, experimentId));
              }}
              onRejectVaultImport={() => {
                setScreenState((current) => rejectVaultImportPreview(current));
              }}
              onSaveCustomSupportTemplate={() => {
                setIsCustomSupportTemplateSaving(true);
                try {
                  setScreenState((current) => saveCustomSupportTemplate(current, customSupportTitle, customSupportBody));
                  setCustomSupportTitle('');
                  setCustomSupportBody('');
                } finally {
                  setIsCustomSupportTemplateSaving(false);
                }
              }}
              onSaveMemory={async (memoryId, text) => {
                setIsMemorySaving(true);
                try {
                  setScreenState(await updatePreferenceMemory(commandClient, screenState, memoryId, text));
                } finally {
                  setIsMemorySaving(false);
                }
              }}
              onSaveSupport={async (supportId, title, body) => {
                setIsSupportSaving(true);
                try {
                  setScreenState(await updateSupportNode(commandClient, screenState, supportId, title, body));
                } finally {
                  setIsSupportSaving(false);
                }
              }}
              onSupportDraftChange={(supportId, draft) => {
                setSupportDrafts((current) => ({ ...current, [supportId]: draft }));
              }}
              onVaultExportPreview={async () => {
                if (isVaultBusy || !screenState.workspaceId) {
                  return;
                }
                setIsVaultBusy(true);
                try {
                  const exported = await commandClient.vaultExport(screenState.workspaceId);
                  setVaultExportSummary(
                    `${exported.files.length} Markdown file${exported.files.length === 1 ? '' : 's'} ready to save manually.`,
                  );
                  setScreenState((current) => ({ ...current, lastError: null }));
                } catch (error) {
                  setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                } finally {
                  setIsVaultBusy(false);
                }
              }}
              onVaultExportToFolder={handleVaultExportToFolder}
              onVaultImportContentChange={setVaultImportContent}
              onVaultImportFilenameChange={setVaultImportFilename}
              onVaultPickImportFolder={handleVaultPickImportFolder}
              pendingMemoryDrafts={pendingMemoryDrafts}
              pendingMemoryProposals={screenState.pendingMemoryProposals}
              pendingStrategyExperiments={screenState.pendingStrategyExperiments}
              pendingVaultImport={screenState.pendingVaultImport}
              preferenceMemory={screenState.preferenceMemory}
              settingsPanel={
                <SettingsPanel
                  adultContextOptions={adultContextOptions}
                  executionDifficultyOptions={executionDifficultyOptions}
                  isLlmSaving={isLlmSaving}
                  isLlmTesting={isLlmTesting}
                  isOnboardingSaving={isOnboardingSaving}
                  llmApiKey={llmApiKey}
                  llmBaseUrl={llmBaseUrl}
                  llmModel={llmModel}
                  llmTimeoutSeconds={llmTimeoutSeconds}
                  onboardingContexts={onboardingContexts}
                  onboardingDifficulties={onboardingDifficulties}
                  onboardingSupportCategories={onboardingSupportCategories}
                  onLlmApiKeyChange={handleLlmApiKeyChange}
                  onLlmBaseUrlChange={handleLlmBaseUrlChange}
                  onLlmModelChange={handleLlmModelChange}
                  onLlmTimeoutSecondsChange={handleLlmTimeoutSecondsChange}
                  onOnboardingContextsChange={setOnboardingContexts}
                  onOnboardingDifficultiesChange={setOnboardingDifficulties}
                  onOnboardingSupportCategoriesChange={setOnboardingSupportCategories}
                  onSaveLlmSettings={async () => {
                    if (isLlmSaving || !llmBaseUrl.trim() || !llmApiKey.trim() || !llmModel.trim()) {
                      return;
                    }
                    setIsLlmSaving(true);
                    try {
                      setScreenState(
                        await saveLlmSettings(commandClient, screenState, llmBaseUrl, llmApiKey, llmModel, llmTimeoutSeconds),
                      );
                      setRequestedPane(null);
                      setActiveTaskPanel(null);
                    } catch (error) {
                      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                    } finally {
                      setIsLlmSaving(false);
                    }
                  }}
                  onSaveOnboardingProfile={async () => {
                    if (isOnboardingSaving) {
                      return;
                    }
                    setIsOnboardingSaving(true);
                    try {
                      setScreenState(
                        await saveOnboardingProfile(
                          commandClient,
                          screenState,
                          onboardingContexts,
                          onboardingDifficulties,
                          onboardingSupportCategories,
                        ),
                      );
                    } catch (error) {
                      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                    } finally {
                      setIsOnboardingSaving(false);
                    }
                  }}
                  onTestLlmSettings={async () => {
                    if (isLlmTesting || !llmBaseUrl.trim() || !llmApiKey.trim() || !llmModel.trim()) {
                      return;
                    }
                    setIsLlmTesting(true);
                    try {
                      setScreenState(
                        await testLlmSettings(commandClient, screenState, llmBaseUrl, llmApiKey, llmModel, llmTimeoutSeconds),
                      );
                    } catch (error) {
                      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                    } finally {
                      setIsLlmTesting(false);
                    }
                  }}
                  onThemePreferenceChange={setThemePreference}
                  profile={screenState.contextProfile}
                  providerTestMessage={screenState.providerTestResult?.message ?? null}
                  providerTestStatus={screenState.providerTestResult ? 'ok' : 'idle'}
                  settingsSections={settingsSections}
                  supportCategoryOptions={supportCategoryOptions}
                  themeOptions={themeOptions}
                  themePreference={themePreference}
                />
              }
              supportDrafts={supportDrafts}
              supportTemplates={supportTemplates}
              vaultExportSummary={vaultExportSummary}
              vaultImportContent={vaultImportContent}
              vaultImportFilename={vaultImportFilename}
              workspaceReady={Boolean(screenState.workspaceId)}
            />
          }
        />
      ) : (
        <section className="start-mode-focus" aria-label="Focused Start Mode">
          <div className="start-mode-focus-header">
            <div>
              <span className="eyebrow">Start Mode</span>
              <h2>{startModeView.nextAction}</h2>
            </div>
            <button
              className="secondary"
              onClick={() =>
                setScreenState((current) => ({
                  ...current,
                  workbench: leaveStartMode(current.workbench),
                }))
              }
              type="button"
            >
              Return to map
            </button>
          </div>
          <StartPanel
            attentionSession={screenState.attentionSession}
            checkInDraft={checkInDraft}
            checkIns={screenState.checkIns}
            followUpPrompts={followUpPrompts}
            hasStartableAction={hasStartableAction}
            isCheckInSaving={isCheckInSaving}
            isSessionBusy={isSessionBusy}
            onCheckInDraftChange={setCheckInDraft}
            onCloseSession={async () => {
              setIsSessionBusy(true);
              try {
                setScreenState(
                  await closeAttentionSession(
                    commandClient,
                    screenState,
                    new Date().toISOString(),
                    sessionCompletionNote,
                  ),
                );
                setSessionCompletionNote('');
              } finally {
                setIsSessionBusy(false);
              }
            }}
            onSaveCheckIn={async () => {
              setIsCheckInSaving(true);
              try {
                setScreenState(await createCheckIn(commandClient, screenState, checkInDraft));
                setCheckInDraft('');
              } finally {
                setIsCheckInSaving(false);
              }
            }}
            onSessionCompletionNoteChange={setSessionCompletionNote}
            onStartSession={handleStartAttentionSession}
            sessionCompletionNote={sessionCompletionNote}
            startModeView={startModeView}
            startTimerState={startTimerState}
            workspaceReady={Boolean(screenState.workspaceId)}
          />
        </section>
      )}
    </main>
  );
}
