import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockCommandClient } from '../../shared/api/commandClient';
import {
  acceptActivePreview,
  acceptPreferenceMemoryProposal,
  acceptStrategyExperimentProposal,
  acceptVaultImportPreview,
  addConnectedNode,
  adoptSupportTemplate,
  connectExistingNodes,
  createCheckIn,
  createFocusTask,
  draftStrategyExperiment,
  initializeWorkbench,
  moveNode,
  previewVaultImport,
  saveLlmSettings,
  saveOnboardingProfile,
  startAttentionSession,
  closeAttentionSession,
  submitAgentMessage,
  testLlmSettings,
} from './workbenchController';
import { buildStartModeView, enterStartMode } from './workbenchModel';

test('mvp smoke flow covers setup, capture, preview, map editing, support, start mode, memory, and vault import', async () => {
  const client = createMockCommandClient();
  let state = await initializeWorkbench(client);

  state = await saveOnboardingProfile(
    client,
    state,
    ['work'],
    ['task initiation'],
    ['task_structure'],
  );
  state = await testLlmSettings(client, state, 'http://localhost:11434/v1', 'local-key', 'llama3.2', 30);
  state = await saveLlmSettings(client, state, 'http://localhost:11434/v1', 'local-key', 'llama3.2', 30);
  assert.equal(state.contextProfile.llmProviderSetupState, 'configured');

  state = await createFocusTask(client, state, 'Prepare weekly launch note');
  assert.equal(state.workbench.focusTaskTitle, 'Plan launch notes');
  assert.equal(state.workbench.nodes.some((node) => node.title === 'Prepare weekly launch note'), true);

  state = await submitAgentMessage(client, state, 'Break this into one visible next action.');
  assert.equal(state.workbench.activePreview?.id, 'preview-1');
  assert.equal(state.workbench.nodes.some((node) => node.id === 'draft-next-2'), false);

  state = await acceptActivePreview(client, state);
  assert.equal(state.workbench.activePreview, null);
  assert.equal(state.workbench.nodes.some((node) => node.id === 'draft-next-2'), true);

  state = await addConnectedNode(client, state, 'blocker', 'Missing source notes');
  const blocker = state.workbench.nodes.find((node) => node.title === 'Missing source notes');
  assert.equal(blocker?.kind, 'blocker');

  state = await connectExistingNodes(client, state, 'task-1', 'next-1', 'breaks_down_to');
  assert.equal(state.workbench.edges.some((edge) => edge.kind === 'breaks_down_to'), true);

  state = await moveNode(client, state, 'next-1', 73, 18);
  assert.deepEqual((await client.mapGet(state.workspaceId)).nodes.find((node) => node.id === 'next-1')?.position, {
    x: 73,
    y: 18,
  });

  state = await adoptSupportTemplate(client, state, 'visible-checklist');
  const support = state.workbench.nodes.find((node) => node.kind === 'support');
  assert.equal(support?.title, 'Visible short checklist');

  state = draftStrategyExperiment(state, {
    supportTemplateId: 'visible-checklist',
    customSupportTitle: null,
    context: 'work',
    helpedStart: true,
    helpedContinue: false,
    helpedReturn: true,
    helpedClarifyNextAction: true,
    obstacleNote: 'Checklist helped after reopening the draft.',
    nextDecision: 'keep',
  });
  assert.equal(state.pendingStrategyExperiments.length, 1);
  state = await acceptStrategyExperimentProposal(client, state, state.pendingStrategyExperiments[0].id);
  assert.equal(state.strategyExperiments.length, 1);

  state = {
    ...state,
    workbench: enterStartMode(state.workbench),
  };
  const startMode = buildStartModeView(state.workbench);
  assert.equal(state.workbench.viewMode, 'start');
  assert.equal(startMode.nextAction.length > 0, true);
  assert.equal(startMode.checks.some((check) => check.includes('Five-minute')), true);

  state = await startAttentionSession(client, state, '2026-05-17T00:00:00Z');
  assert.equal(state.attentionSession?.state, 'active');
  state = await closeAttentionSession(client, state, '2026-05-17T00:05:00Z', 'Stopped after one rough bullet.');
  assert.equal(state.attentionSession, null);

  state = await createCheckIn(client, state, 'Five-minute starts make it easier to return.');
  assert.equal(state.checkIns.length, 1);
  assert.equal(state.pendingMemoryProposals.length, 1);
  state = await acceptPreferenceMemoryProposal(
    client,
    state,
    state.pendingMemoryProposals[0].id,
    'Prefer five-minute starts when returning after interruption.',
  );
  assert.equal(state.preferenceMemory.length, 1);

  state = previewVaultImport(state, [{ filename: 'Imported.md', content: '# Imported\nKeep this reference nearby.' }]);
  assert.equal(state.pendingVaultImport?.fileCount, 1);
  state = await acceptVaultImportPreview(client, state);
  assert.equal(state.pendingVaultImport, null);
  assert.equal(state.workbench.nodes.some((node) => node.title === 'Imported'), true);

  const combinedAgentCopy = state.workbench.messages.map((message) => message.body).join('\n');
  assert.doesNotMatch(combinedAgentCopy, /score|streak|shame|symptom score|treatment|medication/i);
});
