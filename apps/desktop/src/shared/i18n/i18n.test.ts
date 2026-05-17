import assert from 'node:assert/strict';
import test from 'node:test';

import i18n, { changeLanguagePreference, resolveLanguagePreference } from './i18n';

test('language preference resolves system, English, and Chinese choices', () => {
  assert.equal(resolveLanguagePreference('system', 'zh-CN'), 'zh-CN');
  assert.equal(resolveLanguagePreference('system', 'en-US'), 'en');
  assert.equal(resolveLanguagePreference('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguagePreference('zh-CN', 'en-US'), 'zh-CN');
});

test('i18next exposes English and Simplified Chinese UI strings', async () => {
  await changeLanguagePreference('en', 'zh-CN');
  assert.equal(i18n.t('agent.title'), 'Execution agent');

  await changeLanguagePreference('zh-CN', 'en-US');
  assert.equal(i18n.t('agent.title'), '执行 Agent');
  assert.equal(i18n.t('settings.language.title'), '语言偏好');
});
