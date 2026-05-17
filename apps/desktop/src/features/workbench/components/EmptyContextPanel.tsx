import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';

export type EmptyContextPanelProps = {
  isLlmConfigured: boolean;
  onConfigureLlm: () => void;
};

export function EmptyContextPanel({ isLlmConfigured, onConfigureLlm }: EmptyContextPanelProps) {
  const { t } = useTranslation('common');

  return (
    <section className="empty-context-surface" aria-label={t('empty.aria')}>
      <div>
        <span className="eyebrow">{t('empty.eyebrow')}</span>
        <h2>{isLlmConfigured ? t('common.ready') : t('common.setupRequired')}</h2>
      </div>
      <p>{isLlmConfigured ? t('agent.placeholder.ready') : t('agent.configureLlmDescription')}</p>
      {!isLlmConfigured ? (
        <button onClick={onConfigureLlm} type="button">
          {t('agent.configureLlm')}
        </button>
      ) : null}
    </section>
  );
}
