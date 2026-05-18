import type { FormEvent } from 'react';

import { Button, Surface } from '../../../shared/ui';
import type { WorkbenchEdge, WorkbenchNode, WorkbenchNodeKind } from '../workbenchModel';

export type AdvancedMapPanelProps = {
  edgeKind: string;
  edgeKindOptions: Array<{ value: string; label: string }>;
  edgeSourceId: string;
  edgeTargetId: string;
  isEdgeSaving: boolean;
  isNodeSaving: boolean;
  newNodeKind: WorkbenchNodeKind;
  newNodeTitle: string;
  nodeBodyDraft: string;
  nodeTitleDraft: string;
  nodes: WorkbenchNode[];
  edges: WorkbenchEdge[];
  selectedNode: WorkbenchNode | undefined;
  surroundingNodeOptions: Array<{ value: WorkbenchNodeKind; label: string }>;
  onAddConnectedNode: () => void;
  onConnectNodes: () => void;
  onEdgeKindChange: (value: string) => void;
  onEdgeSourceIdChange: (value: string) => void;
  onEdgeTargetIdChange: (value: string) => void;
  onNewNodeKindChange: (value: WorkbenchNodeKind) => void;
  onNewNodeTitleChange: (value: string) => void;
  onNodeBodyDraftChange: (value: string) => void;
  onNodeTitleDraftChange: (value: string) => void;
  onSaveSelectedNode: () => void;
};

export function AdvancedMapPanel({
  edgeKind,
  edgeKindOptions,
  edgeSourceId,
  edgeTargetId,
  edges,
  isEdgeSaving,
  isNodeSaving,
  newNodeKind,
  newNodeTitle,
  nodeBodyDraft,
  nodeTitleDraft,
  nodes,
  onAddConnectedNode,
  onConnectNodes,
  onEdgeKindChange,
  onEdgeSourceIdChange,
  onEdgeTargetIdChange,
  onNewNodeKindChange,
  onNewNodeTitleChange,
  onNodeBodyDraftChange,
  onNodeTitleDraftChange,
  onSaveSelectedNode,
  selectedNode,
  surroundingNodeOptions,
}: AdvancedMapPanelProps) {
  const handleSaveSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveSelectedNode();
  };
  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isNodeSaving || !selectedNode || !newNodeTitle.trim()) {
      return;
    }
    onAddConnectedNode();
  };
  const handleConnectSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isEdgeSaving || !edgeSourceId || !edgeTargetId || edgeSourceId === edgeTargetId) {
      return;
    }
    onConnectNodes();
  };

  return (
    <Surface
      className="inspector-surface"
      tone="default"
      eyebrow="Advanced map"
      title={selectedNode?.title ?? 'No selection'}
      aria-label="Advanced map editing"
    >
      <form className="node-editor" onSubmit={handleSaveSubmit}>
        <label>
          Title
          <input
            disabled={!selectedNode || isNodeSaving}
            onChange={(event) => onNodeTitleDraftChange(event.target.value)}
            value={nodeTitleDraft}
          />
        </label>
        <label>
          Body
          <textarea
            disabled={!selectedNode || isNodeSaving}
            onChange={(event) => onNodeBodyDraftChange(event.target.value)}
            value={nodeBodyDraft}
          />
        </label>
        <Button disabled={!selectedNode || isNodeSaving || !nodeTitleDraft.trim()} type="submit" variant="primary">
          Save node
        </Button>
      </form>
      <form className="node-editor compact" onSubmit={handleAddSubmit}>
        <label>
          Add nearby
          <select
            disabled={!selectedNode || isNodeSaving}
            onChange={(event) => onNewNodeKindChange(event.target.value as WorkbenchNodeKind)}
            value={newNodeKind}
          >
            {surroundingNodeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            disabled={!selectedNode || isNodeSaving}
            onChange={(event) => onNewNodeTitleChange(event.target.value)}
            placeholder="Name the nearby node"
            value={newNodeTitle}
          />
        </label>
        <Button disabled={!selectedNode || isNodeSaving || !newNodeTitle.trim()} type="submit" variant="secondary">
          Add node
        </Button>
      </form>
      <form className="node-editor compact" onSubmit={handleConnectSubmit}>
        <label>
          Connect from
          <select
            disabled={isEdgeSaving || nodes.length < 2}
            onChange={(event) => onEdgeSourceIdChange(event.target.value)}
            value={edgeSourceId}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Connect to
          <select
            disabled={isEdgeSaving || nodes.length < 2}
            onChange={(event) => onEdgeTargetIdChange(event.target.value)}
            value={edgeTargetId}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Relationship
          <select disabled={isEdgeSaving} onChange={(event) => onEdgeKindChange(event.target.value)} value={edgeKind}>
            {edgeKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={isEdgeSaving || nodes.length < 2 || !edgeSourceId || !edgeTargetId || edgeSourceId === edgeTargetId}
          type="submit"
          variant="secondary"
        >
          Connect nodes
        </Button>
      </form>
      {edges.length > 0 ? (
        <div className="edge-list" aria-label="Current connections">
          {edges.map((edge) => {
            const source = nodes.find((node) => node.id === edge.sourceId);
            const target = nodes.find((node) => node.id === edge.targetId);
            return (
              <p key={edge.id}>
                <span>{edge.kind.replaceAll('_', ' ')}</span>
                {source?.title ?? edge.sourceId}
                {' -> '}
                {target?.title ?? edge.targetId}
              </p>
            );
          })}
        </div>
      ) : null}
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{selectedNode?.status ?? 'Draft'}</dd>
        </div>
        <div>
          <dt>Minimum done</dt>
          <dd>{selectedNode?.minimumDone ?? 'Define the smallest visible finish line.'}</dd>
        </div>
        <div>
          <dt>Estimate</dt>
          <dd>{selectedNode?.estimateMinutes ? `${selectedNode.estimateMinutes} min` : 'Unset'}</dd>
        </div>
      </dl>
    </Surface>
  );
}
