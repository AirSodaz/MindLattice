import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ProviderSetupPanel } from './ProviderSetupPanel';
import { apiModeOptions, llmProviderPresets } from '../../settings/llmProviderRegistry';
import { changeLanguagePreference } from '../../../shared/i18n/i18n';

test('provider setup panel renders preset and API mode controls with base URL guidance', async () => {
  await changeLanguagePreference('en');

  const html = renderToStaticMarkup(
    React.createElement(ProviderSetupPanel, {
      apiKey: '',
        apiMode: 'openai_chat_completions',
        apiModeOptions,
        baseUrl: 'http://localhost:11434/v1',
        canSave: false,
        isSaving: false,
        isTesting: false,
      model: 'llama3.2',
        providerId: 'ollama_local',
        providerPresets: llmProviderPresets,
        saveBlockedReason: 'Test connection with these exact settings before saving.',
        testResult: null,
      timeoutSeconds: 30,
      onApiKeyChange: () => {},
      onApiModeChange: () => {},
      onBaseUrlChange: () => {},
      onModelChange: () => {},
      onProviderPresetChange: () => {},
      onSave: () => {},
      onTest: () => {},
      onTimeoutSecondsChange: () => {},
    }),
  );

  assert.match(html, /Provider preset/);
  assert.match(html, /Ollama \/ Local OpenAI Compatible/);
  assert.match(html, /API mode/);
  assert.match(html, /OpenAI Responses API compatible/);
  assert.match(html, /Base URL should stop at the API version/);
  assert.match(html, /Testing checks this draft only/);
  assert.match(html, /Test connection with these exact settings/);
  assert.match(html, /class="[^"]*ml-surface[^"]*provider-setup-surface/);
  assert.match(html, /class="[^"]*ml-field/);
  assert.match(html, /class="[^"]*ml-notice[^"]*ml-notice-warning/);
  assert.match(html, /class="[^"]*ml-button[^"]*ml-button-primary/);
  assert.match(html, /<button class="[^"]*ml-button[^"]*" disabled="" type="submit">Save<\/button>/);
});
