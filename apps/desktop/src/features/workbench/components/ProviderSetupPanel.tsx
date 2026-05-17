import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { CommandLlmTestResult } from '../../../shared/api/commandClient';
import '../../../shared/i18n/i18n';
import type {
  LlmApiMode,
  LlmApiModeOption,
  LlmProviderId,
  LlmProviderPreset,
} from '../../settings/llmProviderRegistry';

export type ProviderSetupPanelProps = {
  apiKey: string;
  apiMode: LlmApiMode;
  apiModeOptions: LlmApiModeOption[];
  baseUrl: string;
  isSaving: boolean;
  isTesting: boolean;
  model: string;
  providerId: LlmProviderId;
  providerPresets: LlmProviderPreset[];
  testResult: CommandLlmTestResult | null;
  timeoutSeconds: number;
  onApiKeyChange: (value: string) => void;
  onApiModeChange: (value: LlmApiMode) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onProviderPresetChange: (value: LlmProviderId) => void;
  onSave: () => void;
  onTest: () => void;
  onTimeoutSecondsChange: (value: number) => void;
};

export function ProviderSetupPanel({
  apiKey,
  apiMode,
  apiModeOptions,
  baseUrl,
  isSaving,
  isTesting,
  model,
  providerId,
  providerPresets,
  onApiKeyChange,
  onApiModeChange,
  onBaseUrlChange,
  onModelChange,
  onProviderPresetChange,
  onSave,
  onTest,
  onTimeoutSecondsChange,
  testResult,
  timeoutSeconds,
}: ProviderSetupPanelProps) {
  const { t } = useTranslation('common');
  const isMissingRequiredValue = !baseUrl.trim() || !apiKey.trim() || !model.trim();
  const isBusy = isSaving || isTesting;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy || isMissingRequiredValue) {
      return;
    }
    onSave();
  };

  return (
    <section className="settings-surface provider-setup-surface" aria-label={t('provider.aria')}>
      <div>
        <span className="eyebrow">{t('provider.eyebrow')}</span>
        <h2>{t('provider.title')}</h2>
      </div>
      <p>{t('provider.required')}</p>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          {t('provider.preset')}
          <select
            disabled={isBusy}
            onChange={(event) => onProviderPresetChange(event.target.value as LlmProviderId)}
            value={providerId}
          >
            {providerPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('provider.apiMode')}
          <select
            disabled={isBusy}
            onChange={(event) => onApiModeChange(event.target.value as LlmApiMode)}
            value={apiMode}
          >
            {apiModeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('provider.baseUrl')}
          <input disabled={isBusy} onChange={(event) => onBaseUrlChange(event.target.value)} value={baseUrl} />
          <span className="field-help">{t('provider.baseUrlHelp')}</span>
        </label>
        <label>
          {t('provider.apiKey')}
          <input
            disabled={isBusy}
            onChange={(event) => onApiKeyChange(event.target.value)}
            type="password"
            value={apiKey}
          />
        </label>
        <label>
          {t('provider.model')}
          <input disabled={isBusy} onChange={(event) => onModelChange(event.target.value)} value={model} />
        </label>
        <label>
          {t('provider.timeout')}
          <input
            disabled={isBusy}
            min={5}
            onChange={(event) => onTimeoutSecondsChange(Number(event.target.value))}
            type="number"
            value={timeoutSeconds}
          />
        </label>
        {testResult ? <p className="provider-test-status provider-test-status-ok">{testResult.message}</p> : null}
        <div className="action-row">
          <button disabled={isBusy || isMissingRequiredValue} onClick={onTest} type="button">
            {t('provider.testConnection')}
          </button>
          <button disabled={isBusy || isMissingRequiredValue} type="submit">
            {t('provider.save')}
          </button>
        </div>
      </form>
      <p className="agent-setup-hint">{t('provider.boundary')}</p>
    </section>
  );
}
