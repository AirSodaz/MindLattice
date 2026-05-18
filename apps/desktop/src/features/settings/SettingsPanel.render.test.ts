import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildSettingsSections } from './settingsModel';
import { SettingsPanel } from './SettingsPanel';
import { llmProviderPresets, apiModeOptions } from './llmProviderRegistry';
import { changeLanguagePreference } from '../../shared/i18n/i18n';

const profile = {
  id: 'context-profile-1',
  workspaceId: 'workspace-1',
  adultContexts: [],
  executionDifficulties: [],
  preferredSupportCategories: [],
  llmProviderSetupState: 'not_configured',
};

test('settings panel renders provider, profile, safety, and interface groups', async () => {
  await changeLanguagePreference('en');

  const html = renderToStaticMarkup(
    React.createElement(SettingsPanel, {
      adultContextOptions: ['work', 'study'],
      executionDifficultyOptions: ['task initiation', 'return after interruption'],
      isLlmSaving: false,
      isLlmTesting: false,
      isOnboardingSaving: false,
      canSaveLlmSettings: false,
      llmApiKey: '',
      llmApiMode: 'openai_chat_completions',
      llmBaseUrl: 'http://localhost:11434/v1',
      llmModel: '',
      llmProviderId: 'ollama_local',
      llmTimeoutSeconds: 30,
      languageOptions: [
        { value: 'system', label: 'System' },
        { value: 'en', label: 'English' },
        { value: 'zh-CN', label: '简体中文' },
      ],
      languagePreference: 'system',
      llmApiModeOptions: apiModeOptions,
      llmProviderPresets,
      onboardingContexts: [],
      onboardingDifficulties: [],
      onboardingSupportCategories: [],
      onLlmApiKeyChange: () => {},
      onLlmApiModeChange: () => {},
      onLlmBaseUrlChange: () => {},
      onLlmModelChange: () => {},
      onLlmProviderPresetChange: () => {},
      onLlmTimeoutSecondsChange: () => {},
      onLanguagePreferenceChange: () => {},
      onOnboardingContextsChange: () => {},
      onOnboardingDifficultiesChange: () => {},
      onOnboardingSupportCategoriesChange: () => {},
      onTestLlmSettings: () => {},
      onSaveLlmSettings: () => {},
      onSaveOnboardingProfile: () => {},
      onThemePreferenceChange: () => {},
      profile,
      saveLlmBlockedReason: 'Test connection with these exact settings before saving.',
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
  assert.match(html, /Provider preset/);
  assert.match(html, /API mode/);
  assert.match(html, /Test connection/);
  assert.match(html, /Testing checks this draft only/);
  assert.match(html, /Test connection with these exact settings/);
  assert.match(html, /Support matching defaults/);
  assert.match(html, /Low-risk execution support/);
  assert.match(html, /No diagnosis, treatment, medication guidance, symptom scoring/);
  assert.match(html, /Theme preference/);
  assert.match(html, /Language preference/);
  assert.match(html, /class="[^"]*ml-surface[^"]*settings-surface/);
  assert.match(html, /class="[^"]*ml-field/);
  assert.match(html, /class="[^"]*ml-notice[^"]*ml-notice-warning/);
  assert.match(html, /class="[^"]*ml-button[^"]*ml-button-primary/);
});
