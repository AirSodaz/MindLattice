import type { ReactNode } from 'react';

import { type RightPaneMode, type WorkbenchTaskPanel } from '../workbenchModel';

export type TurnContextPaneProps = {
  mode: RightPaneMode;
  taskPanel: WorkbenchTaskPanel;
  advancedMap: ReactNode;
  canvas: ReactNode;
  empty: ReactNode;
  preview: ReactNode;
  setup: ReactNode;
  start: ReactNode;
  taskPanels: ReactNode;
  onBackToCanvas?: () => void;
};

export function TurnContextPane({
  advancedMap,
  canvas,
  empty,
  mode,
  preview,
  setup,
  start,
  onBackToCanvas,
  taskPanel,
  taskPanels,
}: TurnContextPaneProps) {
  const title = mode === 'task_panel' ? taskPanelTitle(taskPanel) : paneTitle(mode);
  const canReturnToCanvas = mode === 'advanced_map' || mode === 'start' || mode === 'task_panel';
  return (
    <section className={`turn-context-pane turn-context-pane-${mode}`} aria-label="Turn context pane">
      <div className="turn-context-heading">
        <div>
          <span className="eyebrow">Right pane</span>
          <h2>{title}</h2>
        </div>
        {canReturnToCanvas && onBackToCanvas ? (
          <button className="secondary" onClick={onBackToCanvas} type="button">
            Back to canvas
          </button>
        ) : null}
      </div>
      {mode === 'setup' ? setup : null}
      {mode === 'preview' ? preview : null}
      {mode === 'canvas' ? canvas : null}
      {mode === 'start' ? start : null}
      {mode === 'advanced_map' ? advancedMap : null}
      {mode === 'task_panel' ? taskPanels : null}
      {mode === 'empty' ? empty : null}
      {mode === 'safety' ? (
        <section className="safety-surface">
          <span className="eyebrow">Safety</span>
          <h2>Not saved</h2>
          <p>This turn cannot create ordinary task advice. Nothing was persisted.</p>
        </section>
      ) : null}
    </section>
  );
}

function taskPanelTitle(taskPanel: WorkbenchTaskPanel): string {
  const titles: Record<Exclude<WorkbenchTaskPanel, null>, string> = {
    support: 'Support templates',
    memory: 'Preference memory',
    vault: 'Vault import/export',
    settings: 'Settings',
    diagnostics: 'Diagnostics',
  };
  return taskPanel ? titles[taskPanel] : 'Task panel';
}

function paneTitle(mode: RightPaneMode): string {
  const titles: Record<RightPaneMode, string> = {
    setup: 'Provider setup',
    empty: 'Current turn',
    preview: 'Preview review',
    canvas: 'Turn canvas',
    start: 'Start',
    safety: 'Safety redirect',
    advanced_map: 'Advanced map',
    task_panel: 'Task panel',
  };
  return titles[mode];
}
