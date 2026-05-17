import type { FormEvent } from 'react';

import type { CommandLlmTestResult } from '../../../shared/api/commandClient';

export type ProviderSetupPanelProps = {
  apiKey: string;
  baseUrl: string;
  isSaving: boolean;
  isTesting: boolean;
  model: string;
  testResult: CommandLlmTestResult | null;
  timeoutSeconds: number;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
  onTimeoutSecondsChange: (value: number) => void;
};

export function ProviderSetupPanel({
  apiKey,
  baseUrl,
  isSaving,
  isTesting,
  model,
  onApiKeyChange,
  onBaseUrlChange,
  onModelChange,
  onSave,
  onTest,
  onTimeoutSecondsChange,
  testResult,
  timeoutSeconds,
}: ProviderSetupPanelProps) {
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
    <section className="settings-surface provider-setup-surface" aria-label="LLM provider setup">
      <div>
        <span className="eyebrow">Provider setup</span>
        <h2>Configure LLM</h2>
      </div>
      <p>Required for the execution agent.</p>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          Base URL
          <input disabled={isBusy} onChange={(event) => onBaseUrlChange(event.target.value)} value={baseUrl} />
        </label>
        <label>
          API key
          <input
            disabled={isBusy}
            onChange={(event) => onApiKeyChange(event.target.value)}
            type="password"
            value={apiKey}
          />
        </label>
        <label>
          Model
          <input disabled={isBusy} onChange={(event) => onModelChange(event.target.value)} value={model} />
        </label>
        <label>
          Timeout
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
            Test connection
          </button>
          <button disabled={isBusy || isMissingRequiredValue} type="submit">
            Save
          </button>
        </div>
      </form>
      <p className="agent-setup-hint">Low-risk execution support only. No diagnosis or treatment advice.</p>
    </section>
  );
}
