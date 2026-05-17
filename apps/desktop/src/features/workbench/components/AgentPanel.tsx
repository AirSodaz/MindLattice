import { BrainCircuit, Send } from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
import type { WorkbenchModel } from '../workbenchModel';

export type AgentPanelProps = {
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerValue: string;
  isAgentBusy: boolean;
  isLlmConfigured: boolean;
  workspaceReady: boolean;
  workbench: WorkbenchModel;
  onComposerChange: (value: string) => void;
  onConfigureLlm: () => void;
  onSubmit: () => void;
};

export function AgentPanel({
  composerInputRef,
  composerValue,
  isAgentBusy,
  isLlmConfigured,
  onComposerChange,
  onConfigureLlm,
  onSubmit,
  workspaceReady,
  workbench,
}: AgentPanelProps) {
  const { t } = useTranslation('common');
  const composerDisabled = isAgentBusy || !workspaceReady || !isLlmConfigured;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composerDisabled || !composerValue.trim()) {
      return;
    }
    onSubmit();
  };

  return (
    <aside className="agent-panel" aria-label="Conversational execution agent">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t('common.mindLattice')}</span>
          <h1>{t('agent.title')}</h1>
        </div>
        <BrainCircuit aria-hidden="true" size={22} />
      </div>

      {!isLlmConfigured ? (
        <div className="agent-setup-card">
          <span className="eyebrow">{t('agent.setupRequired')}</span>
          <h2>{t('agent.configureLlm')}</h2>
          <p>{t('agent.configureLlmDescription')}</p>
          <button onClick={onConfigureLlm} type="button">
            {t('agent.configureLlm')}
          </button>
        </div>
      ) : null}

      <div className="message-list" aria-label={t('agent.threadLabel')}>
        {workbench.messages.map((message) => (
          <article className={`message message-${message.sender}`} key={message.id}>
            <span>{message.sender === 'agent' ? t('agent.senderAgent') : t('agent.senderUser')}</span>
            <p>{message.body}</p>
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          aria-label={t('agent.messageLabel')}
          disabled={composerDisabled}
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder={
            isLlmConfigured
              ? t('agent.placeholder.ready')
              : t('agent.placeholder.needsLlm')
          }
          ref={composerInputRef}
          value={composerValue}
        />
        <button
          aria-label={t('agent.send')}
          disabled={composerDisabled || !composerValue.trim()}
          type="submit"
        >
          <Send aria-hidden="true" size={18} />
        </button>
      </form>
    </aside>
  );
}
