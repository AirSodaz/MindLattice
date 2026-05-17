import {
  Background,
  Controls,
  Handle,
  ReactFlow,
  ReactFlowProvider,
  Position,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ReactFlowWorkbenchElements, ResolvedTheme, WorkbenchNodeKind } from '../workbenchModel';

export type WorkbenchFlowNodeData = {
  kind: WorkbenchNodeKind;
  title: string;
  status: string;
};

function WorkbenchFlowNode({ data, selected }: NodeProps<Node<WorkbenchFlowNodeData, 'workbenchNode'>>) {
  return (
    <div className={`map-node node-${data.kind} ${selected ? 'is-selected' : ''}`}>
      <Handle position={Position.Top} type="target" />
      <span>{data.status === 'Draft' ? `Draft ${data.kind.replace('_', ' ')}` : data.kind.replace('_', ' ')}</span>
      {data.title}
      <Handle position={Position.Bottom} type="source" />
    </div>
  );
}

const nodeTypes = {
  workbenchNode: WorkbenchFlowNode,
};

export type WorkbenchFlowProps = {
  elements: ReactFlowWorkbenchElements;
  resolvedTheme: ResolvedTheme;
  onNodeClick: (nodeId: string) => void;
  onNodeDragStop: OnNodeDrag<Node<WorkbenchFlowNodeData, 'workbenchNode'>>;
};

export function WorkbenchFlow({
  elements,
  onNodeClick,
  onNodeDragStop,
  resolvedTheme,
}: WorkbenchFlowProps) {
  return (
    <div className="canvas-plane">
      <ReactFlowProvider>
        <ReactFlow
          colorMode={resolvedTheme}
          edges={elements.edges}
          fitView
          minZoom={0.6}
          nodeTypes={nodeTypes}
          nodes={elements.nodes}
          nodesDraggable
          onNodeClick={(_event, node) => onNodeClick(node.id)}
          onNodeDragStop={onNodeDragStop}
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={42} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
