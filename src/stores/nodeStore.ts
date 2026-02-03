import type { SlotType } from "../litegraph/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type NodePort = {
  name: string;
  type: SlotType;
};

export enum NodePropertyType {
  textarea = "textarea",
  inputNumber = "inputNumber",
  checkGroup = "checkGroup",
  select = "select",
  switch = "switch",
}

export type NodeProperty<T> = {
  label: string;
  name: string;
  type: NodePropertyType;
  default: T;
  options?: { name: string; value: unknown }[];
  max?: number;
  min?: number;
};

export type NodeSnapshot = {
  id: number;
  category?: string;
  executionId: string;
  title?: string;
  size?: [number, number];
  inputs?: NodePort[];
  outputs?: NodePort[];
  properties?: NodeProperty<unknown>[];
};

const toNodeMap = (nodes: NodeSnapshot[]) =>
  nodes.reduce<Record<number, NodeSnapshot>>((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {});

type NodeStore = {
  nodes: Record<number, NodeSnapshot>;
  nextNodeId: number;
  setNodes: (nodes: NodeSnapshot[]) => void;
  addNodeDefinition: (node: Omit<NodeSnapshot, "id">) => NodeSnapshot;
  updateNodeDefinition: (nodeId: number, node: Omit<NodeSnapshot, "id">) => NodeSnapshot | null;
};

export const useNodeStore = create<NodeStore>()(
  devtools(
    (set) => ({
      nodes: {},
      nextNodeId: 1,
      setNodes: (nodes) => {
        const nextId =
          nodes.length > 0 ? Math.max(...nodes.map((node) => node.id)) + 1 : 1;
        set({ nodes: toNodeMap(nodes), nextNodeId: nextId }, false, "node/setNodes");
      },
      addNodeDefinition: (node) => {
        let created: NodeSnapshot | null = null;
        set(
          (state) => {
            const nextId = state.nextNodeId;
            created = { ...node, id: nextId };
            return {
              nodes: { ...state.nodes, [nextId]: created },
              nextNodeId: nextId + 1,
            };
          },
          false,
          "node/addNodeDefinition"
        );
        if (!created) {
          throw new Error("Node definition creation failed");
        }
        return created;
      },
      updateNodeDefinition: (nodeId, node) => {
        let updated: NodeSnapshot | null = null;
        set(
          (state) => {
            const existing = state.nodes[nodeId];
            if (!existing) {
              return state;
            }
            updated = { ...existing, ...node, id: nodeId };
            return {
              nodes: { ...state.nodes, [nodeId]: updated },
            };
          },
          false,
          "node/updateNodeDefinition"
        );
        return updated;
      },
    }),
    { name: "NodeStore" }
  )
);


export const getNodeDefaultProperties = (node: NodeSnapshot) =>
  (node.properties ?? []).reduce<Record<string, unknown>>((acc, prop) => {
    acc[prop.name] = prop.default;
    return acc;
  }, {});


