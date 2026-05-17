import { CircleDot } from 'lucide-react';
import type { Node, OnNodeDrag } from '@xyflow/react';

import type {
  ReactFlowWorkbenchElements,
  ResolvedTheme,
  StartModeView,
  WorkbenchModel,
  WorkbenchNode,
} from '../workbenchModel';
import { WorkbenchFlow, type WorkbenchFlowNodeData } from './WorkbenchFlow';

export type TurnCanvasPanelProps = {
  elements: ReactFlowWorkbenchElements;
  focusTaskTitle: string;
  hasActivePreview: boolean;
  resolvedTheme: ResolvedTheme;
  selectedNode: WorkbenchNode | undefined;
  startModeView: StartModeView;
  workbench: WorkbenchModel;
  onNodeClick: (nodeId: string) => void;
  onNodeDragStop: OnNodeDrag<Node<WorkbenchFlowNodeData, 'workbenchNode'>>;
  onOpenAdvancedMap: () => void;
  onOpenPreview: () => void;
  onOpenStart: () => void;
  onOpenTaskPanel: (panel: 'support' | 'memory' | 'vault' | 'settings') => void;
};

export function TurnCanvasPanel({
  elements,
  focusTaskTitle,
  hasActivePreview,
  onNodeClick,
  onNodeDragStop,
  onOpenAdvancedMap,
  onOpenPreview,
  onOpenStart,
  onOpenTaskPanel,
  resolvedTheme,
  selectedNode,
  startModeView,
  workbench,
}: TurnCanvasPanelProps) {
  return (
    <section className="map-workspace" aria-label="Star-map canvas">
      <header className="workspace-toolbar">
        <div>
          <span className="eyebrow">Turn context</span>
          <h2>{focusTaskTitle}</h2>
        </div>
        <div className="workspace-actions" aria-label="Workspace tools">
          <button className={hasActivePreview ? 'has-preview' : ''} disabled={!hasActivePreview} onClick={onOpenPreview} type="button">
            Preview
          </button>
          <button disabled={!selectedNode} onClick={onOpenAdvancedMap} type="button">
            Advanced map
          </button>
          <button disabled={!workbench.nodes.some((node) => node.kind === 'next_action')} onClick={onOpenStart} type="button">
            Start
          </button>
          <button onClick={() => onOpenTaskPanel('support')} type="button">
            Support
          </button>
          <button onClick={() => onOpenTaskPanel('memory')} type="button">
            Memory
          </button>
          <button onClick={() => onOpenTaskPanel('vault')} type="button">
            Vault
          </button>
          <button onClick={() => onOpenTaskPanel('settings')} type="button">
            Settings
          </button>
        </div>
      </header>

      <section className="focus-summary" aria-label="Current focus summary">
        <div>
          <span className="eyebrow">Current focus</span>
          <h3>{selectedNode?.title ?? focusTaskTitle}</h3>
        </div>
        <dl>
          <div>
            <dt>Next action</dt>
            <dd>{startModeView.nextAction}</dd>
          </div>
          <div>
            <dt>Minimum done</dt>
            <dd>{startModeView.minimumDone}</dd>
          </div>
        </dl>
      </section>

      {hasActivePreview ? (
        <button className="preview-chip" onClick={onOpenPreview} type="button">
          <CircleDot aria-hidden="true" size={16} />
          Active preview ready for review
        </button>
      ) : null}

      <WorkbenchFlow
        elements={elements}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        resolvedTheme={resolvedTheme}
      />
    </section>
  );
}
