export type EmptyContextPanelProps = {
  isLlmConfigured: boolean;
  onConfigureLlm: () => void;
};

export function EmptyContextPanel({ isLlmConfigured, onConfigureLlm }: EmptyContextPanelProps) {
  return (
    <section className="empty-context-surface" aria-label="Empty turn context">
      <div>
        <span className="eyebrow">Turn context</span>
        <h2>{isLlmConfigured ? 'Ready' : 'Setup required'}</h2>
      </div>
      <p>{isLlmConfigured ? 'Tell me what feels messy right now.' : 'Configure LLM to use the execution agent.'}</p>
      {!isLlmConfigured ? (
        <button onClick={onConfigureLlm} type="button">
          Configure LLM
        </button>
      ) : null}
    </section>
  );
}
