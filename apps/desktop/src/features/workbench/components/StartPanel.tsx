import { Activity } from 'lucide-react';
import type { FormEvent } from 'react';

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
    <section className="start-mode-surface" aria-label="Start panel">
      <div className="start-mode-header">
        <div>
          <span className="eyebrow">Start Mode</span>
          <h2>{startModeView.nextAction}</h2>
        </div>
        {onEnterFocusMode ? (
          <button disabled={!hasStartableAction} onClick={onEnterFocusMode} type="button">
            Enter Start Mode
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
        <span>{attentionSession ? 'Focus session active' : 'Ready to start'}</span>
        {startTimerState ? (
          <div className="timer-status" aria-label="Focus timer">
            <strong>{startTimerState.label}</strong>
            <span>
              {startTimerState.remainingMinutes > 0
                ? `${startTimerState.remainingMinutes} min left in this launch`
                : 'Launch window is open-ended'}
            </span>
          </div>
        ) : null}
        {attentionSession ? (
          <form onSubmit={handleCloseSubmit}>
            <input
              disabled={isSessionBusy}
              onChange={(event) => onSessionCompletionNoteChange(event.target.value)}
              placeholder="What changed or where to resume?"
              value={sessionCompletionNote}
            />
            <button disabled={isSessionBusy} type="submit">
              Close session
            </button>
          </form>
        ) : (
          <button disabled={isSessionBusy || !hasStartableAction} onClick={onStartSession} type="button">
            Start focus
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
        <div className="follow-up-prompts" aria-label="Follow-up prompts">
          {followUpPrompts.map((prompt) => (
            <button disabled={isCheckInSaving} key={prompt} onClick={() => onCheckInDraftChange(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
        <label>
          Check-in
          <textarea
            disabled={isCheckInSaving || !workspaceReady}
            onChange={(event) => onCheckInDraftChange(event.target.value)}
            placeholder="Did you start, where did it get stuck, or what should stay visible next?"
            value={checkInDraft}
          />
        </label>
        <button disabled={isCheckInSaving || !checkInDraft.trim() || !workspaceReady} type="submit">
          Save check-in
        </button>
      </form>
      <CheckInHistory checkIns={checkIns} />
    </section>
  );
}

function CheckInHistory({ checkIns }: { checkIns: WorkbenchScreenCheckIn[] }) {
  return (
    <div className="check-in-history" aria-label="Saved check-ins">
      <div>
        <span className="eyebrow">Check-in history</span>
        <h3>Saved follow-ups</h3>
      </div>
      {checkIns.length === 0 ? (
        <p>No check-ins saved yet.</p>
      ) : (
        <ul>
          {[...checkIns].reverse().map((checkIn) => (
            <li key={checkIn.id}>
              <p>{checkIn.body}</p>
              <span>{checkIn.nodeId ? 'Linked to current map item' : 'Workspace note'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
