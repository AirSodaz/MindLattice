import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apiModeOptions,
  applyLlmProviderPreset,
  llmProviderPresets,
} from './llmProviderRegistry';

test('LLM provider registry includes first-release presets with explicit API modes', () => {
  assert.deepEqual(
    llmProviderPresets.map((preset) => preset.id),
    ['openai', 'anthropic_claude', 'google_gemini', 'ollama_local', 'custom'],
  );
  assert.deepEqual(
    apiModeOptions.map((mode) => mode.id),
    [
      'openai_chat_completions',
      'openai_responses',
      'claude_messages',
      'gemini_generate_content',
    ],
  );
});

test('applying provider presets fills default host, mode, and model without API keys', () => {
  const openAi = applyLlmProviderPreset('openai');
  const claude = applyLlmProviderPreset('anthropic_claude');
  const gemini = applyLlmProviderPreset('google_gemini');
  const ollama = applyLlmProviderPreset('ollama_local');

  assert.deepEqual(openAi, {
    providerId: 'openai',
    apiMode: 'openai_chat_completions',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4.1-mini',
    timeoutSeconds: 30,
  });
  assert.equal(claude.apiMode, 'claude_messages');
  assert.equal(claude.baseUrl, 'https://api.anthropic.com/v1');
  assert.equal(claude.apiKey, '');
  assert.equal(gemini.apiMode, 'gemini_generate_content');
  assert.equal(gemini.baseUrl, 'https://generativelanguage.googleapis.com/v1beta');
  assert.equal(ollama.baseUrl, 'http://localhost:11434/v1');
});

test('custom provider requires caller-selected API mode and keeps entered values', () => {
  const custom = applyLlmProviderPreset('custom', {
    apiMode: 'openai_responses',
    baseUrl: 'https://llm.example.test/v1',
    apiKey: 'keep-key',
    model: 'custom-model',
    timeoutSeconds: 45,
  });

  assert.deepEqual(custom, {
    providerId: 'custom',
    apiMode: 'openai_responses',
    baseUrl: 'https://llm.example.test/v1',
    apiKey: 'keep-key',
    model: 'custom-model',
    timeoutSeconds: 45,
  });
});
