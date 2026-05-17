import { Check, CircleDot, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
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
