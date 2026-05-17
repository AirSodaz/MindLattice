import {
  Background,
  Controls,
  Handle,
  ReactFlow,
  ReactFlowProvider,
  Position,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react';
import { Activity, BrainCircuit, Check, CircleDot, Moon, Send, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import {
  acceptActivePreview,
  addConnectedNode,
  connectExistingNodes,
  adoptSupportTemplate,
  createCheckIn,
  createCustomSupportNode,
  createFocusTask,
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
  previewWriteSummary,
  reactFlowElementsFromWorkbench,
  resolveTheme,
  resolveWorkbenchShortcut,
  type ThemePreference,
  type WorkbenchNodeKind,
} from '../features/workbench/workbenchModel';
import { buildSettingsSections, isFirstRunSetupComplete } from '../features/settings/settingsModel';
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

type WorkbenchFlowNodeData = {
  kind: WorkbenchNodeKind;
  title: string;
  status: string;
};

function WorkbenchFlowNode({ data, selected }: NodeProps<Node<WorkbenchFlowNodeData, 'workbenchNode'>>) {
  return (
    <div className={`map-node node-${data.kind} ${selected ? 'is-selected' : ''}`}>
      <Handle position={Position.Top} type="target" />
      <span>{data.status === 'Draft' ? `Draft ${data.kind.replace('_', ' ')}` : data.kind.replace('_', ' ')}</span>
      {data.title}
      <Handle position={Position.Bottom} type="source" />
    </div>
  );
}

const nodeTypes = {
  workbenchNode: WorkbenchFlowNode,
};

function CheckInHistory({ checkIns }: { checkIns: WorkbenchScreenState['checkIns'] }) {
  return (
    <div className="check-in-history" aria-label="Saved check-ins">
      <div>
        <span className="eyebrow">Check-in history</span>
        <h3>Saved follow-ups</h3>
      </div>
      {checkIns.length === 0 ? (
        <p>No check-ins saved yet.</p>
      ) : (
        <ul>
          {[...checkIns].reverse().map((checkIn) => (
            <li key={checkIn.id}>
              <p>{checkIn.body}</p>
              <span>{checkIn.nodeId ? 'Linked to current map item' : 'Workspace note'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
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
  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
  const [focusTaskDraft, setFocusTaskDraft] = useState('');
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [isFocusTaskCreating, setIsFocusTaskCreating] = useState(false);
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
  const quickCaptureInputRef = useRef<HTMLInputElement | null>(null);
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
  const previewSummary = previewWriteSummary(workbench.activePreview);
  const startModeView = useMemo(() => buildStartModeView(workbench), [workbench]);
  const hasStartableAction = workbench.nodes.some((node) => node.kind === 'next_action');
  const isStartModeFocused = workbench.viewMode === 'start';
  const hasFirstRunSetup = isFirstRunSetupComplete(screenState.contextProfile);
  const startTimerState = useMemo(
    () => buildStartTimerState(screenState.attentionSession, timerNowIso),
    [screenState.attentionSession, timerNowIso],
  );
  const followUpPrompts = useMemo(() => followUpPromptOptions(), []);
  const flowElements = useMemo(
    () => reactFlowElementsFromWorkbench(workbench, flowCanvasSize),
    [workbench],
  );

  const handleCreateFocusTask = useCallback(async () => {
    if (isFocusTaskCreating || !focusTaskDraft.trim()) {
      return;
    }
    setIsFocusTaskCreating(true);
    try {
      setScreenState({ ...(await createFocusTask(commandClient, screenState, focusTaskDraft)), lastError: null });
      setFocusTaskDraft('');
    } catch (error) {
      setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
    } finally {
      setIsFocusTaskCreating(false);
    }
  }, [commandClient, focusTaskDraft, isFocusTaskCreating, screenState]);

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
        quickCaptureInputRef.current?.focus();
        quickCaptureInputRef.current?.select();
        return;
      }
      if (shortcut === 'save-selected-node') {
        void handleSaveSelectedNode();
        return;
      }
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

  return (
    <main className={`app-shell ${isStartModeFocused ? 'is-start-mode' : ''}`} data-theme={resolvedTheme}>
      <aside className="agent-panel" aria-label="Conversational execution agent">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">MindLattice</span>
            <h1>Execution agent</h1>
          </div>
          <BrainCircuit aria-hidden="true" size={22} />
        </div>

        <div className="message-list" aria-label="Agent thread">
          {workbench.messages.map((message) => (
            <article className={`message message-${message.sender}`} key={message.id}>
              <span>{message.sender === 'agent' ? 'Agent' : 'You'}</span>
              <p>{message.body}</p>
            </article>
          ))}
        </div>

        <form
          className="composer"
          onSubmit={async (event) => {
            event.preventDefault();
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
            } catch (error) {
              setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
            } finally {
              setIsAgentBusy(false);
            }
          }}
        >
          <textarea
            aria-label="Message the execution agent"
            disabled={isAgentBusy || !isLlmConfigured}
            onChange={(event) => setComposerValue(event.target.value)}
            value={composerValue}
          />
          <button aria-label="Send message" disabled={isAgentBusy || !isLlmConfigured} type="submit">
            <Send aria-hidden="true" size={18} />
          </button>
        </form>

        {!hasFirstRunSetup ? (
          <p className="agent-setup-hint">Finish Agent Provider and Local Profile in Settings before the agent workflow is available.</p>
        ) : null}
      </aside>

      {screenState.lastError ? (
        <div className="error-notice" role="alert">
          <strong>{screenState.lastError.message}</strong>
          <span>{screenState.lastError.detail}</span>
        </div>
      ) : null}

      {!isStartModeFocused ? (
      <section className="map-workspace" aria-label="Star-map canvas">
        <header className="workspace-toolbar">
          <div>
            <span className="eyebrow">Star-map canvas</span>
            <h2>{workbench.focusTaskTitle}</h2>
          </div>
          <div className="theme-control" aria-label="Theme preference">
            {themeOptions.map((option) => (
              <button
                className={themePreference === option.value ? 'is-active' : ''}
                key={option.value}
                onClick={() => setThemePreference(option.value)}
                type="button"
              >
                {option.value === 'dark' ? <Moon aria-hidden="true" size={16} /> : <Sun aria-hidden="true" size={16} />}
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <form
          className="quick-capture"
          onSubmit={async (event) => {
            event.preventDefault();
            await handleCreateFocusTask();
          }}
        >
          <label>
            Focus task
            <input
              disabled={isFocusTaskCreating || !screenState.workspaceId}
              ref={quickCaptureInputRef}
              onChange={(event) => setFocusTaskDraft(event.target.value)}
              placeholder="Name the task to make visible"
              value={focusTaskDraft}
            />
          </label>
          <button disabled={isFocusTaskCreating || !focusTaskDraft.trim() || !screenState.workspaceId} type="submit">
            Create task
          </button>
        </form>

        <div className="canvas-plane">
          <ReactFlowProvider>
            <ReactFlow
              colorMode={resolvedTheme}
              edges={flowElements.edges}
              fitView
              minZoom={0.6}
              nodeTypes={nodeTypes}
              nodes={flowElements.nodes}
              nodesDraggable
              onNodeClick={(_event, node) =>
                setScreenState((current) => ({
                  ...current,
                  workbench: { ...current.workbench, selectedNodeId: node.id },
                }))
              }
              onNodeDragStop={handleNodeDragStop}
              panOnScroll
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={42} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </section>
      ) : null}

      {!isStartModeFocused ? (
      <aside className="detail-panel" aria-label="Inspector and preview">
        <section className="preview-surface">
          <div className="panel-heading compact">
            <div>
              <span className="eyebrow">Agent preview</span>
              <h2>Review before saving</h2>
            </div>
            <CircleDot aria-hidden="true" size={18} />
          </div>
          <p>{previewSummary}</p>
          <div className="action-row">
            <button
              disabled={!workbench.activePreview}
              onClick={async () => {
                setScreenState(await acceptActivePreview(commandClient, screenState));
              }}
              type="button"
            >
              <Check aria-hidden="true" size={16} />
              Accept
            </button>
            <button
              className="secondary"
              disabled={!workbench.activePreview}
              onClick={async () => {
                setScreenState(await rejectActivePreview(commandClient, screenState));
              }}
              type="button"
            >
              <X aria-hidden="true" size={16} />
              Reject
            </button>
          </div>
        </section>

        <section className="inspector-surface">
          <span className="eyebrow">Selected node</span>
          <h2>{selectedNode?.title ?? 'No selection'}</h2>
          <form
            className="node-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              await handleSaveSelectedNode();
            }}
          >
            <label>
              Title
              <input
                disabled={!selectedNode || isNodeSaving}
                onChange={(event) => setNodeTitleDraft(event.target.value)}
                value={nodeTitleDraft}
              />
            </label>
            <label>
              Body
              <textarea
                disabled={!selectedNode || isNodeSaving}
                onChange={(event) => setNodeBodyDraft(event.target.value)}
                value={nodeBodyDraft}
              />
            </label>
            <button disabled={!selectedNode || isNodeSaving || !nodeTitleDraft.trim()} type="submit">
              Save node
            </button>
          </form>
          <form
            className="node-editor compact"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isNodeSaving || !selectedNode || !newNodeTitle.trim()) {
                return;
              }
              setIsNodeSaving(true);
              try {
                setScreenState(await addConnectedNode(commandClient, screenState, newNodeKind, newNodeTitle));
                setNewNodeTitle('');
              } finally {
                setIsNodeSaving(false);
              }
            }}
          >
            <label>
              Add nearby
              <select
                disabled={!selectedNode || isNodeSaving}
                onChange={(event) => setNewNodeKind(event.target.value as WorkbenchNodeKind)}
                value={newNodeKind}
              >
                {surroundingNodeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                disabled={!selectedNode || isNodeSaving}
                onChange={(event) => setNewNodeTitle(event.target.value)}
                placeholder="Name the nearby node"
                value={newNodeTitle}
              />
            </label>
            <button disabled={!selectedNode || isNodeSaving || !newNodeTitle.trim()} type="submit">
              Add node
            </button>
          </form>
          <form
            className="node-editor compact"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isEdgeSaving || !edgeSourceId || !edgeTargetId || edgeSourceId === edgeTargetId) {
                return;
              }
              setIsEdgeSaving(true);
              try {
                setScreenState(await connectExistingNodes(commandClient, screenState, edgeSourceId, edgeTargetId, edgeKind));
              } finally {
                setIsEdgeSaving(false);
              }
            }}
          >
            <label>
              Connect from
              <select
                disabled={isEdgeSaving || workbench.nodes.length < 2}
                onChange={(event) => setEdgeSourceId(event.target.value)}
                value={edgeSourceId}
              >
                {workbench.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Connect to
              <select
                disabled={isEdgeSaving || workbench.nodes.length < 2}
                onChange={(event) => setEdgeTargetId(event.target.value)}
                value={edgeTargetId}
              >
                {workbench.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Relationship
              <select disabled={isEdgeSaving} onChange={(event) => setEdgeKind(event.target.value)} value={edgeKind}>
                {edgeKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={isEdgeSaving || workbench.nodes.length < 2 || !edgeSourceId || !edgeTargetId || edgeSourceId === edgeTargetId}
              type="submit"
            >
              Connect nodes
            </button>
          </form>
          {workbench.edges.length > 0 ? (
            <div className="edge-list" aria-label="Current connections">
              {workbench.edges.map((edge) => {
                const source = workbench.nodes.find((node) => node.id === edge.sourceId);
                const target = workbench.nodes.find((node) => node.id === edge.targetId);
                return (
                  <p key={edge.id}>
                    <span>{edge.kind.replaceAll('_', ' ')}</span>
                    {source?.title ?? edge.sourceId}
                    {' -> '}
                    {target?.title ?? edge.targetId}
                  </p>
                );
              })}
            </div>
          ) : null}
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{selectedNode?.status ?? 'Draft'}</dd>
            </div>
            <div>
              <dt>Minimum done</dt>
              <dd>{selectedNode?.minimumDone ?? 'Define the smallest visible finish line.'}</dd>
            </div>
            <div>
              <dt>Estimate</dt>
              <dd>{selectedNode?.estimateMinutes ? `${selectedNode.estimateMinutes} min` : 'Unset'}</dd>
            </div>
          </dl>
        </section>

        <SettingsPanel
          adultContextOptions={adultContextOptions}
          executionDifficultyOptions={executionDifficultyOptions}
          isLlmSaving={isLlmSaving}
          isOnboardingSaving={isOnboardingSaving}
          llmApiKey={llmApiKey}
          llmBaseUrl={llmBaseUrl}
          llmModel={llmModel}
          llmTimeoutSeconds={llmTimeoutSeconds}
          onboardingContexts={onboardingContexts}
          onboardingDifficulties={onboardingDifficulties}
          onboardingSupportCategories={onboardingSupportCategories}
          onLlmApiKeyChange={setLlmApiKey}
          onLlmBaseUrlChange={setLlmBaseUrl}
          onLlmModelChange={setLlmModel}
          onLlmTimeoutSecondsChange={setLlmTimeoutSeconds}
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
                await saveLlmSettings(
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
          onThemePreferenceChange={setThemePreference}
          profile={screenState.contextProfile}
          settingsSections={settingsSections}
          supportCategoryOptions={supportCategoryOptions}
          themeOptions={themeOptions}
          themePreference={themePreference}
        />

        <section className="support-surface">
          <div>
            <span className="eyebrow">Support templates</span>
            <h2>Try one support</h2>
          </div>
          <div className="support-list">
            {supportTemplates.slice(0, 3).map((template) => (
              <article className="support-template" key={template.id}>
                <div>
                  <span>{template.category.replaceAll('_', ' ')}</span>
                  <h3>{template.title}</h3>
                </div>
                <p>{template.steps[0]}</p>
                <button
                  disabled={isSupportAdopting || !screenState.workspaceId}
                  onClick={async () => {
                    setIsSupportAdopting(true);
                    try {
                      setScreenState(await adoptSupportTemplate(commandClient, screenState, template.id));
                    } finally {
                      setIsSupportAdopting(false);
                    }
                  }}
                  type="button"
                >
                  Adopt
                </button>
              </article>
            ))}
          </div>
          <div className="adopted-supports">
            <div>
              <span className="eyebrow">Adopted supports</span>
              <h3>Keep or adjust</h3>
            </div>
            {adoptedSupports.length === 0 ? (
              <p>No adopted support yet.</p>
            ) : (
              adoptedSupports.map((support) => {
                const draft = supportDrafts[support.id] ?? { title: support.title, body: support.body ?? '' };
                return (
                  <form
                    className="support-editor"
                    key={support.id}
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (isSupportSaving || !draft.title.trim()) {
                        return;
                      }
                      setIsSupportSaving(true);
                      try {
                        setScreenState(
                          await updateSupportNode(commandClient, screenState, support.id, draft.title, draft.body),
                        );
                      } finally {
                        setIsSupportSaving(false);
                      }
                    }}
                  >
                    <label>
                      Title
                      <input
                        disabled={isSupportSaving}
                        onChange={(event) =>
                          setSupportDrafts((current) => ({
                            ...current,
                            [support.id]: {
                              title: event.target.value,
                              body: current[support.id]?.body ?? support.body ?? '',
                            },
                          }))
                        }
                        value={draft.title}
                      />
                    </label>
                    <label>
                      Notes
                      <textarea
                        disabled={isSupportSaving}
                        onChange={(event) =>
                          setSupportDrafts((current) => ({
                            ...current,
                            [support.id]: {
                              title: current[support.id]?.title ?? support.title,
                              body: event.target.value,
                            },
                          }))
                        }
                        value={draft.body}
                      />
                    </label>
                    <div className="action-row">
                      <button disabled={isSupportSaving || !draft.title.trim()} type="submit">
                        Save
                      </button>
                      <button
                        className="secondary"
                        disabled={isSupportSaving}
                        onClick={async () => {
                          setIsSupportSaving(true);
                          try {
                            setScreenState(await discardSupportNode(commandClient, screenState, support.id));
                          } finally {
                            setIsSupportSaving(false);
                          }
                        }}
                        type="button"
                      >
                        Discard
                      </button>
                    </div>
                  </form>
                );
              })
            )}
          </div>
          <form
            className="custom-support-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isCustomSupportCreating || !customSupportTitle.trim()) {
                return;
              }
              setIsCustomSupportCreating(true);
              try {
                setScreenState(
                  await createCustomSupportNode(commandClient, screenState, customSupportTitle, customSupportBody),
                );
                setCustomSupportTitle('');
                setCustomSupportBody('');
              } finally {
                setIsCustomSupportCreating(false);
              }
            }}
          >
            <div>
              <span className="eyebrow">Custom support</span>
              <h3>Create one support</h3>
            </div>
            <label>
              Title
              <input
                disabled={isCustomSupportCreating || !screenState.workspaceId}
                onChange={(event) => setCustomSupportTitle(event.target.value)}
                placeholder="Name the support"
                value={customSupportTitle}
              />
            </label>
            <label>
              Notes
              <textarea
                disabled={isCustomSupportCreating || !screenState.workspaceId}
                onChange={(event) => setCustomSupportBody(event.target.value)}
                placeholder="What should stay visible when you try it?"
                value={customSupportBody}
              />
            </label>
            <div className="action-row">
              <button
                disabled={isCustomSupportCreating || !screenState.workspaceId || !customSupportTitle.trim()}
                type="submit"
              >
                Create support
              </button>
              <button
                className="secondary"
                disabled={isCustomSupportTemplateSaving || !screenState.workspaceId || !customSupportTitle.trim()}
                onClick={() => {
                  if (isCustomSupportTemplateSaving || !customSupportTitle.trim()) {
                    return;
                  }
                  setIsCustomSupportTemplateSaving(true);
                  setScreenState((current) =>
                    saveCustomSupportTemplate(current, customSupportTitle, customSupportBody),
                  );
                  setCustomSupportTitle('');
                  setCustomSupportBody('');
                  setIsCustomSupportTemplateSaving(false);
                }}
                type="button"
              >
                Save template
              </button>
            </div>
          </form>
          <form
            className="strategy-experiment-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isExperimentSaving || !experimentSupportId) {
                return;
              }
              setIsExperimentSaving(true);
              try {
                setScreenState(
                  draftStrategyExperiment(screenState, {
                    supportTemplateId: experimentSupportId,
                    customSupportTitle: null,
                    context: experimentContext,
                    helpedStart: experimentHelped.start,
                    helpedContinue: experimentHelped.continue,
                    helpedReturn: experimentHelped.return,
                    helpedClarifyNextAction: experimentHelped.clarify,
                    obstacleNote: experimentObstacle.trim() ? experimentObstacle.trim() : null,
                    nextDecision: experimentDecision,
                  }),
                );
                setExperimentObstacle('');
              } finally {
                setIsExperimentSaving(false);
              }
            }}
          >
            <div>
              <span className="eyebrow">Strategy experiment</span>
              <h3>Record what helped</h3>
            </div>
            <label>
              Support tried
              <select
                disabled={isExperimentSaving || supportTemplates.length === 0}
                onChange={(event) => setExperimentSupportId(event.target.value)}
                value={experimentSupportId}
              >
                {supportTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Context
              <select
                disabled={isExperimentSaving}
                onChange={(event) => setExperimentContext(event.target.value as CommandExperimentContext)}
                value={experimentContext}
              >
                <option value="work">Work</option>
                <option value="study">Study</option>
                <option value="home_responsibility">Home responsibility</option>
                <option value="personal_project">Personal project</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <fieldset>
              <legend>Helped with</legend>
              {[
                ['start', 'Starting'],
                ['continue', 'Continuing'],
                ['return', 'Returning'],
                ['clarify', 'Clarifying next action'],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    checked={experimentHelped[key as keyof typeof experimentHelped]}
                    disabled={isExperimentSaving}
                    onChange={(event) =>
                      setExperimentHelped((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              What got in the way
              <textarea
                disabled={isExperimentSaving}
                onChange={(event) => setExperimentObstacle(event.target.value)}
                placeholder="Optional obstacle or adjustment note"
                value={experimentObstacle}
              />
            </label>
            <label>
              Next decision
              <select
                disabled={isExperimentSaving}
                onChange={(event) => setExperimentDecision(event.target.value as CommandStrategyDecision)}
                value={experimentDecision}
              >
                <option value="keep">Keep</option>
                <option value="revise">Revise</option>
                <option value="pause">Pause</option>
                <option value="remove">Remove</option>
              </select>
            </label>
            <button disabled={isExperimentSaving || !experimentSupportId} type="submit">
              Review experiment
            </button>
          </form>
          {screenState.pendingStrategyExperiments.length > 0 ? (
            <div className="strategy-proposal-list" aria-label="Pending strategy experiment proposals">
              {screenState.pendingStrategyExperiments.map((experiment) => {
                const supportLabel = experiment.supportTemplateId ?? experiment.customSupportTitle ?? 'custom support';
                return (
                  <article className="strategy-proposal" key={experiment.id}>
                    <div>
                      <span className="eyebrow">Pending experiment</span>
                      <h3>
                        {experiment.nextDecision} {supportLabel}
                      </h3>
                    </div>
                    {experiment.obstacleNote ? <p>{experiment.obstacleNote}</p> : null}
                    <dl>
                      <div>
                        <dt>Context</dt>
                        <dd>{experiment.context.replaceAll('_', ' ')}</dd>
                      </div>
                      <div>
                        <dt>Helped</dt>
                        <dd>
                          {[
                            experiment.helpedStart ? 'start' : null,
                            experiment.helpedContinue ? 'continue' : null,
                            experiment.helpedReturn ? 'return' : null,
                            experiment.helpedClarifyNextAction ? 'clarify' : null,
                          ]
                            .filter(Boolean)
                            .join(', ') || 'Not marked'}
                        </dd>
                      </div>
                    </dl>
                    <div className="action-row">
                      <button
                        disabled={isExperimentSaving}
                        onClick={async () => {
                          setIsExperimentSaving(true);
                          try {
                            setScreenState(
                              await acceptStrategyExperimentProposal(commandClient, screenState, experiment.id),
                            );
                          } finally {
                            setIsExperimentSaving(false);
                          }
                        }}
                        type="button"
                      >
                        Accept experiment
                      </button>
                      <button
                        className="secondary"
                        disabled={isExperimentSaving}
                        onClick={() =>
                          setScreenState((current) => rejectStrategyExperimentProposal(current, experiment.id))
                        }
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="start-mode-surface">
          <div className="start-mode-header">
            <div>
              <span className="eyebrow">Start Mode</span>
              <h2>{startModeView.nextAction}</h2>
            </div>
            <button
              disabled={!hasStartableAction}
              onClick={() =>
                setScreenState((current) => ({
                  ...current,
                  workbench: enterStartMode(current.workbench),
                }))
              }
              type="button"
            >
              Enter Start Mode
            </button>
          </div>
          <p>{startModeView.minimumDone}</p>
          <dl className="start-mode-details">
            {startModeView.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
          <div className="session-controls">
            <span>{screenState.attentionSession ? 'Focus session active' : 'Ready to start'}</span>
            {startTimerState ? (
              <div className="timer-status" aria-label="Focus timer">
                <strong>{startTimerState.label}</strong>
                <span>
                  {startTimerState.remainingMinutes > 0
                    ? `${startTimerState.remainingMinutes} min left in this launch`
                    : 'Launch window is open-ended'}
                </span>
              </div>
            ) : null}
            {screenState.attentionSession ? (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (isSessionBusy) {
                    return;
                  }
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
              >
                <input
                  disabled={isSessionBusy}
                  onChange={(event) => setSessionCompletionNote(event.target.value)}
                  placeholder="What changed or where to resume?"
                  value={sessionCompletionNote}
                />
                <button disabled={isSessionBusy} type="submit">
                  Close session
                </button>
              </form>
            ) : (
              <button
                disabled={isSessionBusy || !workbench.nodes.some((node) => node.kind === 'next_action')}
                onClick={() => {
                  void handleStartAttentionSession();
                }}
                type="button"
              >
                Start focus
              </button>
            )}
          </div>
          <ul>
            {startModeView.checks.map((check) => (
              <li key={check}>
                <Activity aria-hidden="true" size={15} />
                {check}
              </li>
            ))}
          </ul>
          <form
            className="check-in-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isCheckInSaving || !checkInDraft.trim()) {
                return;
              }
              setIsCheckInSaving(true);
              try {
                setScreenState(await createCheckIn(commandClient, screenState, checkInDraft));
                setCheckInDraft('');
              } finally {
                setIsCheckInSaving(false);
              }
            }}
          >
            <div className="follow-up-prompts" aria-label="Follow-up prompts">
              {followUpPrompts.map((prompt) => (
                <button
                  disabled={isCheckInSaving}
                  key={prompt}
                  onClick={() => setCheckInDraft(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <label>
              Check-in
              <textarea
                disabled={isCheckInSaving || !screenState.workspaceId}
                onChange={(event) => setCheckInDraft(event.target.value)}
                placeholder="Did you start, where did it get stuck, or what should stay visible next?"
                value={checkInDraft}
              />
            </label>
            <button disabled={isCheckInSaving || !checkInDraft.trim() || !screenState.workspaceId} type="submit">
              Save check-in
            </button>
          </form>
          <CheckInHistory checkIns={screenState.checkIns} />
        </section>

        <section className="vault-surface">
          <div>
            <span className="eyebrow">Vault import/export</span>
            <h2>Manual Markdown snapshot</h2>
          </div>
          <div className="action-row">
            <button
              disabled={isVaultBusy || !screenState.workspaceId}
              onClick={async () => {
                setIsVaultBusy(true);
                try {
                  const exported = await commandClient.vaultExport(screenState.workspaceId);
                  setVaultExportSummary(`${exported.files.length} Markdown file${exported.files.length === 1 ? '' : 's'} ready to save manually.`);
                  setScreenState((current) => ({ ...current, lastError: null }));
                } catch (error) {
                  setScreenState((current) => ({ ...current, lastError: presentCommandError(error) }));
                } finally {
                  setIsVaultBusy(false);
                }
              }}
              type="button"
            >
              Preview export
            </button>
            <button
              disabled={isVaultBusy || !screenState.workspaceId}
              onClick={handleVaultExportToFolder}
              type="button"
            >
              Export folder
            </button>
            <button
              className="secondary"
              disabled={isVaultBusy || !screenState.workspaceId}
              onClick={handleVaultPickImportFolder}
              type="button"
            >
              Import folder
            </button>
          </div>
          {vaultExportSummary ? <p>{vaultExportSummary}</p> : null}
          <form
            className="vault-import-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (isVaultBusy || !vaultImportFilename.trim() || !vaultImportContent.trim()) {
                return;
              }
              setScreenState((current) =>
                previewVaultImport(current, [
                  {
                    filename: vaultImportFilename.trim(),
                    content: vaultImportContent,
                  },
                ]),
              );
            }}
          >
            <label>
              Markdown filename
              <input
                disabled={isVaultBusy}
                onChange={(event) => setVaultImportFilename(event.target.value)}
                value={vaultImportFilename}
              />
            </label>
            <label>
              Markdown content
              <textarea
                disabled={isVaultBusy}
                onChange={(event) => setVaultImportContent(event.target.value)}
                placeholder="# Imported note"
                value={vaultImportContent}
              />
            </label>
            <button disabled={isVaultBusy || !vaultImportFilename.trim() || !vaultImportContent.trim()} type="submit">
              Preview import
            </button>
          </form>
          {screenState.pendingVaultImport ? (
            <article className="vault-import-preview">
              <div>
                <span className="eyebrow">Pending import</span>
                <h3>{screenState.pendingVaultImport.fileCount} Markdown file</h3>
              </div>
              <p>{screenState.pendingVaultImport.totalBytes} characters queued for manual import.</p>
              <div className="action-row">
                <button
                  disabled={isVaultBusy}
                  onClick={async () => {
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
                  type="button"
                >
                  Accept import
                </button>
                <button
                  className="secondary"
                  disabled={isVaultBusy}
                  onClick={() => setScreenState((current) => rejectVaultImportPreview(current))}
                  type="button"
                >
                  Reject
                </button>
              </div>
            </article>
          ) : null}
        </section>

        <section className="memory-surface">
          <div>
            <span className="eyebrow">Preference memory</span>
            <h2>Review saved preferences</h2>
          </div>
          {screenState.pendingMemoryProposals.length > 0 ? (
            <div className="memory-list" aria-label="Pending preference memory proposals">
              {screenState.pendingMemoryProposals.map((memory) => (
                <form
                  className="memory-item pending"
                  key={memory.id}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const draft = pendingMemoryDrafts[memory.id] ?? '';
                    if (isMemorySaving || !draft.trim()) {
                      return;
                    }
                    setIsMemorySaving(true);
                    try {
                      setScreenState(
                        await acceptPreferenceMemoryProposal(commandClient, screenState, memory.id, draft),
                      );
                    } finally {
                      setIsMemorySaving(false);
                    }
                  }}
                >
                  <label>
                    Proposed preference
                    <textarea
                      disabled={isMemorySaving}
                      onChange={(event) =>
                        setPendingMemoryDrafts((current) => ({
                          ...current,
                          [memory.id]: event.target.value,
                        }))
                      }
                      value={pendingMemoryDrafts[memory.id] ?? memory.proposedMemoryText}
                    />
                  </label>
                  {memory.evidenceReference ? <span>Evidence: {memory.evidenceReference}</span> : null}
                  <div className="action-row">
                    <button disabled={isMemorySaving || !(pendingMemoryDrafts[memory.id] ?? '').trim()} type="submit">
                      Accept memory
                    </button>
                    <button
                      className="secondary"
                      disabled={isMemorySaving}
                      onClick={() =>
                        setScreenState((current) => rejectPreferenceMemoryProposal(current, memory.id))
                      }
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </form>
              ))}
            </div>
          ) : null}
          {screenState.preferenceMemory.length === 0 ? (
            <p>No saved preference memory yet.</p>
          ) : (
            <div className="memory-list">
              {screenState.preferenceMemory.map((memory) => (
                <form
                  className="memory-item"
                  key={memory.id}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const draft = memoryDrafts[memory.id] ?? '';
                    if (isMemorySaving || !draft.trim()) {
                      return;
                    }
                    setIsMemorySaving(true);
                    try {
                      setScreenState(await updatePreferenceMemory(commandClient, screenState, memory.id, draft));
                    } finally {
                      setIsMemorySaving(false);
                    }
                  }}
                >
                  <label>
                    Saved preference
                    <textarea
                      disabled={isMemorySaving}
                      onChange={(event) =>
                        setMemoryDrafts((current) => ({
                          ...current,
                          [memory.id]: event.target.value,
                        }))
                      }
                      value={memoryDrafts[memory.id] ?? memory.proposedMemoryText}
                    />
                  </label>
                  {memory.evidenceReference ? <span>Evidence: {memory.evidenceReference}</span> : null}
                  <div className="action-row">
                    <button disabled={isMemorySaving || !(memoryDrafts[memory.id] ?? '').trim()} type="submit">
                      Save
                    </button>
                    <button
                      className="secondary"
                      disabled={isMemorySaving}
                      onClick={async () => {
                        setIsMemorySaving(true);
                        try {
                          setScreenState(await deletePreferenceMemory(commandClient, screenState, memory.id));
                        } finally {
                          setIsMemorySaving(false);
                        }
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </section>
      </aside>
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
          <p className="start-mode-focus-minimum">{startModeView.minimumDone}</p>
          <dl className="start-mode-details">
            {startModeView.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
          <ul>
            {startModeView.checks.map((check) => (
              <li key={check}>
                <Activity aria-hidden="true" size={15} />
                {check}
              </li>
            ))}
          </ul>
          <div className="session-controls">
            <span>{screenState.attentionSession ? 'Focus session active' : 'Ready to start'}</span>
            {startTimerState ? (
              <div className="timer-status" aria-label="Focus timer">
                <strong>{startTimerState.label}</strong>
                <span>
                  {startTimerState.remainingMinutes > 0
                    ? `${startTimerState.remainingMinutes} min left in this launch`
                    : 'Launch window is open-ended'}
                </span>
              </div>
            ) : null}
            {screenState.attentionSession ? (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (isSessionBusy) {
                    return;
                  }
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
              >
                <input
                  disabled={isSessionBusy}
                  onChange={(event) => setSessionCompletionNote(event.target.value)}
                  placeholder="What changed or where to resume?"
                  value={sessionCompletionNote}
                />
                <button disabled={isSessionBusy} type="submit">
                  Close session
                </button>
              </form>
            ) : (
              <button
                disabled={isSessionBusy || !hasStartableAction}
                onClick={() => {
                  void handleStartAttentionSession();
                }}
                type="button"
              >
                Start focus
              </button>
            )}
          </div>
          <form
            className="check-in-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isCheckInSaving || !checkInDraft.trim()) {
                return;
              }
              setIsCheckInSaving(true);
              try {
                setScreenState(await createCheckIn(commandClient, screenState, checkInDraft));
                setCheckInDraft('');
              } finally {
                setIsCheckInSaving(false);
              }
            }}
          >
            <div className="follow-up-prompts" aria-label="Follow-up prompts">
              {followUpPrompts.map((prompt) => (
                <button
                  disabled={isCheckInSaving}
                  key={prompt}
                  onClick={() => setCheckInDraft(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <label>
              Check-in
              <textarea
                disabled={isCheckInSaving || !screenState.workspaceId}
                onChange={(event) => setCheckInDraft(event.target.value)}
                placeholder="Did you start, where did it get stuck, or what should stay visible next?"
                value={checkInDraft}
              />
            </label>
            <button disabled={isCheckInSaving || !checkInDraft.trim() || !screenState.workspaceId} type="submit">
              Save check-in
            </button>
          </form>
          <CheckInHistory checkIns={screenState.checkIns} />
        </section>
      )}
    </main>
  );
}
