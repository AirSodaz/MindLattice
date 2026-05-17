import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAgentPreview,
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
