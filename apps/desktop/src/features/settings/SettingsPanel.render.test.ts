import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildSettingsSections } from './settingsModel';
import { SettingsPanel } from './SettingsPanel';

const profile = {
  id: 'context-profile-1',
  workspaceId: 'workspace-1',
  adultContexts: [],
  executionDifficulties: [],
  preferredSupportCategories: [],
  llmProviderSetupState: 'not_configured',
};

test('settings panel renders provider, profile, safety, and interface groups', async () => {
  const html = renderToStaticMarkup(
    React.createElement(SettingsPanel, {
      adultContextOptions: ['work', 'study'],
      executionDifficultyOptions: ['task initiation', 'return after interruption'],
      isLlmSaving: false,
      isLlmTesting: false,
      isOnboardingSaving: false,
      llmApiKey: '',
      llmBaseUrl: 'http://localhost:11434/v1',
      llmModel: '',
      llmTimeoutSeconds: 30,
      onboardingContexts: [],
      onboardingDifficulties: [],
      onboardingSupportCategories: [],
      onLlmApiKeyChange: () => {},
      onLlmBaseUrlChange: () => {},
      onLlmModelChange: () => {},
      onLlmTimeoutSecondsChange: () => {},
      onOnboardingContextsChange: () => {},
      onOnboardingDifficultiesChange: () => {},
      onOnboardingSupportCategoriesChange: () => {},
      onTestLlmSettings: () => {},
      onSaveLlmSettings: () => {},
      onSaveOnboardingProfile: () => {},
      onThemePreferenceChange: () => {},
      profile,
      settingsSections: buildSettingsSections(profile),
      supportCategoryOptions: [{ value: 'task_structure', label: 'Task structure' }],
      themeOptions: [
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      themePreference: 'system',
    }),
  );

  assert.match(html, /Agent setup and local preferences/);
  assert.match(html, /Required LLM connection/);
  assert.match(html, /Test connection/);
  assert.match(html, /Support matching defaults/);
  assert.match(html, /Low-risk execution support/);
  assert.match(html, /No diagnosis, treatment, medication guidance, symptom scoring/);
  assert.match(html, /Theme preference/);
});
