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
import { Button } from '../../../shared/ui';

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
          <Button
            className={hasActivePreview ? 'has-preview' : ''}
            disabled={!hasActivePreview}
            onClick={onOpenPreview}
            type="button"
            variant={hasActivePreview ? 'draft' : 'secondary'}
          >
            Preview
          </Button>
          <Button disabled={!selectedNode} onClick={onOpenAdvancedMap} type="button" variant="secondary">
            Advanced map
          </Button>
          <Button
            disabled={!workbench.nodes.some((node) => node.kind === 'next_action')}
            onClick={onOpenStart}
            type="button"
            variant="secondary"
          >
            Start
          </Button>
          <Button onClick={() => onOpenTaskPanel('support')} type="button" variant="ghost">
            Support
          </Button>
          <Button onClick={() => onOpenTaskPanel('memory')} type="button" variant="ghost">
            Memory
          </Button>
          <Button onClick={() => onOpenTaskPanel('vault')} type="button" variant="ghost">
            Vault
          </Button>
          <Button onClick={() => onOpenTaskPanel('settings')} type="button" variant="ghost">
            Settings
          </Button>
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
        <Button
          className="preview-chip"
          icon={<CircleDot aria-hidden="true" size={16} />}
          onClick={onOpenPreview}
          type="button"
          variant="draft"
        >
          Active preview ready for review
        </Button>
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
