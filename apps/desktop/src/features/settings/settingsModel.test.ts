import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSettingsSections, isFirstRunSetupComplete } from './settingsModel';

const incompleteProfile = {
  id: 'context-profile-1',
  workspaceId: 'workspace-1',
  adultContexts: [],
  executionDifficulties: [],
  preferredSupportCategories: [],
  llmProviderSetupState: 'not_configured',
};

const configuredProfile = {
  ...incompleteProfile,
  adultContexts: ['work'],
  executionDifficulties: ['task initiation'],
  preferredSupportCategories: ['task_structure'],
  llmProviderSetupState: 'configured',
};

test('settings sections group provider, local profile, safety, and interface setup', () => {
  const sections = buildSettingsSections(incompleteProfile);

  assert.deepEqual(
    sections.map((section) => section.id),
    ['agent-provider', 'local-profile', 'safety-boundary', 'interface'],
  );
  assert.equal(sections[0].status, 'needs_setup');
  assert.equal(sections[1].status, 'needs_setup');
  assert.equal(sections[2].status, 'always_on');
  assert.equal(sections[3].status, 'ready');
});

test('first-run setup is complete only after provider and local profile are ready', () => {
  assert.equal(isFirstRunSetupComplete(incompleteProfile), false);
  assert.equal(isFirstRunSetupComplete({ ...configuredProfile, llmProviderSetupState: 'not_configured' }), false);
  assert.equal(isFirstRunSetupComplete({ ...configuredProfile, adultContexts: [] }), false);
  assert.equal(isFirstRunSetupComplete(configuredProfile), true);
});
