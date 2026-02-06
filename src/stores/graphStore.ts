import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { NodeSnapshot } from "./nodeStore";
import { getNodeDefaultProperties, useNodeStore } from "./nodeStore";
import { useWorkflowStore } from "./workflowStore";

export type GraphNodeSnapshot = {
  id: string;
  nodeId: number;
  executionId: string;
  title?: string;
  pos: [number, number];
  properties?: Record<string, unknown>;
};

export type GraphLink = {
  fromNodeId: string;
  fromSlot: number;
  toNodeId: string;
  toSlot: number;
};

export type GraphConfig = {
  nodes: GraphNodeSnapshot[];
  links: GraphLink[];
  name?: string;
};

type GraphStore = {
  name: string;
  nodes: GraphNodeSnapshot[];
  links: GraphLink[];
  editing: boolean;
  setGraph: (nodes: GraphNodeSnapshot[], links: GraphLink[], name?: string) => void;
  addNode: (node: Omit<GraphNodeSnapshot, "id">) => GraphNodeSnapshot;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, pos: [number, number]) => void;
  updateNodeProperty: (nodeId: string, propertyName: string, value: unknown) => void;
  updateNodesByDefinition: (definition: NodeSnapshot) => void;
  addLink: (link: GraphLink) => void;
  removeLink: (link: GraphLink) => void;
  setEditing: (editing: boolean) => void;
  onReset: () => void;
};

export const useGraphStore = create<GraphStore>()(
  devtools(
    (set) => ({
      name: "",
      nodes: [],
      links: [],
      editing: true,
      setEditing: (editing) => set({ editing }, false, "graph/setEditing"),
      setGraph: (nodes, links, name) =>
        set(
          (state) => ({ nodes, links, name: name ?? state.name }),
          false,
          "graph/setGraph"
        ),
      addNode: (node) => {
        let created: GraphNodeSnapshot | null = null;
        set(
          (state) => {
            const nextId = uuidv4();
            created = { ...node, id: nextId };
            return {
              nodes: [...state.nodes, created],
            };
          },
          false,
          "graph/addNode"
        );
        if (!created) {
          throw new Error("Graph node creation failed");
        }
        return created;
      },
      removeNode: (nodeId) =>
        set(
          (state) => ({
            nodes: state.nodes.filter((node) => node.id !== nodeId),
            links: state.links.filter(
              (link) => link.fromNodeId !== nodeId && link.toNodeId !== nodeId
            ),
          }),
          false,
          "graph/removeNode"
        ),
      updateNodePosition: (nodeId, pos) =>
        set(
          (state) => ({
            nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, pos } : node)),
          }),
          false,
          "graph/updateNodePosition"
        ),
      updateNodeProperty: (nodeId, propertyName, value) =>
        set(
          (state) => ({
            nodes: state.nodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    properties: { ...(node.properties ?? {}), [propertyName]: value },
                  }
                : node
            ),
          }),
          false,
          "graph/updateNodeProperty"
        ),
      updateNodesByDefinition: (definition) =>
        set(
          (state) => {
            const defaultProperties = getNodeDefaultProperties(definition);
            const nextNodes = state.nodes.map((node) => {
              if (node.nodeId !== definition.id) {
                return node;
              }
              const nextProperties = (definition.properties ?? []).reduce<Record<string, unknown>>(
                (acc, prop) => {
                  acc[prop.name] = (node.properties ?? {})[prop.name] ?? defaultProperties[prop.name];
                  return acc;
                },
                {}
              );
              return {
                ...node,
                executionId: definition.executionId,
                title: definition.title,
                properties: definition.properties ? nextProperties : undefined,
              };
            });

            const nodeDefinitions = useNodeStore.getState().nodes;
            const nodePortMap = new Map<
              string,
              { inputs: NodeSnapshot["inputs"]; outputs: NodeSnapshot["outputs"] }
            >();
            nextNodes.forEach((node) => {
              nodePortMap.set(node.id, {
                inputs: nodeDefinitions[node.nodeId]?.inputs ?? [],
                outputs: nodeDefinitions[node.nodeId]?.outputs ?? [],
              });
            });

            const nextLinks = state.links.filter((link) => {
              const fromPorts = nodePortMap.get(link.fromNodeId);
              const toPorts = nodePortMap.get(link.toNodeId);
              if (!fromPorts || !toPorts) {
                return false;
              }
              const fromOutput = fromPorts.outputs?.[link.fromSlot];
              const toInput = toPorts.inputs?.[link.toSlot];
              if (!fromOutput || !toInput) {
                return false;
              }
              return fromOutput.type === toInput.type;
            });

            return { nodes: nextNodes, links: nextLinks };
          },
          false,
          "graph/updateNodesByDefinition"
        ),
      addLink: (link) =>
        set(
          (state) => {
            const exists = state.links.some(
              (item) =>
                item.fromNodeId === link.fromNodeId &&
                item.fromSlot === link.fromSlot &&
                item.toNodeId === link.toNodeId &&
                item.toSlot === link.toSlot
            );
            if (exists) {
              return state;
            }
            return { links: [...state.links, link] };
          },
          false,
          "graph/addLink"
        ),
      removeLink: (link) =>
        set(
          (state) => ({
            links: state.links.filter(
              (item) =>
                !(
                  item.fromNodeId === link.fromNodeId &&
                  item.fromSlot === link.fromSlot &&
                  item.toNodeId === link.toNodeId &&
                  item.toSlot === link.toSlot
                )
            ),
          }),
          false,
          "graph/removeLink"
        ),
      onReset: () => {
        const workflow = useWorkflowStore.getState();
        workflow.onStop();
        useWorkflowStore.setState({
          nodes: [],
          links: [],
          pendingInputs: [],
          workflowStatus: "stopped",
        });
      },
    }),
    { name: "GraphStore" }
  )
);

