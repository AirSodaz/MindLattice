import { Activity } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
import type {
  ActiveAttentionSession,
  StartModeView,
  StartTimerState,
  WorkbenchScreenCheckIn,
} from './types';

export type StartPanelProps = {
  attentionSession: ActiveAttentionSession | null;
  checkInDraft: string;
  checkIns: WorkbenchScreenCheckIn[];
  followUpPrompts: string[];
  hasStartableAction: boolean;
  isCheckInSaving: boolean;
  isSessionBusy: boolean;
  sessionCompletionNote: string;
  startModeView: StartModeView;
  startTimerState: StartTimerState | null;
  workspaceReady: boolean;
  onCheckInDraftChange: (value: string) => void;
  onCloseSession: () => void;
  onEnterFocusMode?: () => void;
  onSaveCheckIn: () => void;
  onSessionCompletionNoteChange: (value: string) => void;
  onStartSession: () => void;
};

export function StartPanel({
  attentionSession,
  checkInDraft,
  checkIns,
  followUpPrompts,
  hasStartableAction,
  isCheckInSaving,
  isSessionBusy,
  onCheckInDraftChange,
  onCloseSession,
  onEnterFocusMode,
  onSaveCheckIn,
  onSessionCompletionNoteChange,
  onStartSession,
  sessionCompletionNote,
  startModeView,
  startTimerState,
  workspaceReady,
}: StartPanelProps) {
  const { t } = useTranslation('common');
  const handleCheckInSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCheckInSaving || !checkInDraft.trim()) {
      return;
    }
    onSaveCheckIn();
  };

  const handleCloseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSessionBusy) {
      return;
    }
    onCloseSession();
  };

  return (
    <section className="start-mode-surface" aria-label={t('start.aria')}>
      <div className="start-mode-header">
        <div>
          <span className="eyebrow">{t('start.title')}</span>
          <h2>{startModeView.nextAction}</h2>
        </div>
        {onEnterFocusMode ? (
          <button disabled={!hasStartableAction} onClick={onEnterFocusMode} type="button">
            {t('start.enter')}
          </button>
        ) : null}
      </div>
      <p>{startModeView.minimumDone}</p>
      <dl className="start-mode-details">
        {startModeView.details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
      <div className="session-controls">
        <span>{attentionSession ? t('start.focusActive') : t('start.ready')}</span>
        {startTimerState ? (
          <div className="timer-status" aria-label={t('start.timer')}>
            <strong>{startTimerState.label}</strong>
            <span>
              {startTimerState.remainingMinutes > 0
                ? t('start.minutesLeft', { count: startTimerState.remainingMinutes })
                : t('start.openEnded')}
            </span>
          </div>
        ) : null}
        {attentionSession ? (
          <form onSubmit={handleCloseSubmit}>
            <input
              disabled={isSessionBusy}
              onChange={(event) => onSessionCompletionNoteChange(event.target.value)}
              placeholder={t('start.closePlaceholder')}
              value={sessionCompletionNote}
            />
            <button disabled={isSessionBusy} type="submit">
              {t('start.closeSession')}
            </button>
          </form>
        ) : (
          <button disabled={isSessionBusy || !hasStartableAction} onClick={onStartSession} type="button">
            {t('start.startFocus')}
          </button>
        )}
      </div>
      <ul>
        {startModeView.checks.map((check) => (
          <li key={check}>
            <Activity aria-hidden="true" size={15} />
            {check}
          </li>
        ))}
      </ul>
      <form className="check-in-form" onSubmit={handleCheckInSubmit}>
        <div className="follow-up-prompts" aria-label={t('start.followUpPrompts')}>
          {followUpPrompts.map((prompt) => (
            <button disabled={isCheckInSaving} key={prompt} onClick={() => onCheckInDraftChange(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
        <label>
          {t('start.checkIn')}
          <textarea
            disabled={isCheckInSaving || !workspaceReady}
            onChange={(event) => onCheckInDraftChange(event.target.value)}
            placeholder={t('start.checkInPlaceholder')}
            value={checkInDraft}
          />
        </label>
        <button disabled={isCheckInSaving || !checkInDraft.trim() || !workspaceReady} type="submit">
          {t('start.saveCheckIn')}
        </button>
      </form>
      <CheckInHistory checkIns={checkIns} />
    </section>
  );
}

function CheckInHistory({ checkIns }: { checkIns: WorkbenchScreenCheckIn[] }) {
  const { t } = useTranslation('common');

  return (
    <div className="check-in-history" aria-label={t('start.savedFollowUps')}>
      <div>
        <span className="eyebrow">{t('start.history')}</span>
        <h3>{t('start.savedFollowUps')}</h3>
      </div>
      {checkIns.length === 0 ? (
        <p>{t('start.noCheckIns')}</p>
      ) : (
        <ul>
          {[...checkIns].reverse().map((checkIn) => (
            <li key={checkIn.id}>
              <p>{checkIn.body}</p>
              <span>{checkIn.nodeId ? t('start.linkedToNode') : t('start.workspaceNote')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
