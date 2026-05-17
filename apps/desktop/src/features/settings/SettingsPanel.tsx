import { Moon, Sun } from 'lucide-react';
import type { FormEvent } from 'react';

import type { CommandSupportCategory } from '../../shared/api/commandClient';
import type { ThemePreference } from '../workbench/workbenchModel';
import type { SettingsProfile, SettingsSection } from './settingsModel';

type ThemeOption = {
  value: ThemePreference;
  label: string;
};

type SupportCategoryOption = {
  value: CommandSupportCategory;
  label: string;
};

export type SettingsPanelProps = {
  adultContextOptions: string[];
  executionDifficultyOptions: string[];
  isLlmSaving: boolean;
  isOnboardingSaving: boolean;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  llmTimeoutSeconds: number;
  onboardingContexts: string[];
  onboardingDifficulties: string[];
  onboardingSupportCategories: CommandSupportCategory[];
  onSaveLlmSettings: () => void;
  onSaveOnboardingProfile: () => void;
  profile: SettingsProfile;
  settingsSections: SettingsSection[];
  supportCategoryOptions: SupportCategoryOption[];
  themeOptions: ThemeOption[];
  themePreference: ThemePreference;
  onLlmApiKeyChange: (value: string) => void;
  onLlmBaseUrlChange: (value: string) => void;
  onLlmModelChange: (value: string) => void;
  onLlmTimeoutSecondsChange: (value: number) => void;
  onOnboardingContextsChange: (value: string[]) => void;
  onOnboardingDifficultiesChange: (value: string[]) => void;
  onOnboardingSupportCategoriesChange: (value: CommandSupportCategory[]) => void;
  onThemePreferenceChange: (value: ThemePreference) => void;
};

export function SettingsPanel({
  adultContextOptions,
  executionDifficultyOptions,
  isLlmSaving,
  isOnboardingSaving,
  llmApiKey,
  llmBaseUrl,
  llmModel,
  llmTimeoutSeconds,
  onboardingContexts,
  onboardingDifficulties,
  onboardingSupportCategories,
  onLlmApiKeyChange,
  onLlmBaseUrlChange,
  onLlmModelChange,
  onLlmTimeoutSecondsChange,
  onOnboardingContextsChange,
  onOnboardingDifficultiesChange,
  onOnboardingSupportCategoriesChange,
  onSaveLlmSettings,
  onSaveOnboardingProfile,
  onThemePreferenceChange,
  settingsSections,
  supportCategoryOptions,
  themeOptions,
  themePreference,
}: SettingsPanelProps) {
  const handleProviderSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveLlmSettings();
  };
  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveOnboardingProfile();
  };

  return (
    <section className="settings-surface" aria-label="Settings">
      <div>
        <span className="eyebrow">Settings</span>
        <h2>Agent setup and local preferences</h2>
      </div>
      <div className="settings-status-grid" aria-label="Settings readiness">
        {settingsSections.map((section) => (
          <article className={`settings-status settings-status-${section.status}`} key={section.id}>
            <div>
              <h3>{section.title}</h3>
              <span>
                {section.status === 'needs_setup'
                  ? 'Needs setup'
                  : section.status === 'always_on'
                    ? 'Always on'
                    : 'Ready'}
              </span>
            </div>
            <p>{section.description}</p>
          </article>
        ))}
      </div>
      <form className="settings-form" onSubmit={handleProviderSubmit}>
        <div>
          <span className="eyebrow">Agent Provider</span>
          <h3>Required LLM connection</h3>
        </div>
        <label>
          Base URL
          <input disabled={isLlmSaving} onChange={(event) => onLlmBaseUrlChange(event.target.value)} value={llmBaseUrl} />
        </label>
        <label>
          API key
          <input
            disabled={isLlmSaving}
            onChange={(event) => onLlmApiKeyChange(event.target.value)}
            type="password"
            value={llmApiKey}
          />
        </label>
        <label>
          Model
          <input
            disabled={isLlmSaving}
            onChange={(event) => onLlmModelChange(event.target.value)}
            placeholder="gpt-4.1-mini or local model"
            value={llmModel}
          />
        </label>
        <label>
          Timeout
          <input
            disabled={isLlmSaving}
            min={5}
            onChange={(event) => onLlmTimeoutSecondsChange(Number(event.target.value))}
            type="number"
            value={llmTimeoutSeconds}
          />
        </label>
        <button disabled={isLlmSaving || !llmBaseUrl.trim() || !llmApiKey.trim() || !llmModel.trim()} type="submit">
          Save provider
        </button>
      </form>
      <form className="settings-form" onSubmit={handleProfileSubmit}>
        <div>
          <span className="eyebrow">Local Profile</span>
          <h3>Support matching defaults</h3>
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
          Preferred support
          <select
            disabled={isOnboardingSaving}
            onChange={(event) =>
              onOnboardingSupportCategoriesChange(
                event.target.value ? [event.target.value as CommandSupportCategory] : [],
              )
            }
            value={onboardingSupportCategories[0] ?? ''}
          >
            <option value="">No preference yet</option>
            {supportCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button disabled={isOnboardingSaving} type="submit">
          Save profile
        </button>
      </form>
      <div className="settings-form settings-boundary" aria-label="Safety boundary">
        <div>
          <span className="eyebrow">Safety Boundary</span>
          <h3>Low-risk execution support</h3>
        </div>
        <p>No diagnosis, treatment, medication guidance, symptom scoring, clinical follow-up, or claims to reduce ADHD symptoms.</p>
      </div>
      <div className="settings-form" aria-label="Interface preferences">
        <div>
          <span className="eyebrow">Interface</span>
          <h3>Theme preference</h3>
        </div>
        <div className="theme-control settings-theme-control" aria-label="Theme preference">
          {themeOptions.map((option) => (
            <button
              className={themePreference === option.value ? 'is-active' : ''}
              key={option.value}
              onClick={() => onThemePreferenceChange(option.value)}
              type="button"
            >
              {option.value === 'dark' ? <Moon aria-hidden="true" size={16} /> : <Sun aria-hidden="true" size={16} />}
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
