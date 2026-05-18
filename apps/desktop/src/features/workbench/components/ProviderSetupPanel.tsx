import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { CommandLlmTestResult } from '../../../shared/api/commandClient';
import '../../../shared/i18n/i18n';
import { Button, Field, Notice, Surface } from '../../../shared/ui';
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
  canSave: boolean;
  isSaving: boolean;
  isTesting: boolean;
  model: string;
  providerId: LlmProviderId;
  providerPresets: LlmProviderPreset[];
  saveBlockedReason?: string | null;
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
  canSave,
  isSaving,
  isTesting,
  model,
  providerId,
  providerPresets,
  saveBlockedReason,
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
    if (isBusy || isMissingRequiredValue || !canSave) {
      return;
    }
    onSave();
  };

  return (
    <Surface
      className="provider-setup-surface"
      tone="setup"
      eyebrow={t('provider.eyebrow')}
      title={t('provider.title')}
      aria-label={t('provider.aria')}
    >
      <p>{t('provider.required')}</p>
      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="provider-preset-grid" aria-label={t('provider.preset')}>
          {providerPresets.map((preset) => (
            <Button
              className={providerId === preset.id ? 'is-active' : ''}
              disabled={isBusy}
              key={preset.id}
              onClick={() => onProviderPresetChange(preset.id)}
              type="button"
            >
              <span>{preset.label}</span>
            </Button>
          ))}
        </div>
        <Field label={t('provider.preset')}>
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
        </Field>
        <Field label={t('provider.apiMode')}>
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
        </Field>
        <Field label={t('provider.baseUrl')} help={t('provider.baseUrlHelp')}>
          <input disabled={isBusy} onChange={(event) => onBaseUrlChange(event.target.value)} value={baseUrl} />
        </Field>
        <Field label={t('provider.apiKey')}>
          <input
            disabled={isBusy}
            onChange={(event) => onApiKeyChange(event.target.value)}
            type="password"
            value={apiKey}
          />
        </Field>
        <Field label={t('provider.model')}>
          <input disabled={isBusy} onChange={(event) => onModelChange(event.target.value)} value={model} />
        </Field>
        <Field label={t('provider.timeout')}>
          <input
            disabled={isBusy}
            min={5}
            onChange={(event) => onTimeoutSecondsChange(Number(event.target.value))}
            type="number"
            value={timeoutSeconds}
          />
        </Field>
        {testResult ? (
          <Notice className="provider-test-status provider-test-status-ok" tone="ok">
            {testResult.message}
          </Notice>
        ) : (
          <Notice className="provider-test-status provider-test-status-idle" tone="warning">
            {t('provider.testDoesNotSave')}
          </Notice>
        )}
        {!canSave && saveBlockedReason ? (
          <Notice className="provider-save-hint" tone="warning">
            {saveBlockedReason}
          </Notice>
        ) : null}
        <div className="action-row">
          <Button disabled={isBusy || isMissingRequiredValue} onClick={onTest} type="button" variant="secondary">
            {t('provider.testConnection')}
          </Button>
          <Button disabled={isBusy || isMissingRequiredValue || !canSave} type="submit" variant="primary">
            {t('provider.save')}
          </Button>
        </div>
      </form>
      <p className="agent-setup-hint">{t('provider.boundary')}</p>
    </Surface>
  );
}
