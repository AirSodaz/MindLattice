import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockCommandClient } from '../../shared/api/commandClient';
import {
  acceptActivePreview,
  adoptSupportTemplate,
  addConnectedNode,
  connectExistingNodes,
  createCustomSupportNode,
  createFocusTask,
  initializeWorkbench,
  moveNode,
  rejectActivePreview,
  recordStrategyExperiment,
  saveSelectedNodeDetails,
  discardSupportNode,
  updateSupportNode,
  closeAttentionSession,
  createCheckIn,
  startAttentionSession,
  deletePreferenceMemory,
  updatePreferenceMemory,
  acceptPreferenceMemoryProposal,
  acceptAllPreferenceMemoryProposals,
  rejectPreferenceMemoryProposal,
  rejectAllPreferenceMemoryProposals,
  draftStrategyExperiment,
  acceptStrategyExperimentProposal,
  rejectStrategyExperimentProposal,
  previewVaultImport,
  acceptVaultImportPreview,
  rejectVaultImportPreview,
  saveCustomSupportTemplate,
  saveLlmSettings,
  saveOnboardingProfile,
  testLlmSettings,
  reviseActivePreview,
  requestSmallerStartAction,
  submitAgentMessage,
} from './workbenchController';

test('initializes workbench from the command map without a pre-saved preview', async () => {
  const baseClient = createMockCommandClient();
  const client = {
    ...baseClient,
    async agentMemoryList(workspaceId) {
      assert.equal(workspaceId, 'default-workspace');
      return [
        {
          id: 'memory-1',
          proposedMemoryText: 'Prefer no more than three next actions.',
          evidenceReference: 'check-in-1',
        },
      ];
    },
  };

  const state = await initializeWorkbench(client);

  assert.equal(state.workspaceId, 'default-workspace');
  assert.deepEqual(state.preferenceMemory, [
    {
      id: 'memory-1',
      proposedMemoryText: 'Prefer no more than three next actions.',
      evidenceReference: 'check-in-1',
    },
  ]);
  assert.equal(state.workbench.focusTaskTitle, 'Plan launch notes');
  assert.equal(state.workbench.nodes.length, 2);
  assert.equal(state.workbench.activePreview, null);
  assert.equal(state.supportTemplates.some((template) => template.id === 'visible-checklist'), true);
  assert.equal(state.workbench.startPlan.nextAction, 'Open the draft and write three bullets');
  assert.equal(state.workbench.startPlan.minimumDone, 'Three rough bullets exist.');
  assert.deepEqual(state.workbench.startPlan.checks, [
    'Materials ready',
    'No distraction named',
    'Five-minute fit',
    'Return to: Open the draft and write three bullets',
  ]);
});

test('initializes app settings for interface preferences and saved LLM settings', async () => {
  const client = createMockCommandClient();
  await client.settingsUpdateInterface('dark', 'zh-CN');
  await client.settingsUpdateLlm(
    'google_gemini',
    'gemini_generate_content',
    'https://generativelanguage.googleapis.com/v1beta',
    'gemini-key',
    'gemini-2.5-flash',
    30,
  );

  const state = await initializeWorkbench(client);

  assert.deepEqual(state.appSettings, {
    llmSettings: {
      providerId: 'google_gemini',
      apiMode: 'gemini_generate_content',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'gemini-key',
      model: 'gemini-2.5-flash',
      timeoutSeconds: 30,
    },
    themePreference: 'dark',
    languagePreference: 'zh-CN',
    interfacePreferencesSaved: true,
  });
});

test('initializes visible check-in history from persisted command state', async () => {
  const client = createMockCommandClient();
  await client.checkInCreate('default-workspace', 'next-1', 'Started with the source outline.');
  await client.checkInCreate('default-workspace', null, 'Return by reopening the draft.');

  const state = await initializeWorkbench(client);

  assert.deepEqual(state.checkIns, [
    {
      id: 'check-in-1',
      workspaceId: 'default-workspace',
      nodeId: 'next-1',
      body: 'Started with the source outline.',
    },
    {
      id: 'check-in-2',
      workspaceId: 'default-workspace',
      nodeId: null,
      body: 'Return by reopening the draft.',
    },
  ]);
});

test('initializes first-run LLM setup state from the context profile', async () => {
  const baseClient = createMockCommandClient();
  const client = {
    ...baseClient,
    async contextProfileGet(workspaceId) {
      const profile = await baseClient.contextProfileGet(workspaceId);
      return {
        ...profile,
        adultContexts: ['work'],
        executionDifficulties: ['task initiation'],
        preferredSupportCategories: ['task_structure'],
        llmProviderSetupState: 'not_configured',
      };
    },
  };

  const state = await initializeWorkbench(client);

  assert.equal(state.contextProfile.llmProviderSetupState, 'not_configured');
  assert.deepEqual(state.contextProfile.adultContexts, ['work']);
  assert.deepEqual(state.contextProfile.executionDifficulties, ['task initiation']);
});

test('composer is blocked before LLM setup without creating fallback tasks', async () => {
  const baseClient = createMockCommandClient();
  let submittedMessage = null;
  let createdTitle = null;
  const client = {
    ...baseClient,
    async nodeCreate(workspaceId, kind, title) {
      createdTitle = title;
      return baseClient.nodeCreate(workspaceId, kind, title);
    },
    async agentTurnSubmit(workspaceId, selectedNodeId, message) {
      submittedMessage = { workspaceId, selectedNodeId, message };
      return baseClient.agentTurnSubmit(workspaceId, selectedNodeId, message);
    },
  };
  const initialState = await initializeWorkbench(client);

  const nextState = await submitAgentMessage(client, initialState, 'Plan the draft intro.');

  assert.equal(submittedMessage, null);
  assert.equal(createdTitle, null);
  assert.equal(nextState.workbench.activePreview, null);
  assert.equal(nextState.lastError?.message, 'Configure LLM to use the execution agent.');
  assert.equal(nextState.workbench.nodes.some((node) => node.title === 'Plan the draft intro.'), false);
  assert.equal(nextState.workbench.messages.at(-1).body, 'Configure LLM to use the execution agent.');
});

test('testing LLM settings records test status without saving or unlocking the agent', async () => {
  const baseClient = createMockCommandClient();
  let savedSettings = null;
  const client = {
    ...baseClient,
    async settingsUpdateLlm(providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds) {
      savedSettings = await baseClient.settingsUpdateLlm(providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds);
      return savedSettings;
    },
  };
  const initialState = await initializeWorkbench(client);

  const testedState = await testLlmSettings(
    client,
    initialState,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'llama3.2',
    30,
  );
  const blockedState = await submitAgentMessage(client, testedState, 'Break this down.');

  assert.equal(savedSettings, null);
  assert.deepEqual(testedState.providerTestResult, {
    status: 'ok',
    model: 'llama3.2',
    message: 'Connection test succeeded.',
  });
  assert.equal(testedState.contextProfile.llmProviderSetupState, 'not_configured');
  assert.equal(blockedState.workbench.activePreview, null);
  assert.equal(blockedState.lastError?.message, 'Configure LLM to use the execution agent.');
});

test('saving LLM settings requires a successful matching provider test first', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const untestedState = await saveLlmSettings(
    client,
    initialState,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'llama3.2',
    30,
  );

  assert.equal(untestedState.contextProfile.llmProviderSetupState, 'not_configured');
  assert.equal(untestedState.lastError?.message, 'Test the LLM connection before saving.');

  const testedState = await testLlmSettings(
    client,
    initialState,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'llama3.2',
    30,
  );
  const changedModelState = await saveLlmSettings(
    client,
    testedState,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'different-model',
    30,
  );

  assert.equal(changedModelState.contextProfile.llmProviderSetupState, 'not_configured');
  assert.equal(changedModelState.lastError?.message, 'Test the current LLM settings before saving.');
});

test('saving LLM settings marks the profile configured and enables agent turns', async () => {
  const baseClient = createMockCommandClient();
  let savedSettings = null;
  let savedProfile = null;
  const client = {
    ...baseClient,
    async settingsUpdateLlm(providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds) {
      savedSettings = await baseClient.settingsUpdateLlm(providerId, apiMode, baseUrl, apiKey, model, timeoutSeconds);
      return savedSettings;
    },
    async contextProfileUpdate(profile) {
      savedProfile = await baseClient.contextProfileUpdate(profile);
      return savedProfile;
    },
  };
  const initialState = await initializeWorkbench(client);

  const testedState = await testLlmSettings(
    client,
    initialState,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'llama3.2',
    30,
  );
  const configuredState = await saveLlmSettings(
    client,
    testedState,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'llama3.2',
    30,
  );
  const nextState = await submitAgentMessage(client, configuredState, 'Break this down.');

  assert.deepEqual(savedSettings, {
    providerId: 'ollama_local',
    apiMode: 'openai_chat_completions',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'local-key',
    model: 'llama3.2',
    timeoutSeconds: 30,
  });
  assert.equal(savedProfile.llmProviderSetupState, 'configured');
  assert.equal(configuredState.contextProfile.llmProviderSetupState, 'configured');
  assert.equal(configuredState.workbench.messages.at(-1).body, 'LLM provider configured for local review.');
  assert.equal(nextState.workbench.activePreview.id, 'preview-1');
  assert.equal(nextState.lastError, null);
});

test('saving onboarding profile updates adult contexts without clinical language', async () => {
  const baseClient = createMockCommandClient();
  let savedProfile = null;
  const client = {
    ...baseClient,
    async contextProfileUpdate(profile) {
      savedProfile = await baseClient.contextProfileUpdate(profile);
      return savedProfile;
    },
  };
  const initialState = await initializeWorkbench(client);

  const updatedState = await saveOnboardingProfile(
    client,
    initialState,
    ['work', 'personal project', ''],
    ['task initiation', 'return after interruption'],
    ['task_structure', 'external_memory'],
  );

  assert.deepEqual(savedProfile.adultContexts, ['work', 'personal project']);
  assert.deepEqual(savedProfile.executionDifficulties, ['task initiation', 'return after interruption']);
  assert.deepEqual(savedProfile.preferredSupportCategories, ['task_structure', 'external_memory']);
  assert.equal(updatedState.contextProfile.llmProviderSetupState, 'not_configured');
  assert.equal(updatedState.workbench.messages.at(-1).body, 'Onboarding preferences saved for local support matching.');
});

test('submitting an agent message appends the thread response and exposes a pending preview', async () => {
  const client = createMockCommandClient();
  const initialState = await markLlmConfigured(client, await initializeWorkbench(client));

  const nextState = await submitAgentMessage(client, initialState, 'Make the next action smaller.');

  assert.equal(nextState.workbench.messages.at(-2).sender, 'user');
  assert.equal(nextState.workbench.messages.at(-2).body, 'Make the next action smaller.');
  assert.equal(nextState.workbench.messages.at(-1).sender, 'agent');
  assert.equal(nextState.workbench.activePreview.id, 'preview-1');
  assert.equal(nextState.workbench.nodes.some((node) => node.id === 'draft-next-2'), false);
});

test('submitting an agent follow-up routes non-graph preview proposals into review queues', async () => {
  const baseClient = createMockCommandClient();
  let persistedMemory = null;
  let persistedExperiment = null;
  const client = {
    ...baseClient,
    async agentTurnSubmit(workspaceId, selectedNodeId, message) {
      assert.equal(workspaceId, 'default-workspace');
      assert.equal(selectedNodeId, 'task-1');
      assert.equal(message, 'This return cue helped me restart.');
      return {
        kind: 'PreviewProposed',
        message: 'Review one memory and one strategy experiment before saving.',
        preview: followUpReviewPreview(),
      };
    },
    async agentMemoryUpdate(workspaceId, memory) {
      persistedMemory = await baseClient.agentMemoryUpdate(workspaceId, memory);
      return persistedMemory;
    },
    async strategyExperimentCreate(experiment) {
      persistedExperiment = await baseClient.strategyExperimentCreate(experiment);
      return persistedExperiment;
    },
  };
  const initialState = await markLlmConfigured(client, await initializeWorkbench(client));

  const nextState = await submitAgentMessage(client, initialState, 'This return cue helped me restart.');

  assert.equal(nextState.workbench.activePreview, null);
  assert.deepEqual(nextState.pendingMemoryProposals, [
    {
      id: 'memory-from-agent-1',
      proposedMemoryText: 'Prefer visible return cues after interruptions.',
      evidenceReference: 'check-in-1',
    },
  ]);
  assert.deepEqual(nextState.pendingStrategyExperiments, [
    {
      id: 'strategy-from-agent-1',
      supportTemplateId: 'return-cue',
      customSupportTitle: null,
      context: 'work',
      helpedStart: true,
      helpedContinue: false,
      helpedReturn: true,
      helpedClarifyNextAction: true,
      obstacleNote: 'The return cue helped reopen the draft.',
      nextDecision: 'keep',
    },
  ]);
  assert.deepEqual(nextState.preferenceMemory, []);
  assert.deepEqual(nextState.strategyExperiments, []);
  assert.equal(persistedMemory, null);
  assert.equal(persistedExperiment, null);
  assert.equal(nextState.workbench.messages.at(-1).body, 'Review one memory and one strategy experiment before saving.');
});

test('revising an active preview routes non-graph follow-up proposals into review queues', async () => {
  const baseClient = createMockCommandClient();
  const client = {
    ...baseClient,
    async agentPreviewRevise(workspaceId, previewId, message) {
      assert.equal(workspaceId, 'default-workspace');
      assert.equal(previewId, 'preview-1');
      assert.equal(message, 'Keep the learning, not the map change.');
      return {
        kind: 'PreviewProposed',
        message: 'Review the follow-up proposals before saving.',
        preview: followUpReviewPreview(),
      };
    },
  };
  const submittedState = await submitAgentMessage(
    client,
    await markLlmConfigured(client, await initializeWorkbench(client)),
    'Make this startable.',
  );

  const revisedState = await reviseActivePreview(client, submittedState, 'Keep the learning, not the map change.');

  assert.equal(revisedState.workbench.activePreview, null);
  assert.deepEqual(revisedState.pendingMemoryProposals.map((proposal) => proposal.id), ['memory-from-agent-1']);
  assert.deepEqual(revisedState.pendingStrategyExperiments.map((proposal) => proposal.id), ['strategy-from-agent-1']);
  assert.deepEqual(
    revisedState.workbench.nodes.map((node) => node.id),
    ['task-1', 'next-1'],
  );
});

test('submitting a mixed graph preview keeps non-graph proposals with the active preview', async () => {
  const baseClient = createMockCommandClient();
  const client = {
    ...baseClient,
    async agentTurnSubmit() {
      return {
        kind: 'PreviewProposed',
        message: 'Review the map preview before saving.',
        preview: mixedGraphAndReviewPreview(),
      };
    },
  };
  const initialState = await markLlmConfigured(client, await initializeWorkbench(client));

  const nextState = await submitAgentMessage(client, initialState, 'Add a smaller step and remember the cue.');

  assert.equal(nextState.workbench.activePreview.id, 'preview-mixed-1');
  assert.deepEqual(nextState.workbench.activePreview.proposedMemory.map((proposal) => proposal.id), [
    'memory-from-agent-1',
  ]);
  assert.deepEqual(nextState.workbench.activePreview.proposedStrategyExperiments.map((proposal) => proposal.id), [
    'strategy-from-agent-1',
  ]);
  assert.deepEqual(nextState.pendingMemoryProposals, []);
  assert.deepEqual(nextState.pendingStrategyExperiments, []);
});

test('accepting a preview persists the proposed node and clears preview state', async () => {
  const client = createMockCommandClient();
  const submittedState = await submitAgentMessage(
    client,
    await markLlmConfigured(client, await initializeWorkbench(client)),
    'Make this startable.',
  );

  const acceptedState = await acceptActivePreview(client, submittedState);

  assert.equal(acceptedState.workbench.activePreview, null);
  assert.equal(acceptedState.workbench.nodes.some((node) => node.id === 'draft-next-2'), true);
});

test('rejecting a preview clears preview state and leaves persisted nodes unchanged', async () => {
  const client = createMockCommandClient();
  const submittedState = await submitAgentMessage(
    client,
    await markLlmConfigured(client, await initializeWorkbench(client)),
    'Make this startable.',
  );

  const rejectedState = await rejectActivePreview(client, submittedState);

  assert.equal(rejectedState.workbench.activePreview, null);
  assert.deepEqual(
    rejectedState.workbench.nodes.map((node) => node.id),
    ['task-1', 'next-1'],
  );
});

test('revising an active preview keeps it pending and leaves persisted nodes unchanged', async () => {
  const client = createMockCommandClient();
  const submittedState = await submitAgentMessage(
    client,
    await markLlmConfigured(client, await initializeWorkbench(client)),
    'Make this startable.',
  );

  const revisedState = await reviseActivePreview(client, submittedState, 'Only keep one tiny step');

  assert.equal(revisedState.workbench.messages.at(-2).sender, 'user');
  assert.equal(revisedState.workbench.messages.at(-2).body, 'Only keep one tiny step');
  assert.equal(revisedState.workbench.messages.at(-1).sender, 'agent');
  assert.equal(revisedState.workbench.activePreview.id, 'preview-2');
  assert.equal(revisedState.workbench.activePreview.proposedNodes[0].title, 'Write one rough bullet');
  assert.deepEqual(
    revisedState.workbench.nodes.map((node) => node.id),
    ['task-1', 'next-1'],
  );
});

test('requesting a smaller Start Mode action returns an active preview before saving', async () => {
  const baseClient = createMockCommandClient();
  let revisionMessage = null;
  const client = {
    ...baseClient,
    async agentTurnSubmit(workspaceId, selectedNodeId, message) {
      revisionMessage = { workspaceId, selectedNodeId, message };
      return baseClient.agentTurnSubmit(workspaceId, selectedNodeId, message);
    },
  };
  const initialState = await markLlmConfigured(client, await initializeWorkbench(client));

  const nextState = await requestSmallerStartAction(client, initialState);

  assert.deepEqual(revisionMessage, {
    workspaceId: 'default-workspace',
    selectedNodeId: 'next-1',
    message: 'Make the current Start Mode action smaller and keep it as a preview.',
  });
  assert.equal(nextState.workbench.activePreview.id, 'preview-1');
  assert.deepEqual(
    nextState.workbench.nodes.map((node) => node.id),
    ['task-1', 'next-1'],
  );
});

test('adopting a support template persists a support node and selects it', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const adoptedState = await adoptSupportTemplate(client, initialState, 'visible-checklist');
  const adoptedNode = adoptedState.workbench.nodes.find((node) => node.kind === 'support');

  assert.equal(adoptedNode?.title, 'Visible short checklist');
  assert.equal(adoptedState.workbench.selectedNodeId, adoptedNode?.id);
  assert.equal(adoptedState.workbench.messages.at(-1).sender, 'agent');
  assert.equal(adoptedState.workbench.messages.at(-1).body, 'Support adopted: Visible short checklist.');
  assert.equal(adoptedState.supportTemplates.length, initialState.supportTemplates.length);
});

test('editing an adopted support updates the support node through the command client', async () => {
  const client = createMockCommandClient();
  const adoptedState = await adoptSupportTemplate(client, await initializeWorkbench(client), 'visible-checklist');
  const supportNode = adoptedState.workbench.nodes.find((node) => node.kind === 'support');

  const editedState = await updateSupportNode(
    client,
    adoptedState,
    supportNode.id,
    'Two-step visible checklist',
    'Keep only two steps and stop at the minimum-done line.',
  );
  const editedSupport = editedState.workbench.nodes.find((node) => node.id === supportNode.id);
  const persisted = await client.mapGet(adoptedState.workspaceId);

  assert.equal(editedSupport?.title, 'Two-step visible checklist');
  assert.equal(persisted.nodes.find((node) => node.id === supportNode.id)?.body, 'Keep only two steps and stop at the minimum-done line.');
  assert.equal(editedState.workbench.messages.at(-1).body, 'Support updated: Two-step visible checklist.');
});

test('discarding an adopted support removes it from the map without touching templates', async () => {
  const client = createMockCommandClient();
  const adoptedState = await adoptSupportTemplate(client, await initializeWorkbench(client), 'visible-checklist');
  const supportNode = adoptedState.workbench.nodes.find((node) => node.kind === 'support');

  const discardedState = await discardSupportNode(client, adoptedState, supportNode.id);
  const persisted = await client.mapGet(adoptedState.workspaceId);

  assert.equal(discardedState.workbench.nodes.some((node) => node.id === supportNode.id), false);
  assert.equal(persisted.nodes.some((node) => node.id === supportNode.id), false);
  assert.equal(discardedState.supportTemplates.length, adoptedState.supportTemplates.length);
  assert.equal(discardedState.workbench.messages.at(-1).body, 'Support discarded: Visible short checklist.');
});

test('creating a custom support persists an editable support node without adding a template', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const createdState = await createCustomSupportNode(
    client,
    initialState,
    'Desk reset cue',
    'Move the current tab list to one visible note before starting.',
  );
  const customSupport = createdState.workbench.nodes.find((node) => node.title === 'Desk reset cue');
  const persisted = await client.mapGet(initialState.workspaceId);

  assert.equal(customSupport?.kind, 'support');
  assert.equal(customSupport?.body, 'Move the current tab list to one visible note before starting.');
  assert.equal(createdState.workbench.selectedNodeId, customSupport?.id);
  assert.equal(createdState.supportTemplates.length, initialState.supportTemplates.length);
  assert.equal(
    persisted.nodes.find((node) => node.id === customSupport?.id)?.body,
    'Move the current tab list to one visible note before starting.',
  );
  assert.equal(createdState.workbench.messages.at(-1).body, 'Custom support created: Desk reset cue.');
});

test('saving a custom support template adds it to the reusable local template library', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const savedState = saveCustomSupportTemplate(
    initialState,
    'Desk reset cue',
    'Move the current tab list to one visible note before starting.',
  );

  assert.equal(savedState.supportTemplates.length, initialState.supportTemplates.length + 1);
  assert.deepEqual(savedState.supportTemplates.at(-1), {
    id: 'custom-support-template-1',
    category: 'task_structure',
    title: 'Desk reset cue',
    steps: ['Move the current tab list to one visible note before starting.'],
    defaultContexts: ['custom'],
    sourceNote: 'User-created reusable support template.',
    safetyNote: 'Self-help execution support, not treatment advice.',
  });
  assert.equal(savedState.workbench.messages.at(-1).body, 'Custom support template saved: Desk reset cue.');
});

test('saving and creating a custom support can make the support reusable without persisting it twice', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const libraryState = saveCustomSupportTemplate(
    initialState,
    'Desk reset cue',
    'Move the current tab list to one visible note before starting.',
  );
  const createdState = await createCustomSupportNode(
    client,
    libraryState,
    'Desk reset cue',
    'Move the current tab list to one visible note before starting.',
  );
  const adoptedState = await adoptSupportTemplate(client, createdState, 'custom-support-template-1');
  const adoptedSupport = adoptedState.workbench.nodes.find((node) => node.title === 'Desk reset cue');
  const persisted = await client.mapGet(initialState.workspaceId);

  assert.equal(libraryState.workbench.nodes.some((node) => node.title === 'Desk reset cue'), false);
  assert.equal(createdState.supportTemplates.length, initialState.supportTemplates.length + 1);
  assert.equal(adoptedSupport?.kind, 'support');
  assert.equal(persisted.nodes.filter((node) => node.title === 'Desk reset cue').length, 2);
});

test('saving selected node details persists title and body through the command client', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const savedState = await saveSelectedNodeDetails(
    client,
    initialState,
    'Plan launch notes v2',
    'Keep the launch outline rough.',
  );
  const savedNode = savedState.workbench.nodes.find((node) => node.id === initialState.workbench.selectedNodeId);
  const persisted = await client.mapGet(initialState.workspaceId);

  assert.equal(savedNode?.title, 'Plan launch notes v2');
  assert.equal(savedState.workbench.focusTaskTitle, 'Plan launch notes v2');
  assert.equal(savedState.workbench.messages.at(-1).body, 'Saved node: Plan launch notes v2.');
  assert.equal(persisted.nodes.find((node) => node.id === savedNode?.id)?.body, 'Keep the launch outline rough.');
});

test('moving a node persists bounded canvas position and keeps it selected', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const movedState = await moveNode(client, initialState, 'next-1', 118, -12);
  const movedNode = movedState.workbench.nodes.find((node) => node.id === 'next-1');
  const persisted = await client.mapGet(initialState.workspaceId);

  assert.equal(movedNode?.x, 100);
  assert.equal(movedNode?.y, 0);
  assert.equal(movedState.workbench.selectedNodeId, 'next-1');
  assert.deepEqual(persisted.nodes.find((node) => node.id === 'next-1')?.position, { x: 100, y: 0 });
});

test('creating a focus task persists the first task when the map is empty', async () => {
  const baseClient = createMockCommandClient();
  const client = {
    ...baseClient,
    async mapGet(workspaceId) {
      const snapshot = await baseClient.mapGet(workspaceId);
      return {
        ...snapshot,
        nodes: snapshot.nodes.filter((node) => node.id.startsWith('node-')),
        edges: [],
      };
    },
  };
  const initialState = await initializeWorkbench(client);

  const createdState = await createFocusTask(client, initialState, 'Plan the first useful draft');

  assert.equal(initialState.workbench.nodes.length, 0);
  assert.equal(createdState.workbench.nodes.length, 1);
  assert.equal(createdState.workbench.nodes[0].kind, 'task');
  assert.equal(createdState.workbench.nodes[0].title, 'Plan the first useful draft');
  assert.equal(createdState.workbench.focusTaskTitle, 'Plan the first useful draft');
  assert.equal(createdState.workbench.selectedNodeId, createdState.workbench.nodes[0].id);
  assert.equal(createdState.workbench.messages.at(-1).body, 'Created focus task: Plan the first useful draft.');
});

test('adding a connected surrounding node persists the node and edge', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const nextState = await addConnectedNode(client, initialState, 'blocker', 'Missing source notes');
  const snapshot = await client.mapGet(initialState.workspaceId);
  const blocker = snapshot.nodes.find((node) => node.title === 'Missing source notes');
  const edge = snapshot.edges.find((item) => item.sourceId === initialState.workbench.selectedNodeId);

  assert.equal(blocker?.kind, 'blocker');
  assert.equal(edge?.targetId, blocker?.id);
  assert.equal(edge?.kind, 'blocked_by');
  assert.equal(nextState.workbench.selectedNodeId, blocker?.id);
  assert.equal(nextState.workbench.nodes.some((node) => node.id === blocker?.id), true);
  assert.equal(nextState.workbench.messages.at(-1).body, 'Added blocker: Missing source notes.');
});

test('connecting existing nodes persists a selected typed edge', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const connectedState = await connectExistingNodes(client, initialState, 'task-1', 'next-1', 'breaks_down_to');

  assert.deepEqual(connectedState.workbench.edges, [
    {
      id: 'edge-1',
      sourceId: 'task-1',
      targetId: 'next-1',
      kind: 'breaks_down_to',
    },
  ]);
  assert.equal(connectedState.workbench.messages.at(-1).body, 'Connected Plan launch notes to Open the draft and write three bullets.');
});

test('starting and closing an attention session updates Start Mode state without scoring', async () => {
  const client = createMockCommandClient();
  const initialState = await initializeWorkbench(client);

  const startedState = await startAttentionSession(client, initialState, '2026-05-17T00:00:00Z');
  const activeSession = startedState.attentionSession;

  assert.equal(activeSession?.state, 'active');
  assert.equal(activeSession?.nextActionId, 'next-1');
  assert.equal(startedState.workbench.messages.at(-1).body, 'Started focus session: Open the draft and write three bullets.');

  const closedState = await closeAttentionSession(
    client,
    startedState,
    '2026-05-17T00:05:00Z',
    'Stopped after one rough paragraph.',
  );

  assert.equal(closedState.attentionSession, null);
  assert.equal(closedState.workbench.messages.at(-1).body, 'Closed focus session: Stopped after one rough paragraph.');
});

test('creating a check-in persists it for the current next action without scoring language', async () => {
  const baseClient = createMockCommandClient();
  let savedCheckIn = null;
  const client = {
    ...baseClient,
    async checkInCreate(workspaceId, nodeId, body) {
      savedCheckIn = await baseClient.checkInCreate(workspaceId, nodeId, body);
      return savedCheckIn;
    },
  };
  const initialState = await initializeWorkbench(client);

  const checkedInState = await createCheckIn(client, initialState, 'I started, then got stuck looking for the source.');

  assert.deepEqual(savedCheckIn, {
    id: 'check-in-1',
    workspaceId: 'default-workspace',
    nodeId: 'next-1',
    body: 'I started, then got stuck looking for the source.',
  });
  assert.deepEqual(checkedInState.checkIns, [savedCheckIn]);
  assert.equal(
    checkedInState.workbench.messages.at(-2).body,
    'Check-in saved: I started, then got stuck looking for the source.',
  );
  assert.equal(
    checkedInState.workbench.messages.at(-1).body,
    'Preference memory proposed for review: I started, then got stuck looking for the source.',
  );
  assert.doesNotMatch(
    checkedInState.workbench.messages.slice(-2).map((message) => message.body).join('\n'),
    /score|streak|fail|failure|shame/i,
  );
});

test('creating a check-in drafts visible preference memory without persisting it', async () => {
  const baseClient = createMockCommandClient();
  let persistedMemory = null;
  const client = {
    ...baseClient,
    async agentMemoryUpdate(workspaceId, memory) {
      persistedMemory = await baseClient.agentMemoryUpdate(workspaceId, memory);
      return persistedMemory;
    },
  };
  const initialState = await initializeWorkbench(client);

  const checkedInState = await createCheckIn(client, initialState, 'Five-minute start plans are easier to use.');

  assert.deepEqual(checkedInState.pendingMemoryProposals, [
    {
      id: 'memory-proposal-check-in-1',
      proposedMemoryText: 'Five-minute start plans are easier to use.',
      evidenceReference: 'check-in-1',
    },
  ]);
  assert.equal(checkedInState.preferenceMemory.length, 0);
  assert.equal(persistedMemory, null);
  assert.equal(
    checkedInState.workbench.messages.at(-1).body,
    'Preference memory proposed for review: Five-minute start plans are easier to use.',
  );
});

test('accepting or rejecting preference-memory proposals requires explicit review', async () => {
  const client = createMockCommandClient();
  const checkedInState = await createCheckIn(
    client,
    await initializeWorkbench(client),
    'Five-minute start plans are easier to use.',
  );

  const acceptedState = await acceptPreferenceMemoryProposal(
    client,
    checkedInState,
    'memory-proposal-check-in-1',
    'Prefer five-minute start plans.',
  );

  assert.deepEqual(acceptedState.pendingMemoryProposals, []);
  assert.deepEqual(acceptedState.preferenceMemory, [
    {
      id: 'memory-proposal-check-in-1',
      proposedMemoryText: 'Prefer five-minute start plans.',
      evidenceReference: 'check-in-1',
    },
  ]);
  assert.equal(acceptedState.workbench.messages.at(-1).body, 'Preference memory accepted: Prefer five-minute start plans.');

  const rejectedState = rejectPreferenceMemoryProposal(checkedInState, 'memory-proposal-check-in-1');

  assert.deepEqual(rejectedState.pendingMemoryProposals, []);
  assert.deepEqual(rejectedState.preferenceMemory, []);
  assert.equal(rejectedState.workbench.messages.at(-1).body, 'Preference memory proposal rejected.');
});

test('batch memory review accepts edited proposals and rejects the rest without silent saves', async () => {
  const baseClient = createMockCommandClient();
  let persistedMemoryCount = 0;
  const client = {
    ...baseClient,
    async agentMemoryUpdate(workspaceId, memory) {
      persistedMemoryCount += 1;
      return baseClient.agentMemoryUpdate(workspaceId, memory);
    },
  };
  const checkedInState = await createCheckIn(
    client,
    await initializeWorkbench(client),
    'Five-minute start plans are easier to use.',
  );
  const withTwoProposals = {
    ...checkedInState,
    pendingMemoryProposals: [
      ...checkedInState.pendingMemoryProposals,
      {
        id: 'memory-proposal-extra',
        proposedMemoryText: 'Prefer a visible return cue.',
        evidenceReference: 'check-in-2',
      },
    ],
  };

  const acceptedState = await acceptAllPreferenceMemoryProposals(client, withTwoProposals, {
    'memory-proposal-check-in-1': 'Prefer five-minute starts.',
    'memory-proposal-extra': 'Prefer visible return cues.',
  });

  assert.equal(persistedMemoryCount, 2);
  assert.deepEqual(acceptedState.pendingMemoryProposals, []);
  assert.deepEqual(
    acceptedState.preferenceMemory.map((memory) => memory.proposedMemoryText),
    ['Prefer five-minute starts.', 'Prefer visible return cues.'],
  );
  assert.equal(acceptedState.workbench.messages.at(-1).body, 'Preference memory review accepted: 2 item(s).');

  const rejectedState = rejectAllPreferenceMemoryProposals(withTwoProposals);

  assert.deepEqual(rejectedState.pendingMemoryProposals, []);
  assert.deepEqual(rejectedState.preferenceMemory, []);
  assert.equal(rejectedState.workbench.messages.at(-1).body, 'Preference memory review rejected: 2 item(s).');
});

test('updating preference memory persists visible edited text', async () => {
  const baseClient = createMockCommandClient();
  await baseClient.agentMemoryUpdate('default-workspace', {
    id: 'memory-1',
    proposedMemoryText: 'Prefer no more than three next actions.',
    evidenceReference: 'check-in-1',
  });
  const initialState = await initializeWorkbench(baseClient);

  const updatedState = await updatePreferenceMemory(
    baseClient,
    initialState,
    'memory-1',
    'Prefer one visible next action when returning after interruption.',
  );

  assert.deepEqual(updatedState.preferenceMemory, [
    {
      id: 'memory-1',
      proposedMemoryText: 'Prefer one visible next action when returning after interruption.',
      evidenceReference: 'check-in-1',
    },
  ]);
  assert.equal(
    updatedState.workbench.messages.at(-1).body,
    'Preference memory updated: Prefer one visible next action when returning after interruption.',
  );
});

test('deleting preference memory removes it from visible review state', async () => {
  const baseClient = createMockCommandClient();
  await baseClient.agentMemoryUpdate('default-workspace', {
    id: 'memory-1',
    proposedMemoryText: 'Prefer no more than three next actions.',
    evidenceReference: 'check-in-1',
  });
  const initialState = await initializeWorkbench(baseClient);

  const deletedState = await deletePreferenceMemory(baseClient, initialState, 'memory-1');

  assert.deepEqual(deletedState.preferenceMemory, []);
  assert.equal(deletedState.workbench.messages.at(-1).body, 'Preference memory removed.');
});

test('recording a strategy experiment persists support feedback without scoring language', async () => {
  const baseClient = createMockCommandClient();
  let savedExperiment = null;
  const client = {
    ...baseClient,
    async strategyExperimentCreate(experiment) {
      savedExperiment = await baseClient.strategyExperimentCreate(experiment);
      return savedExperiment;
    },
  };
  const initialState = await initializeWorkbench(client);

  const experimentState = await recordStrategyExperiment(client, initialState, {
    supportTemplateId: 'visible-checklist',
    customSupportTitle: null,
    context: 'work',
    helpedStart: true,
    helpedContinue: false,
    helpedReturn: true,
    helpedClarifyNextAction: false,
    obstacleNote: 'Checklist helped start, but two items were too vague.',
    nextDecision: 'revise',
  });

  assert.deepEqual(savedExperiment, {
    id: 'strategy-experiment-1',
    supportTemplateId: 'visible-checklist',
    customSupportTitle: null,
    context: 'work',
    helpedStart: true,
    helpedContinue: false,
    helpedReturn: true,
    helpedClarifyNextAction: false,
    obstacleNote: 'Checklist helped start, but two items were too vague.',
    nextDecision: 'revise',
  });
  assert.deepEqual(experimentState.strategyExperiments, [savedExperiment]);
  assert.equal(experimentState.workbench.messages.at(-1).body, 'Strategy experiment recorded: revise visible-checklist.');
  assert.doesNotMatch(experimentState.workbench.messages.at(-1).body, /score|streak|symptom|treatment|clinical/i);
});

test('drafting a strategy experiment requires review before persistence', async () => {
  const baseClient = createMockCommandClient();
  let savedExperiment = null;
  const client = {
    ...baseClient,
    async strategyExperimentCreate(experiment) {
      savedExperiment = await baseClient.strategyExperimentCreate(experiment);
      return savedExperiment;
    },
  };
  const initialState = await initializeWorkbench(client);

  const draftState = draftStrategyExperiment(initialState, {
    supportTemplateId: 'visible-checklist',
    customSupportTitle: null,
    context: 'work',
    helpedStart: true,
    helpedContinue: false,
    helpedReturn: true,
    helpedClarifyNextAction: false,
    obstacleNote: 'Checklist was useful after opening the draft.',
    nextDecision: 'keep',
  });

  assert.deepEqual(draftState.strategyExperiments, []);
  assert.equal(savedExperiment, null);
  assert.deepEqual(draftState.pendingStrategyExperiments, [
    {
      id: 'strategy-experiment-proposal-1',
      supportTemplateId: 'visible-checklist',
      customSupportTitle: null,
      context: 'work',
      helpedStart: true,
      helpedContinue: false,
      helpedReturn: true,
      helpedClarifyNextAction: false,
      obstacleNote: 'Checklist was useful after opening the draft.',
      nextDecision: 'keep',
    },
  ]);
  assert.equal(draftState.workbench.messages.at(-1).body, 'Strategy experiment proposed for review: keep visible-checklist.');

  const acceptedState = await acceptStrategyExperimentProposal(
    client,
    draftState,
    'strategy-experiment-proposal-1',
  );

  assert.deepEqual(acceptedState.pendingStrategyExperiments, []);
  assert.deepEqual(acceptedState.strategyExperiments, [
    {
      id: 'strategy-experiment-proposal-1',
      supportTemplateId: 'visible-checklist',
      customSupportTitle: null,
      context: 'work',
      helpedStart: true,
      helpedContinue: false,
      helpedReturn: true,
      helpedClarifyNextAction: false,
      obstacleNote: 'Checklist was useful after opening the draft.',
      nextDecision: 'keep',
    },
  ]);
  assert.equal(acceptedState.workbench.messages.at(-1).body, 'Strategy experiment accepted: keep visible-checklist.');
  assert.doesNotMatch(acceptedState.workbench.messages.at(-1).body, /score|streak|symptom|treatment|clinical/i);

  const rejectedState = rejectStrategyExperimentProposal(draftState, 'strategy-experiment-proposal-1');

  assert.deepEqual(rejectedState.pendingStrategyExperiments, []);
  assert.deepEqual(rejectedState.strategyExperiments, []);
  assert.equal(rejectedState.workbench.messages.at(-1).body, 'Strategy experiment proposal rejected.');
});

test('vault import preview requires explicit acceptance before importing Markdown files', async () => {
  const baseClient = createMockCommandClient();
  let importedFiles = null;
  const client = {
    ...baseClient,
    async vaultImport(workspaceId, files) {
      importedFiles = files;
      return baseClient.vaultImport(workspaceId, files);
    },
  };
  const initialState = await initializeWorkbench(client);

  const previewState = previewVaultImport(initialState, [
    { filename: 'Imported.md', content: '# Imported\nKeep this reference.' },
  ]);

  assert.equal(importedFiles, null);
  assert.deepEqual(previewState.pendingVaultImport, {
    files: [{ filename: 'Imported.md', content: '# Imported\nKeep this reference.' }],
    fileCount: 1,
    totalBytes: 31,
  });
  assert.equal(previewState.workbench.messages.at(-1).body, 'Vault import preview ready: 1 Markdown file.');

  const acceptedState = await acceptVaultImportPreview(client, previewState);

  assert.deepEqual(importedFiles, [{ filename: 'Imported.md', content: '# Imported\nKeep this reference.' }]);
  assert.equal(acceptedState.pendingVaultImport, null);
  assert.equal(acceptedState.workbench.nodes.some((node) => node.title === 'Imported'), true);
  assert.equal(acceptedState.workbench.messages.at(-1).body, 'Vault import accepted: 1 node and 0 edges imported.');

  const rejectedState = rejectVaultImportPreview(previewState);

  assert.equal(rejectedState.pendingVaultImport, null);
  assert.equal(rejectedState.workbench.messages.at(-1).body, 'Vault import preview rejected.');
});

function followUpReviewPreview() {
  return {
    id: 'preview-follow-up-1',
    proposedNodes: [],
    proposedEdges: [],
    proposedMemory: [
      {
        id: 'memory-from-agent-1',
        proposedMemoryText: 'Prefer visible return cues after interruptions.',
        evidenceReference: 'check-in-1',
      },
    ],
    proposedCheckIns: [],
    proposedStrategyExperiments: [
      {
        id: 'strategy-from-agent-1',
        supportTemplateId: 'return-cue',
        customSupportTitle: null,
        context: 'work',
        helpedStart: true,
        helpedContinue: false,
        helpedReturn: true,
        helpedClarifyNextAction: true,
        obstacleNote: 'The return cue helped reopen the draft.',
        nextDecision: 'keep',
      },
    ],
    userVisibleSummary: 'Review one memory and one strategy experiment before saving.',
  };
}

function mixedGraphAndReviewPreview() {
  return {
    ...followUpReviewPreview(),
    id: 'preview-mixed-1',
    proposedNodes: [
      {
        id: 'draft-next-mixed',
        kind: 'next_action',
        title: 'Write one rough restart sentence',
        body: null,
      },
    ],
    proposedEdges: [{ id: 'draft-edge-mixed', sourceId: 'task-1', targetId: 'draft-next-mixed', kind: 'breaks_down_to' }],
  };
}

async function markLlmConfigured(client, state) {
  const testedState = await testLlmSettings(
    client,
    state,
    'ollama_local',
    'openai_chat_completions',
    'http://localhost:11434/v1',
    'local-key',
    'llama3.2',
    30,
  );
  return saveLlmSettings(client, testedState, 'ollama_local', 'openai_chat_completions', 'http://localhost:11434/v1', 'local-key', 'llama3.2', 30);
}
