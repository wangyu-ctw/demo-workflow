import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { execute } from "../services/api";
import type { GraphLink, GraphNodeSnapshot } from "./graphStore";
import { useGraphStore } from "./graphStore";
import type { NodeSnapshot } from "./nodeStore";
import { getNodeDefaultProperties, useNodeStore } from "./nodeStore";
import type { InputForm, WorkflowLink, WorkflowNodeSnapshot } from "../types/workflow";
import { WorkflowStatus } from "../types/workflow";

type PendingInputItem = {
  nodeId: string;
  nodeName: string;
  form: InputForm[];
  status: "pending" | "done" | "waiting";
  formValue?: Record<string, any>;
};

type FillWorkflowInputs = (options: {
  nodeId: string;
  nodeName: string;
  inputForms: InputForm[];
  formValue?: Record<string, any>;
}) => Promise<{ nodeId: string; values: Record<string, any> }>;

type WorkflowRun = {
  fillWorkflowInputs: FillWorkflowInputs;
  incoming: Map<string, GraphLink[]>;
  outgoing: Map<string, GraphLink[]>;
  remainingDeps: Map<string, number>;
  results: Map<string, unknown>;
  queue: string[];
  isRunning: boolean;
  running: Set<string>;
  nodeDefinitions: Record<number, NodeSnapshot>;
  runQueue?: () => Promise<void>;
};

let activeRun: WorkflowRun | null = null;

type WorkflowStore = {
  nodes: WorkflowNodeSnapshot[];
  links: WorkflowLink[];
  pendingInputs: PendingInputItem[];
  workflowStatus: "stopped" | "progressing" | "paused";
  fillWorkflowInputs?: FillWorkflowInputs;
  setFillWorkflowInputs: (fill: FillWorkflowInputs) => void;
  executeNode: (payload: {
    executeId: number;
    inputFormValues: Record<string, unknown>;
    propertyValues: Record<string, unknown>;
  }) => Promise<unknown>;
  executeWorkflow: () => Promise<void>;
  onRun: () => Promise<void>;
  onPause: () => void;
  onStop: () => void;
  retryNodeInput: (nodeId: string) => Promise<void>;
};

export const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    (set, get): WorkflowStore => ({
      nodes: [],
      links: [],
      pendingInputs: [],
      workflowStatus: "stopped",
      setFillWorkflowInputs: (fill) => {
        activeRun = activeRun ? { ...activeRun, fillWorkflowInputs: fill } : null;
        set({ fillWorkflowInputs: fill });
      },
      fillWorkflowInputs: undefined,
      executeNode: ({ executeId, inputFormValues, propertyValues }) =>
        execute(executeId, { inputFormValues, propertyValues }),
      executeWorkflow: async () => {
        const graphState = useGraphStore.getState();
        const nodeDefinitions = useNodeStore.getState().nodes;
        const workflowNodes: WorkflowNodeSnapshot[] = graphState.nodes.map((node) => ({
          ...node,
          status: WorkflowStatus.PENDING,
          inputFormValues: {},
          propertyValues: resolvePropertyValues(node, nodeDefinitions),
          outputValue: undefined,
        }));
        const workflowLinks: WorkflowLink[] = graphState.links.map((link) => ({
          ...link,
          status: WorkflowStatus.PENDING,
        }));
        set({
          nodes: workflowNodes,
          links: workflowLinks,
          pendingInputs: [],
          workflowStatus: "progressing",
        });

        const incoming = new Map<string, GraphLink[]>();
        const outgoing = new Map<string, GraphLink[]>();
        graphState.nodes.forEach((node) => {
          incoming.set(node.id, []);
          outgoing.set(node.id, []);
        });
        graphState.links.forEach((link) => {
          incoming.get(link.toNodeId)?.push(link);
          outgoing.get(link.fromNodeId)?.push(link);
        });
        const remainingDeps = new Map<string, number>();
        graphState.nodes.forEach((node) => {
          remainingDeps.set(node.id, incoming.get(node.id)?.length ?? 0);
        });

        const fillWorkflowInputs = get().fillWorkflowInputs ?? (async () => ({ nodeId: "", values: {} }));
        const run: WorkflowRun = {
          fillWorkflowInputs,
          incoming,
          outgoing,
          remainingDeps,
          results: new Map<string, unknown>(),
          queue: [],
          isRunning: true,
          running: new Set<string>(),
          nodeDefinitions,
        };
        activeRun = run;

        const runNode = async (nodeId: string) => {
          if (!activeRun || !activeRun.isRunning) {
            return;
          }
          if (activeRun.running.has(nodeId)) {
            return;
          }
          const state = get();
          const workflowNode = state.nodes.find((node) => node.id === nodeId);
          if (!workflowNode) {
            return;
          }
          const incomingLinks = activeRun.incoming.get(nodeId) ?? [];
          const nodeInputs = getNodeInputs(workflowNode, activeRun.nodeDefinitions);
          const needsInput =
            incomingLinks.length === 0 &&
            nodeInputs.length > 0 &&
            Object.keys(workflowNode.inputFormValues ?? {}).length === 0;
          if (needsInput) {
            set((prev) => ({
              nodes: prev.nodes.map((node) =>
                node.id === nodeId ? { ...node, status: WorkflowStatus.WAITING } : node
              ),
              pendingInputs: upsertPendingInput(prev.pendingInputs, {
                nodeId,
                nodeName: workflowNode.title ?? workflowNode.executionId,
                form: [nodeInputs],
                status: "waiting",
                formValue: workflowNode.inputFormValues,
              }),
            }));
            return;
          }

          activeRun.running.add(nodeId);
          const inputFormValues = resolveInputValues(nodeInputs, workflowNode.inputFormValues, incomingLinks, activeRun.results);
          const propertyValues = workflowNode.propertyValues ?? {};
          set((prev) => ({
            nodes: prev.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, status: WorkflowStatus.PROGRESSING, propertyValues, inputFormValues: workflowNode.inputFormValues }
                : node
            ),
            links: prev.links.map((link) =>
              link.fromNodeId === nodeId ? { ...link, status: WorkflowStatus.PROGRESSING } : link
            ),
          }));

          try {
            const executeId = workflowNode.nodeId ?? 0;
            const outputValue = await get().executeNode({
              executeId,
              inputFormValues,
              propertyValues,
            });
            if (!activeRun) {
              return;
            }
            activeRun.results.set(nodeId, outputValue);
            set((prev) => ({
              nodes: prev.nodes.map((node) =>
                node.id === nodeId ? { ...node, status: WorkflowStatus.DONE, outputValue } : node
              ),
              links: prev.links.map((link) =>
                link.fromNodeId === nodeId ? { ...link, status: WorkflowStatus.DONE } : link
              ),
            }));

            const outgoingLinks = activeRun.outgoing.get(nodeId) ?? [];
            outgoingLinks.forEach((link) => {
              const nextCount = (activeRun?.remainingDeps.get(link.toNodeId) ?? 0) - 1;
              activeRun?.remainingDeps.set(link.toNodeId, Math.max(0, nextCount));
              if (nextCount === 0) {
                activeRun?.queue.push(link.toNodeId);
              }
            });
          } catch (error) {
            set((prev) => ({
              nodes: prev.nodes.map((node) =>
                node.id === nodeId ? { ...node, status: WorkflowStatus.ERROR } : node
              ),
              links: prev.links.map((link) =>
                link.fromNodeId === nodeId ? { ...link, status: WorkflowStatus.ERROR } : link
              ),
              workflowStatus: "paused",
            }));
          } finally {
            activeRun?.running.delete(nodeId);
            await activeRun?.runQueue?.();
            finalizeWorkflowIfIdle();
          }
        };

        const runQueue = async () => {
          if (!activeRun || !activeRun.isRunning) {
            return;
          }
          if (get().workflowStatus !== "progressing") {
            return;
          }
          while (activeRun.queue.length > 0 && get().workflowStatus === "progressing") {
            const nodeId = activeRun.queue.shift();
            if (!nodeId) {
              continue;
            }
            void runNode(nodeId);
          }
        };

        run.runQueue = runQueue;

        const initialNodes = graphState.nodes
          .filter((node) => (remainingDeps.get(node.id) ?? 0) === 0)
          .map((node) => node.id);
        run.queue.push(...initialNodes);
        await runQueue();
      },
      onRun: async () => {
        if (get().workflowStatus === "paused") {
          set((state) => ({
            workflowStatus: "progressing",
            nodes: state.nodes.map((node) =>
              node.status === WorkflowStatus.PAUSED
                ? { ...node, status: WorkflowStatus.PROGRESSING }
                : node
            ),
            links: state.links.map((link) =>
              link.status === WorkflowStatus.PAUSED
                ? { ...link, status: WorkflowStatus.PROGRESSING }
                : link
            ),
          }));
          if (activeRun) {
            await activeRun.runQueue?.();
            return;
          }
          await get().executeWorkflow();
          return;
        }
        if (get().workflowStatus === "progressing") {
          return;
        }
        await get().executeWorkflow();
      },
      onPause: () => {
        if (get().workflowStatus !== "progressing") {
          return;
        }
        set((state) => ({
          workflowStatus: "paused",
          nodes: state.nodes.map((node) =>
            node.status === WorkflowStatus.PROGRESSING
              ? { ...node, status: WorkflowStatus.PAUSED }
              : node
          ),
          links: state.links.map((link) =>
            link.status === WorkflowStatus.PROGRESSING
              ? { ...link, status: WorkflowStatus.PAUSED }
              : link
          ),
        }));
      },
      onStop: () => {
        if (activeRun) {
          activeRun.isRunning = false;
          activeRun.queue = [];
          activeRun.running.clear();
        }
        activeRun = null;
        set((state) => ({
          workflowStatus: "stopped",
          pendingInputs: [],
          nodes: state.nodes.map((node) => ({
            ...node,
            status: WorkflowStatus.PENDING,
            inputFormValues: {},
            outputValue: undefined,
          })),
          links: state.links.map((link) => ({ ...link, status: WorkflowStatus.PENDING })),
        }));
      },
      retryNodeInput: async (nodeId) => {
        if (!activeRun) {
          return;
        }
        const state = get();
        const workflowNode = state.nodes.find((node) => node.id === nodeId);
        if (!workflowNode) {
          return;
        }
        const nodeInputs = getNodeInputs(workflowNode, activeRun.nodeDefinitions);
        if (nodeInputs.length === 0) {
          return;
        }
        set((prev) => ({
          pendingInputs: updatePendingInputStatus(prev.pendingInputs, nodeId, "pending"),
        }));
        try {
          const result = await activeRun.fillWorkflowInputs({
            nodeId,
            nodeName: workflowNode.title ?? workflowNode.executionId,
            inputForms: [nodeInputs],
            formValue: workflowNode.inputFormValues,
          });
          if (!result || result.nodeId !== nodeId) {
            return;
          }
          set((prev) => ({
            nodes: prev.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, inputFormValues: result.values, status: WorkflowStatus.PROGRESSING }
                : node
            ),
            pendingInputs: updatePendingInputStatus(prev.pendingInputs, nodeId, "done"),
            workflowStatus: "progressing",
          }));
          activeRun.queue.push(nodeId);
          await activeRun.runQueue?.();
        } catch (error) {
          set((prev) => ({
            pendingInputs: updatePendingInputStatus(prev.pendingInputs, nodeId, "waiting"),
          }));
        }
      },
    }),
    { name: "WorkflowStore" }
  )
);

const upsertPendingInput = (items: PendingInputItem[], nextItem: PendingInputItem) => {
  const exists = items.some((item) => item.nodeId === nextItem.nodeId);
  if (!exists) {
    return [...items, nextItem];
  }
  return items.map((item) => (item.nodeId === nextItem.nodeId ? { ...item, ...nextItem } : item));
};

const updatePendingInputStatus = (
  items: PendingInputItem[],
  nodeId: string,
  status: PendingInputItem["status"]
) => items.map((item) => (item.nodeId === nodeId ? { ...item, status } : item));

const resolvePropertyValues = (
  node: GraphNodeSnapshot,
  nodeDefinitions: Record<number, NodeSnapshot>
) => {
  if (!node.nodeId) {
    return { ...(node.properties ?? {}) };
  }
  const definition = nodeDefinitions[node.nodeId];
  if (!definition) {
    return { ...(node.properties ?? {}) };
  }
  const defaults = getNodeDefaultProperties(definition);
  return { ...defaults, ...(node.properties ?? {}) };
};

const getNodeInputs = (
  node: GraphNodeSnapshot,
  nodeDefinitions: Record<number, NodeSnapshot>
): InputForm => {
  return nodeDefinitions[node.nodeId]?.inputs ?? [];
};

const resolveInputValues = (
  nodeInputs: InputForm,
  rawValues: Record<string, any>,
  incomingLinks: GraphLink[],
  results: Map<string, unknown>
) => {
  const values: Record<string, unknown> = {};
  const inputBySlot = new Map<number, GraphLink>();
  incomingLinks.forEach((link) => {
    inputBySlot.set(link.toSlot, link);
  });
  nodeInputs.forEach((input, index) => {
    const link = inputBySlot.get(index);
    if (link) {
      values[input.name] = results.get(link.fromNodeId);
      return;
    }
    const fieldKey = `0:${input.name}`;
    if (rawValues && rawValues[fieldKey] !== undefined) {
      values[input.name] = rawValues[fieldKey];
    }
  });
  return values;
};

const finalizeWorkflowIfIdle = () => {
  if (!activeRun) {
    return;
  }
  const state = useWorkflowStore.getState();
  const hasRunning = activeRun.running.size > 0;
  const hasQueue = activeRun.queue.length > 0;
  const hasWaiting = state.nodes.some((node) => node.status === WorkflowStatus.WAITING);
  if (!hasRunning && !hasQueue && !hasWaiting && state.workflowStatus === "progressing") {
    useWorkflowStore.setState({ workflowStatus: "stopped" });
  }
};

