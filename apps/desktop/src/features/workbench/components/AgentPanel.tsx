import { BrainCircuit, Send } from 'lucide-react';
import type { FormEvent, RefObject } from 'react';

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
          <span className="eyebrow">MindLattice</span>
          <h1>Execution agent</h1>
        </div>
        <BrainCircuit aria-hidden="true" size={22} />
      </div>

      {!isLlmConfigured ? (
        <div className="agent-setup-card">
          <span className="eyebrow">Setup required</span>
          <h2>Configure LLM</h2>
          <p>Configure LLM to use the execution agent.</p>
          <button onClick={onConfigureLlm} type="button">
            Configure LLM
          </button>
        </div>
      ) : null}

      <div className="message-list" aria-label="Agent thread">
        {workbench.messages.map((message) => (
          <article className={`message message-${message.sender}`} key={message.id}>
            <span>{message.sender === 'agent' ? 'Agent' : 'You'}</span>
            <p>{message.body}</p>
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          aria-label="Message the execution agent"
          disabled={composerDisabled}
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder={
            isLlmConfigured
              ? 'Tell me what feels messy right now.'
              : 'Configure LLM to unlock the agent.'
          }
          ref={composerInputRef}
          value={composerValue}
        />
        <button
          aria-label="Send message"
          disabled={composerDisabled || !composerValue.trim()}
          type="submit"
        >
          <Send aria-hidden="true" size={18} />
        </button>
      </form>
    </aside>
  );
}
