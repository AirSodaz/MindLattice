import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAgentPreview,
  buildPreviewDiff,
  buildReturnContext,
  buildStartModeView,
  buildInitialWorkbench,
  buildStartTimerState,
  drawerTitle,
  enterStartMode,
  followUpPromptOptions,
  getSelectedNode,
  percentFromReactFlowPosition,
  reactFlowElementsFromWorkbench,
  leaveStartMode,
  presentCommandError,
  previewWriteSummary,
  recommendSupportTemplates,
  selectRightPaneMode,
  resolveWorkbenchShortcut,
  rejectActivePreview,
  resolveTheme,
} from './workbenchModel';

test('names contextual drawer surfaces without exposing them by default', () => {
  assert.equal(drawerTitle(null), 'Context drawer');
  assert.equal(drawerTitle('preview'), 'Agent preview');
  assert.equal(drawerTitle('inspector'), 'Selected node');
  assert.equal(drawerTitle('settings'), 'Settings');
});

test('resolves theme preferences', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('selected node comes from current workbench model', () => {
  const model = buildInitialWorkbench();
  assert.equal(getSelectedNode(model).title, 'Plan launch notes');
});

test('initial workbench includes Start Mode context for first render', () => {
  const model = buildInitialWorkbench();

  assert.equal(model.startPlan.nextAction, 'Open the draft and write three bullets');
  assert.deepEqual(model.startPlan.checks, ['Material visible', 'Distraction named', 'Five-minute fit', 'Return cue ready']);
});

test('builds a Start Mode view with one action and nearby context', () => {
  const view = buildStartModeView(buildInitialWorkbench());

  assert.equal(view.nextAction, 'Open the draft and write three bullets');
  assert.deepEqual(view.details, [
    { label: 'Parent task', value: 'Plan launch notes' },
    { label: 'Estimate', value: '5 min' },
    { label: 'Current blocker', value: 'Missing examples' },
    { label: 'Support', value: 'Visible short checklist' },
    { label: 'Return cue', value: 'Return to: Open the draft and write three bullets' },
  ]);
  assert.deepEqual(view.checks, ['Material visible', 'Distraction named', 'Five-minute fit', 'Return cue ready']);
});

test('enters and leaves a dedicated Start Mode view without changing map content', () => {
  const model = buildInitialWorkbench();

  const startMode = enterStartMode(model);
  const mapMode = leaveStartMode(startMode);

  assert.equal(model.viewMode, 'map');
  assert.equal(startMode.viewMode, 'start');
  assert.equal(mapMode.viewMode, 'map');
  assert.deepEqual(startMode.nodes, model.nodes);
  assert.deepEqual(mapMode.nodes, model.nodes);
});

test('does not enter Start Mode without a next action', () => {
  const model = {
    ...buildInitialWorkbench(),
    nodes: buildInitialWorkbench().nodes.filter((node) => node.kind !== 'next_action'),
  };

  assert.equal(enterStartMode(model).viewMode, 'map');
});

test('builds simple Start Mode timer state from an active attention session', () => {
  assert.deepEqual(
    buildStartTimerState(
      {
        id: 'session-1',
        nextActionId: 'next-1',
        intendedDurationMinutes: 5,
        startedAt: '2026-05-17T00:00:00Z',
        endedAt: null,
        completionNote: null,
        state: 'active',
      },
      '2026-05-17T00:02:30Z',
    ),
    {
      label: '2 min elapsed',
      elapsedMinutes: 2,
      remainingMinutes: 3,
      isOverPlannedTime: false,
    },
  );
});

test('marks Start Mode timer as open-ended after planned minutes pass', () => {
  const timerState = buildStartTimerState(
    {
      id: 'session-1',
      nextActionId: 'next-1',
      intendedDurationMinutes: 5,
      startedAt: '2026-05-17T00:00:00Z',
      endedAt: null,
      completionNote: null,
      state: 'active',
    },
    '2026-05-17T00:06:05Z',
  );

  assert.equal(timerState.label, '6 min elapsed');
  assert.equal(timerState.remainingMinutes, 0);
  assert.equal(timerState.isOverPlannedTime, true);
});

test('offers calm follow-up prompts without shame or scoring language', () => {
  const prompts = followUpPromptOptions();

  assert.deepEqual(prompts, [
    'Did you start?',
    'Where did it get stuck?',
    'Did this support help?',
    'Should the next action be smaller?',
    'What needs to be visible next time?',
  ]);
  assert.equal(prompts.some((prompt) => /score|streak|fail|failure|shame/i.test(prompt)), false);
});

test('presents structured command errors with a short actionable message and detail', () => {
  assert.deepEqual(presentCommandError(new Error('Provider config missing model')), {
    message: 'Provider config missing model',
    detail: 'Provider config missing model',
  });
  assert.deepEqual(presentCommandError('database unavailable'), {
    message: 'database unavailable',
    detail: 'database unavailable',
  });
  assert.deepEqual(presentCommandError({ code: 'provider_missing', message: 'Configure an LLM provider first.' }), {
    message: 'Configure an LLM provider first.',
    detail: 'provider_missing',
  });
});

test('preview summary states concrete write counts', () => {
  const model = buildInitialWorkbench();
  assert.equal(
    previewWriteSummary(model.activePreview),
    'Accepting will add 1 draft node, 1 draft edge, 0 memory updates, 0 check-ins, and 0 strategy experiments.',
  );
  assert.equal(
    previewWriteSummary({
      ...model.activePreview,
      proposedMemory: [{ id: 'memory-1' }],
      proposedCheckIns: [{ id: 'check-in-1' }],
      proposedStrategyExperiments: [{ id: 'strategy-1' }],
    }),
    'Accepting will add 1 draft node, 1 draft edge, 1 memory update, 1 check-in, and 1 strategy experiment.',
  );
});

test('builds a preview diff with concrete proposed write rows', () => {
  const model = buildInitialWorkbench();
  const diff = buildPreviewDiff({
    ...model.activePreview,
    proposedMemory: [
      {
        id: 'memory-1',
        proposedMemoryText: 'Prefer a visible return cue.',
        evidenceReference: 'check-in-1',
      },
    ],
    proposedCheckIns: [{ id: 'check-in-1', workspaceId: 'default-workspace', nodeId: 'next-1', body: 'Started.' }],
    proposedStrategyExperiments: [
      {
        id: 'strategy-1',
        supportTemplateId: 'visible-checklist',
        customSupportTitle: null,
        context: 'work',
        helpedStart: true,
        helpedContinue: false,
        helpedReturn: true,
        helpedClarifyNextAction: false,
        obstacleNote: 'Checklist stayed visible.',
        nextDecision: 'keep',
      },
    ],
  });

  assert.deepEqual(diff.counts, {
    nodesToAdd: 1,
    edgesToAdd: 1,
    memoryToReview: 1,
    checkInsToSave: 1,
    strategyExperimentsToSave: 1,
  });
  assert.deepEqual(
    diff.rows.map((row) => [row.kind, row.label, row.detail]),
    [
      ['node', 'Add next action', 'Find one example to paste below the outline'],
      ['edge', 'Add relationship', 'task-1 -> draft-next-2 (breaks down to)'],
      ['memory', 'Review preference memory', 'Prefer a visible return cue.'],
      ['check_in', 'Save check-in', 'Started.'],
      ['strategy_experiment', 'Save strategy experiment', 'keep visible-checklist'],
    ],
  );
  assert.equal(diff.unsupportedMutationsNotice, 'No update or delete operations are included in this preview.');
});

test('builds return context from current next action, blocker, return cue, and support result', () => {
  const model = buildInitialWorkbench();
  const context = buildReturnContext(model, [
    {
      id: 'strategy-1',
      supportTemplateId: 'visible-checklist',
      customSupportTitle: null,
      context: 'work',
      helpedStart: true,
      helpedContinue: false,
      helpedReturn: true,
      helpedClarifyNextAction: false,
      obstacleNote: 'Checklist was useful after reopening the draft.',
      nextDecision: 'keep',
    },
  ]);

  assert.deepEqual(context, {
    nextAction: 'Open the draft and write three bullets',
    blocker: 'Missing examples',
    returnCue: 'Return to: Open the draft and write three bullets',
    supportResult: 'keep visible-checklist: helped start and return. Checklist was useful after reopening the draft.',
  });
});

test('recommends support templates with one-sentence non-medical reasons', () => {
  const base = buildInitialWorkbench();
  const model = {
    ...base,
    nodes: [
      ...base.nodes,
      {
        id: 'blocker-2',
        kind: 'blocker',
        title: 'I keep losing the restart point after interruptions',
        status: 'Visible',
        x: 25,
        y: 30,
      },
    ],
  };
  const recommendations = recommendSupportTemplates(model, [
    {
      id: 'return-cue',
      category: 'external_memory',
      title: 'Visible return cue',
      steps: ['Leave one line that says where to restart.'],
      defaultContexts: ['work'],
      sourceNote: 'General external-memory strategy pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
    {
      id: 'quieter-workspace',
      category: 'sensory_environment',
      title: 'Quieter workspace',
      steps: ['Move one distracting object out of view.'],
      defaultContexts: ['work'],
      sourceNote: 'General low-risk environment adjustment pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
  ]);

  assert.equal(recommendations[0].template.id, 'return-cue');
  assert.equal(
    recommendations[0].reason,
    'Matches the current return cue or context-loss blocker, so it keeps the restart point visible.',
  );
  assert.equal(
    recommendations.every((recommendation) => !/[.!?].+[.!?]/.test(recommendation.reason)),
    true,
  );
  assert.equal(/diagnos|treat|symptom|clinical|score|streak/i.test(recommendations[0].reason), false);
});

test('right pane selection prioritizes setup and active preview over task panels', () => {
  const model = buildInitialWorkbench();

  assert.equal(
    selectRightPaneMode({
      providerSetupRequired: true,
      setupRequested: true,
      activePreview: null,
      viewMode: 'map',
      hasGraphContext: false,
      advancedMapRequested: false,
      startRequested: false,
      taskPanel: 'memory',
      safetyRedirectActive: false,
    }),
    'setup',
  );
  assert.equal(
    selectRightPaneMode({
      providerSetupRequired: false,
      setupRequested: false,
      activePreview: model.activePreview,
      viewMode: 'map',
      hasGraphContext: true,
      advancedMapRequested: true,
      startRequested: false,
      taskPanel: 'support',
      safetyRedirectActive: false,
    }),
    'preview',
  );
  assert.equal(
    selectRightPaneMode({
      providerSetupRequired: false,
      setupRequested: false,
      activePreview: null,
      viewMode: 'map',
      hasGraphContext: true,
      advancedMapRequested: false,
      startRequested: false,
      taskPanel: null,
      safetyRedirectActive: false,
    }),
    'canvas',
  );
});

test('right pane selection honors explicit start, advanced map, and task panel requests', () => {
  assert.equal(
    selectRightPaneMode({
      providerSetupRequired: false,
      setupRequested: false,
      activePreview: null,
      viewMode: 'map',
      hasGraphContext: true,
      advancedMapRequested: false,
      startRequested: true,
      taskPanel: null,
      safetyRedirectActive: false,
    }),
    'start',
  );
  assert.equal(
    selectRightPaneMode({
      providerSetupRequired: false,
      setupRequested: false,
      activePreview: null,
      viewMode: 'map',
      hasGraphContext: true,
      advancedMapRequested: true,
      startRequested: false,
      taskPanel: null,
      safetyRedirectActive: false,
    }),
    'advanced_map',
  );
  assert.equal(
    selectRightPaneMode({
      providerSetupRequired: false,
      setupRequested: false,
      activePreview: null,
      viewMode: 'map',
      hasGraphContext: true,
      advancedMapRequested: false,
      startRequested: false,
      taskPanel: 'memory',
      safetyRedirectActive: false,
    }),
    'task_panel',
  );
});

test('maps workbench nodes and edges into React Flow elements', () => {
  const model = buildInitialWorkbench();
  const elements = reactFlowElementsFromWorkbench(model, { width: 1000, height: 800 });

  assert.equal(elements.nodes[0].id, 'task-1');
  assert.equal(elements.nodes[0].selected, true);
  assert.deepEqual(elements.nodes[0].position, { x: 430, y: 336 });
  assert.equal(elements.nodes[0].data.kind, 'task');
  assert.equal(elements.nodes.at(-1).id, 'draft-next-2');
  assert.equal(elements.nodes.at(-1).data.status, 'Draft');
  assert.deepEqual(elements.edges, [
    {
      id: 'draft-edge-1',
      source: 'task-1',
      target: 'draft-next-2',
      label: 'breaks down to',
      animated: true,
      data: { kind: 'breaks_down_to' },
    },
  ]);
});

test('converts React Flow drag positions back to bounded canvas percentages', () => {
  assert.deepEqual(percentFromReactFlowPosition({ x: 250, y: 120 }, { width: 500, height: 400 }), {
    x: 50,
    y: 30,
  });
  assert.deepEqual(percentFromReactFlowPosition({ x: 720, y: -24 }, { width: 500, height: 400 }), {
    x: 100,
    y: 0,
  });
  assert.deepEqual(percentFromReactFlowPosition({ x: 50, y: 50 }, { width: 0, height: 0 }), {
    x: 50,
    y: 50,
  });
});

test('applying preview moves draft nodes into persisted nodes', () => {
  const model = buildInitialWorkbench();
  const next = applyAgentPreview(model);

  assert.equal(next.activePreview, null);
  assert.equal(next.nodes.some((node) => node.id === 'draft-next-2'), true);
});

test('rejecting preview keeps persisted nodes unchanged', () => {
  const model = buildInitialWorkbench();
  const next = rejectActivePreview(model);

  assert.equal(next.activePreview, null);
  assert.deepEqual(next.nodes, model.nodes);
});

test('resolves workbench keyboard shortcuts', () => {
  assert.equal(resolveWorkbenchShortcut({ key: 'k', ctrlKey: true }), 'focus-capture');
  assert.equal(resolveWorkbenchShortcut({ key: 'S', metaKey: true }), 'save-selected-node');
  assert.equal(resolveWorkbenchShortcut({ key: 'Enter', ctrlKey: true }), 'start-mode');
  assert.equal(resolveWorkbenchShortcut({ key: 'Enter', ctrlKey: true, shiftKey: true }), null);
  assert.equal(resolveWorkbenchShortcut({ key: 'k' }), null);
});
