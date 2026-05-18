import { Check, Circle } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import '../../../shared/i18n/i18n';
import { Button, Surface } from '../../../shared/ui';
import type {
  ActiveAttentionSession,
  StartModeView,
  StartTimerState,
  WorkbenchScreenCheckIn,
} from './types';
import type { ReturnContext } from '../workbenchModel';

export type StartPanelProps = {
  attentionSession: ActiveAttentionSession | null;
  checkInDraft: string;
  checkIns: WorkbenchScreenCheckIn[];
  followUpPrompts: string[];
  hasStartableAction: boolean;
  isCheckInSaving: boolean;
  isSessionBusy: boolean;
  returnContext?: ReturnContext | null;
  sessionCompletionNote: string;
  startModeView: StartModeView;
  startTimerState: StartTimerState | null;
  workspaceReady: boolean;
  onCheckInDraftChange: (value: string) => void;
  onCloseSession: () => void;
  onEnterFocusMode?: () => void;
  onRequestSmallerAction?: () => void;
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
  onRequestSmallerAction,
  onSaveCheckIn,
  onSessionCompletionNoteChange,
  onStartSession,
  sessionCompletionNote,
  returnContext,
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
    <Surface
      className="start-mode-surface"
      tone="start"
      eyebrow={t('start.title')}
      title={startModeView.nextAction}
      actions={
        onEnterFocusMode ? (
          <Button disabled={!hasStartableAction} onClick={onEnterFocusMode} type="button" variant="secondary">
            {t('start.enter')}
          </Button>
        ) : null
      }
      aria-label={t('start.aria')}
    >
      <p>{startModeView.minimumDone}</p>
      {returnContext ? (
        <div className="return-context" aria-label="Return context">
          <span className="eyebrow">Return context</span>
          <dl>
            <div>
              <dt>Next action</dt>
              <dd>{returnContext.nextAction}</dd>
            </div>
            {returnContext.blocker ? (
              <div>
                <dt>Blocker</dt>
                <dd>{returnContext.blocker}</dd>
              </div>
            ) : null}
            <div>
              <dt>Return cue</dt>
              <dd>{returnContext.returnCue}</dd>
            </div>
            {returnContext.supportResult ? (
              <div>
                <dt>Support result</dt>
                <dd>{returnContext.supportResult}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
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
            <Button disabled={isSessionBusy} type="submit" variant="primary">
              {t('start.closeSession')}
            </Button>
          </form>
        ) : (
          <Button disabled={isSessionBusy || !hasStartableAction} onClick={onStartSession} type="button" variant="primary">
            {t('start.startFiveMinutes')}
          </Button>
        )}
        {onRequestSmallerAction ? (
          <Button
            disabled={isSessionBusy || !hasStartableAction}
            onClick={onRequestSmallerAction}
            type="button"
            variant="secondary"
          >
            {t('start.makeSmaller')}
          </Button>
        ) : null}
        <Button disabled={!hasStartableAction} type="button" variant="secondary">
          {t('start.leaveReturnCue')}
        </Button>
      </div>
      <ul className="start-check-list" aria-label={t('start.startCheck')}>
        {startModeView.checks.map((check) => (
          <li className="ml-list-item start-check-row" key={check.label}>
            {check.checked ? <Check aria-hidden="true" size={15} /> : <Circle aria-hidden="true" size={15} />}
            <span>{check.label}</span>
            <strong>{check.value}</strong>
          </li>
        ))}
      </ul>
      <form className="check-in-form" onSubmit={handleCheckInSubmit}>
        <div className="follow-up-prompts" aria-label={t('start.followUpPrompts')}>
          {followUpPrompts.map((prompt) => (
            <Button
              disabled={isCheckInSaving}
              key={prompt}
              onClick={() => onCheckInDraftChange(prompt)}
              size="small"
              type="button"
              variant="ghost"
            >
              {prompt}
            </Button>
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
        <Button disabled={isCheckInSaving || !checkInDraft.trim() || !workspaceReady} type="submit" variant="secondary">
          {t('start.saveCheckIn')}
        </Button>
      </form>
      <CheckInHistory checkIns={checkIns} />
    </Surface>
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
