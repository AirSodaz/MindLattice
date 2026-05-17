import { Check, CircleDot, X } from 'lucide-react';

import { previewWriteSummary, type AgentPreviewModel } from '../workbenchModel';

export type PreviewReviewPanelProps = {
  activePreview: AgentPreviewModel | null;
  isBusy?: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function PreviewReviewPanel({
  activePreview,
  isBusy = false,
  onAccept,
  onReject,
}: PreviewReviewPanelProps) {
  return (
    <section className="preview-surface" aria-label="Preview review">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Agent preview</span>
          <h2>Review before saving</h2>
        </div>
        <CircleDot aria-hidden="true" size={18} />
      </div>
      <p>{previewWriteSummary(activePreview)}</p>
      {activePreview ? (
        <ul className="preview-list" aria-label="Preview items">
          {activePreview.proposedNodes.map((node) => (
            <li key={node.id}>
              <span>Draft {node.kind.replaceAll('_', ' ')}</span>
              {node.title}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="action-row">
        <button disabled={!activePreview || isBusy} onClick={onAccept} type="button">
          <Check aria-hidden="true" size={16} />
          Accept
        </button>
        <button className="secondary" disabled={!activePreview || isBusy} onClick={onReject} type="button">
          <X aria-hidden="true" size={16} />
          Reject
        </button>
      </div>
    </section>
  );
}
