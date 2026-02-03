import { useEffect, useRef, useState } from "react";
import { FiLoader } from "react-icons/fi";
import { NodeConfigModal } from "./components/NodeConfigModal";
import { PropertyEditModal } from "./components/PropertyEditModal";
import { Sidebar } from "./components/Sidebar";
import { NodeToolbar } from "./components/NodeToolbar";
import { createGraphSession } from "./litegraph/graphSession";
import { getInitialGraph, getInitialNodes } from "./services/api";
import { useGraphStore } from "./stores/graphStore";
import type { NodeProperty } from "./stores/nodeStore";
import { useNodeStore } from "./stores/nodeStore";

const CANVAS_ID = "graph-canvas";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphApiRef = useRef<{
    addNodeAtCenter: (nodeId: number) => void;
    removeNode: (graphNodeId: string) => void;
    updateNodeProperty: (graphNodeId: string, propertyName: string, value: unknown) => void;
    syncNodeDefinition: (definitionId: number) => void;
    destroy: () => void;
  } | null>(null);
  const [isCreateNodeOpen, setIsCreateNodeOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nodeToolbar, setNodeToolbar] = useState<{
    rect: { x: number; y: number; width: number; height: number };
    node: { id: string; nodeId?: number; title?: string; executionId: string };
  } | null>(null);
  const [propertyEditor, setPropertyEditor] = useState<{
    nodeId: string;
    nodeTitle: string;
    property: NodeProperty<unknown>;
    value: unknown;
  } | null>(null);
  const setGraph = useGraphStore((state) => state.setGraph);
  const updateNodesByDefinition = useGraphStore((state) => state.updateNodesByDefinition);
  const setNodes = useNodeStore((state) => state.setNodes);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    let isMounted = true;
    const bootstrap = async () => {
      try {
        const [graph, nodes] = await Promise.all([getInitialGraph(), getInitialNodes()]);
        if (!isMounted) {
          return;
        }
        setNodes(nodes);
        setGraph(graph.nodes, graph.links);
        const graphApi = createGraphSession(canvas, {
          onSelectionChange: (selection) => {
            if (!selection) {
              setNodeToolbar(null);
              return;
            }
            setNodeToolbar({
              rect: selection.rect,
              node: {
                id: selection.node.id,
                nodeId: selection.node.nodeId,
                title: selection.node.title,
                executionId: selection.node.executionId,
              },
            });
          },
          onPropertyClick: (payload) => {
            setPropertyEditor({
              nodeId: payload.node.id,
              nodeTitle: payload.node.title ?? payload.node.executionId,
              property: payload.property,
              value: payload.value,
            });
          },
        });
        graphApiRef.current = graphApi;
        setIsLoading(false);
      } catch (error) {
        console.error("[App] Failed to load initial data", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      graphApiRef.current?.destroy();
      graphApiRef.current = null;
    };
  }, [setGraph, setNodes]);

  return (
    <div className="app-shell" ref={containerRef}>
      <Sidebar
        onAddNode={(nodeId: number) => graphApiRef.current?.addNodeAtCenter(nodeId)}
        onOpenCreateNode={() => setIsCreateNodeOpen(true)}
      />
      <main className="main-content">
        <canvas id={CANVAS_ID} className="graph-canvas" />
        {nodeToolbar ? (
          <NodeToolbar
            position={{ x: nodeToolbar.rect.x, y: nodeToolbar.rect.y }}
            node={nodeToolbar.node}
            onDelete={() => graphApiRef.current?.removeNode(nodeToolbar.node.id)}
            onEdit={() => {
              if (!nodeToolbar.node.nodeId) {
                setIsCreateNodeOpen(true);
                return;
              }
              setEditingNodeId(nodeToolbar.node.nodeId);
            }}
          />
        ) : null}
        {isLoading ? (
          <div className="loading-overlay">
            <FiLoader className="loading-spinner" />
            <span>加载中...</span>
          </div>
        ) : null}
      </main>
      <NodeConfigModal
        isOpen={isCreateNodeOpen || editingNodeId !== null}
        editingNodeId={editingNodeId}
        onClose={() => {
          setIsCreateNodeOpen(false);
          setEditingNodeId(null);
        }}
        onSave={(node) => {
          if (!editingNodeId || node.id !== editingNodeId) {
            return;
          }
          updateNodesByDefinition(node);
          graphApiRef.current?.syncNodeDefinition(node.id);
        }}
      />
      <PropertyEditModal
        isOpen={propertyEditor !== null}
        nodeTitle={propertyEditor?.nodeTitle ?? ""}
        property={propertyEditor?.property ?? null}
        value={propertyEditor?.value}
        onClose={() => setPropertyEditor(null)}
        onSave={(value) => {
          if (!propertyEditor) {
            return;
          }
          graphApiRef.current?.updateNodeProperty(
            propertyEditor.nodeId,
            propertyEditor.property.name,
            value
          );
          setPropertyEditor(null);
        }}
      />
    </div>
  );
}

