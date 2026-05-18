import { Moon, Sun } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { CommandSupportCategory } from '../../shared/api/commandClient';
import '../../shared/i18n/i18n';
import type { LanguagePreference } from '../../shared/i18n/i18n';
import { Button, Field, Notice, Surface } from '../../shared/ui';
import type { ThemePreference } from '../workbench/workbenchModel';
import type {
  LlmApiMode,
  LlmApiModeOption,
  LlmProviderId,
  LlmProviderPreset,
} from './llmProviderRegistry';
import type { SettingsProfile, SettingsSection } from './settingsModel';

type ThemeOption = {
  value: ThemePreference;
  label: string;
};

type SupportCategoryOption = {
  value: CommandSupportCategory;
  label: string;
};

type LanguageOption = {
  value: LanguagePreference;
  label: string;
};

export type SettingsPanelProps = {
  adultContextOptions: string[];
  executionDifficultyOptions: string[];
  isLlmTesting?: boolean;
  isLlmSaving: boolean;
  isOnboardingSaving: boolean;
  canSaveLlmSettings: boolean;
  llmApiKey: string;
  llmApiMode: LlmApiMode;
  llmApiModeOptions: LlmApiModeOption[];
  llmBaseUrl: string;
  llmModel: string;
  llmProviderId: LlmProviderId;
  llmProviderPresets: LlmProviderPreset[];
  llmTimeoutSeconds: number;
  languageOptions: LanguageOption[];
  languagePreference: LanguagePreference;
  onboardingContexts: string[];
  onboardingDifficulties: string[];
  onboardingSupportCategories: CommandSupportCategory[];
  providerTestMessage?: string | null;
  providerTestStatus?: 'idle' | 'ok' | 'failed';
  saveLlmBlockedReason?: string | null;
  onTestLlmSettings?: () => void;
  onSaveLlmSettings: () => void;
  onSaveOnboardingProfile: () => void;
  profile: SettingsProfile;
  settingsSections: SettingsSection[];
  supportCategoryOptions: SupportCategoryOption[];
  themeOptions: ThemeOption[];
  themePreference: ThemePreference;
  onLlmApiKeyChange: (value: string) => void;
  onLlmApiModeChange: (value: LlmApiMode) => void;
  onLlmBaseUrlChange: (value: string) => void;
  onLlmModelChange: (value: string) => void;
  onLlmProviderPresetChange: (value: LlmProviderId) => void;
  onLlmTimeoutSecondsChange: (value: number) => void;
  onLanguagePreferenceChange: (value: LanguagePreference) => void;
  onOnboardingContextsChange: (value: string[]) => void;
  onOnboardingDifficultiesChange: (value: string[]) => void;
  onOnboardingSupportCategoriesChange: (value: CommandSupportCategory[]) => void;
  onThemePreferenceChange: (value: ThemePreference) => void;
};

export function SettingsPanel({
  adultContextOptions,
  executionDifficultyOptions,
  isLlmTesting = false,
  isLlmSaving,
  isOnboardingSaving,
  canSaveLlmSettings,
  llmApiKey,
  llmApiMode,
  llmApiModeOptions,
  llmBaseUrl,
  llmModel,
  llmProviderId,
  llmProviderPresets,
  llmTimeoutSeconds,
  languageOptions,
  languagePreference,
  onboardingContexts,
  onboardingDifficulties,
  onboardingSupportCategories,
  onLlmApiKeyChange,
  onLlmApiModeChange,
  onLlmBaseUrlChange,
  onLlmModelChange,
  onLlmProviderPresetChange,
  onLlmTimeoutSecondsChange,
  onLanguagePreferenceChange,
  onOnboardingContextsChange,
  onOnboardingDifficultiesChange,
  onOnboardingSupportCategoriesChange,
  onTestLlmSettings,
  onSaveLlmSettings,
  onSaveOnboardingProfile,
  onThemePreferenceChange,
  providerTestMessage,
  providerTestStatus = 'idle',
  saveLlmBlockedReason,
  settingsSections,
  supportCategoryOptions,
  themeOptions,
  themePreference,
}: SettingsPanelProps) {
  const { t } = useTranslation('common');
  const handleProviderSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveLlmSettings();
  };
  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveOnboardingProfile();
  };

  return (
    <Surface
      className="settings-surface"
      tone="settings"
      eyebrow={t('settings.eyebrow')}
      title={t('settings.title')}
      aria-label={t('settings.aria')}
    >
      <div className="settings-status-grid" aria-label={t('settings.readiness')}>
        {settingsSections.map((section) => (
          <article className={`settings-status settings-status-${section.status}`} key={section.id}>
            <div>
              <h3>{section.title}</h3>
              <span>
                {section.status === 'needs_setup'
                  ? t('settings.status.needsSetup')
                  : section.status === 'always_on'
                    ? t('settings.status.alwaysOn')
                    : t('settings.status.ready')}
              </span>
            </div>
            <p>{section.description}</p>
          </article>
        ))}
      </div>
      <form className="settings-form" onSubmit={handleProviderSubmit}>
        <div>
          <span className="eyebrow">{t('settings.provider.eyebrow')}</span>
          <h3>{t('settings.provider.title')}</h3>
        </div>
        <Field label={t('provider.preset')}>
          <select
            disabled={isLlmSaving || isLlmTesting}
            onChange={(event) => onLlmProviderPresetChange(event.target.value as LlmProviderId)}
            value={llmProviderId}
          >
            {llmProviderPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('provider.apiMode')}>
          <select
            disabled={isLlmSaving || isLlmTesting}
            onChange={(event) => onLlmApiModeChange(event.target.value as LlmApiMode)}
            value={llmApiMode}
          >
            {llmApiModeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('provider.baseUrl')} help={t('provider.baseUrlHelp')}>
          <input
            disabled={isLlmSaving || isLlmTesting}
            onChange={(event) => onLlmBaseUrlChange(event.target.value)}
            value={llmBaseUrl}
          />
        </Field>
        <Field label={t('provider.apiKey')}>
          <input
            disabled={isLlmSaving || isLlmTesting}
            onChange={(event) => onLlmApiKeyChange(event.target.value)}
            type="password"
            value={llmApiKey}
          />
        </Field>
        <Field label={t('provider.model')}>
          <input
            disabled={isLlmSaving || isLlmTesting}
            onChange={(event) => onLlmModelChange(event.target.value)}
            placeholder="gpt-4.1-mini or local model"
            value={llmModel}
          />
        </Field>
        <Field label={t('provider.timeout')}>
          <input
            disabled={isLlmSaving || isLlmTesting}
            min={5}
            onChange={(event) => onLlmTimeoutSecondsChange(Number(event.target.value))}
            type="number"
            value={llmTimeoutSeconds}
          />
        </Field>
        {providerTestMessage ? (
          <Notice
            className={`provider-test-status provider-test-status-${providerTestStatus}`}
            tone={providerTestStatus === 'ok' ? 'ok' : providerTestStatus === 'failed' ? 'error' : 'warning'}
          >
            {providerTestMessage}
          </Notice>
        ) : (
          <Notice className="provider-test-status provider-test-status-idle" tone="warning">
            {t('provider.testDoesNotSave')}
          </Notice>
        )}
        {!canSaveLlmSettings && saveLlmBlockedReason ? (
          <Notice className="provider-save-hint" tone="warning">
            {saveLlmBlockedReason}
          </Notice>
        ) : null}
        <div className="action-row">
          <Button
            disabled={isLlmTesting || isLlmSaving || !llmBaseUrl.trim() || !llmApiKey.trim() || !llmModel.trim()}
            onClick={onTestLlmSettings}
            type="button"
            variant="secondary"
          >
            {t('provider.testConnection')}
          </Button>
          <Button
            disabled={
              isLlmSaving ||
              isLlmTesting ||
              !llmBaseUrl.trim() ||
              !llmApiKey.trim() ||
              !llmModel.trim() ||
              !canSaveLlmSettings
            }
            type="submit"
            variant="primary"
          >
            {t('provider.saveProvider')}
          </Button>
        </div>
      </form>
      <form className="settings-form" onSubmit={handleProfileSubmit}>
        <div>
          <span className="eyebrow">{t('settings.profile.eyebrow')}</span>
          <h3>{t('settings.profile.title')}</h3>
        </div>
        <div className="setup-options" aria-label="Adult contexts">
          {adultContextOptions.map((context) => (
            <label key={context}>
              <input
                checked={onboardingContexts.includes(context)}
                disabled={isOnboardingSaving}
                onChange={(event) =>
                  onOnboardingContextsChange(
                    event.target.checked
                      ? [...onboardingContexts, context]
                      : onboardingContexts.filter((item) => item !== context),
                  )
                }
                type="checkbox"
              />
              {context}
            </label>
          ))}
        </div>
        <div className="setup-options" aria-label="Execution difficulties">
          {executionDifficultyOptions.map((difficulty) => (
            <label key={difficulty}>
              <input
                checked={onboardingDifficulties.includes(difficulty)}
                disabled={isOnboardingSaving}
                onChange={(event) =>
                  onOnboardingDifficultiesChange(
                    event.target.checked
                      ? [...onboardingDifficulties, difficulty]
                      : onboardingDifficulties.filter((item) => item !== difficulty),
                  )
                }
                type="checkbox"
              />
              {difficulty}
            </label>
          ))}
        </div>
        <label>
          {t('settings.profile.preferredSupport')}
          <select
            disabled={isOnboardingSaving}
            onChange={(event) =>
              onOnboardingSupportCategoriesChange(
                event.target.value ? [event.target.value as CommandSupportCategory] : [],
              )
            }
            value={onboardingSupportCategories[0] ?? ''}
          >
            <option value="">{t('settings.profile.noPreference')}</option>
            {supportCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={isOnboardingSaving} type="submit" variant="secondary">
          {t('settings.profile.save')}
        </Button>
      </form>
      <div className="settings-form settings-boundary" aria-label="Safety boundary">
        <div>
          <span className="eyebrow">{t('settings.safety.eyebrow')}</span>
          <h3>{t('settings.safety.title')}</h3>
        </div>
        <p>{t('settings.safety.description')}</p>
      </div>
      <div className="settings-form" aria-label="Interface preferences">
        <div>
          <span className="eyebrow">{t('settings.interface.eyebrow')}</span>
          <h3>{t('settings.interface.title')}</h3>
        </div>
        <label>
          {t('settings.language.title')}
          <select
            onChange={(event) => onLanguagePreferenceChange(event.target.value as LanguagePreference)}
            value={languagePreference}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="theme-control settings-theme-control" aria-label={t('settings.theme.title')}>
          {themeOptions.map((option) => (
            <Button
              className={themePreference === option.value ? 'is-active' : ''}
              key={option.value}
              onClick={() => onThemePreferenceChange(option.value)}
              type="button"
              variant="ghost"
            >
              {option.value === 'dark' ? <Moon aria-hidden="true" size={16} /> : <Sun aria-hidden="true" size={16} />}
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </Surface>
  );
}
