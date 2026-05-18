import { Check, CircleDot, PencilLine, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
import { Badge, Button, Surface } from '../../../shared/ui';
import { previewWriteSummary, type AgentPreviewModel, type PreviewDiff } from '../workbenchModel';

export type PreviewReviewPanelProps = {
  activePreview: AgentPreviewModel | null;
  previewDiff?: PreviewDiff | null;
  isBusy?: boolean;
  onAccept: () => void;
  onRevise: () => void;
  onReject: () => void;
};

export function PreviewReviewPanel({
  activePreview,
  previewDiff,
  isBusy = false,
  onAccept,
  onRevise,
  onReject,
}: PreviewReviewPanelProps) {
  const { t } = useTranslation('common');

  return (
    <Surface
      className="preview-surface"
      tone="preview"
      eyebrow={t('preview.eyebrow')}
      title={t('preview.title')}
      actions={<CircleDot aria-hidden="true" size={18} />}
      aria-label={t('preview.aria')}
    >
      <p className="preview-status-copy">{t('preview.nothingSaved')}</p>
      <p>{previewWriteSummary(activePreview)}</p>
      {activePreview ? (
        <ul className="preview-list" aria-label={t('preview.items')}>
          {activePreview.proposedNodes.map((node) => (
            <li className="ml-list-item ml-list-item-draft" key={node.id}>
              <Badge tone="draft">{t('preview.draftBadge')}</Badge>
              <span>{t('preview.draft', { kind: node.kind.replaceAll('_', ' ') })}</span>
              <strong>{node.title}</strong>
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
        <Button
          disabled={!activePreview || isBusy}
          icon={<Check aria-hidden="true" size={16} />}
          onClick={onAccept}
          type="button"
          variant="primary"
        >
          {t('preview.accept')}
        </Button>
        <Button
          disabled={!activePreview || isBusy}
          icon={<PencilLine aria-hidden="true" size={16} />}
          onClick={onRevise}
          type="button"
          variant="secondary"
        >
          {t('preview.revise')}
        </Button>
        <Button
          disabled={!activePreview || isBusy}
          icon={<X aria-hidden="true" size={16} />}
          onClick={onReject}
          type="button"
          variant="secondary"
        >
          {t('preview.reject')}
        </Button>
      </div>
    </Surface>
  );
}
