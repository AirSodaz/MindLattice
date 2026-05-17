import { Check, CircleDot, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
import { previewWriteSummary, type AgentPreviewModel, type PreviewDiff } from '../workbenchModel';

export type PreviewReviewPanelProps = {
  activePreview: AgentPreviewModel | null;
  previewDiff?: PreviewDiff | null;
  isBusy?: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function PreviewReviewPanel({
  activePreview,
  previewDiff,
  isBusy = false,
  onAccept,
  onReject,
}: PreviewReviewPanelProps) {
  const { t } = useTranslation('common');

  return (
    <section className="preview-surface" aria-label={t('preview.aria')}>
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">{t('preview.eyebrow')}</span>
          <h2>{t('preview.title')}</h2>
        </div>
        <CircleDot aria-hidden="true" size={18} />
      </div>
      <p>{previewWriteSummary(activePreview)}</p>
      {activePreview ? (
        <ul className="preview-list" aria-label={t('preview.items')}>
          {activePreview.proposedNodes.map((node) => (
            <li key={node.id}>
              <span>{t('preview.draft', { kind: node.kind.replaceAll('_', ' ') })}</span>
              {node.title}
            </li>
          ))}
        </ul>
      ) : null}
      {previewDiff ? (
        <div className="preview-diff" aria-label="Preview write diff">
          <div className="preview-diff-counts">
            <span>{previewDiff.counts.nodesToAdd} nodes</span>
            <span>{previewDiff.counts.edgesToAdd} edges</span>
            <span>{previewDiff.counts.memoryToReview} memories</span>
            <span>{previewDiff.counts.checkInsToSave} check-ins</span>
            <span>{previewDiff.counts.strategyExperimentsToSave} experiments</span>
          </div>
          <ul>
            {previewDiff.rows.map((row, index) => (
              <li key={`${row.kind}-${index}`}>
                <span>{row.label}</span>
                {row.detail}
              </li>
            ))}
          </ul>
          <p>{previewDiff.unsupportedMutationsNotice}</p>
        </div>
      ) : null}
      <div className="action-row">
        <button disabled={!activePreview || isBusy} onClick={onAccept} type="button">
          <Check aria-hidden="true" size={16} />
          {t('preview.accept')}
        </button>
        <button className="secondary" disabled={!activePreview || isBusy} onClick={onReject} type="button">
          <X aria-hidden="true" size={16} />
          {t('preview.reject')}
        </button>
      </div>
    </section>
  );
}
