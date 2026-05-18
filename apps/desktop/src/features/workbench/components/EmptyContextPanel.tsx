import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
import { Button, Surface } from '../../../shared/ui';

export type EmptyContextPanelProps = {
  isLlmConfigured: boolean;
  onConfigureLlm: () => void;
};

export function EmptyContextPanel({ isLlmConfigured, onConfigureLlm }: EmptyContextPanelProps) {
  const { t } = useTranslation('common');

  return (
    <Surface
      className="empty-context-surface"
      tone="default"
      eyebrow={t('empty.eyebrow')}
      title={isLlmConfigured ? t('common.ready') : t('common.setupRequired')}
      aria-label={t('empty.aria')}
    >
      <p>{isLlmConfigured ? t('agent.placeholder.ready') : t('agent.configureLlmDescription')}</p>
      {!isLlmConfigured ? (
        <Button onClick={onConfigureLlm} type="button" variant="primary">
          {t('agent.configureLlm')}
        </Button>
      ) : null}
    </Surface>
  );
}
