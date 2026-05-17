import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import zhCnCommon from './locales/zh-CN/common.json';

export type LanguagePreference = 'system' | 'en' | 'zh-CN';
export type SupportedLanguage = 'en' | 'zh-CN';

export function resolveLanguagePreference(
  preference: LanguagePreference,
  systemLanguage = getSystemLanguage(),
): SupportedLanguage {
  if (preference === 'system') {
    return systemLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  }
  return preference;
}

export async function changeLanguagePreference(
  preference: LanguagePreference,
  systemLanguage = getSystemLanguage(),
): Promise<SupportedLanguage> {
  const resolvedLanguage = resolveLanguagePreference(preference, systemLanguage);
  await i18n.changeLanguage(resolvedLanguage);
  return resolvedLanguage;
}

function getSystemLanguage(): string {
  if (typeof navigator === 'undefined') {
    return 'en-US';
  }
  return navigator.language || 'en-US';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    'zh-CN': { common: zhCnCommon },
  },
  lng: resolveLanguagePreference('system'),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
