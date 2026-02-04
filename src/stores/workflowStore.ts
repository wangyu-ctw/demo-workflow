import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { execute } from "../services/api";
import type { GraphLink, GraphNodeSnapshot } from "./graphStore";
import { useGraphStore } from "./graphStore";
import type { NodeSnapshot } from "./nodeStore";
import { useNodeStore } from "./nodeStore";
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
}) => Promise<{ nodeId: string; values: Record<string, string> }>;

type WorkflowRun = {
  fillWorkflowInputs: FillWorkflowInputs;
  incoming: Map<string, GraphLink[]>;
  outgoing: Map<string, GraphLink[]>;
  remainingDeps: Map<string, number>;
  results: Map<string, unknown>;
  queue: string[];
  isRunning: boolean;
  nodeDefinitions: Record<number, NodeSnapshot>;
  runQueue?: () => Promise<void>;
};

let activeRun: WorkflowRun | null = null;

const getNodeName = (node: WorkflowNodeSnapshot) => node.title ?? node.executionId ?? "节点";

const toInputForms = (node: GraphNodeSnapshot, nodeDefinitions: Record<number, NodeSnapshot>) => {
  const definition = node.nodeId ? nodeDefinitions[node.nodeId] : undefined;
  const inputs = definition?.inputs ?? [];
  return inputs.length > 0 ? [inputs] : [];
};

const getRequiredMissing = (forms: InputForm[], values: Record<string, any>) =>
  forms.some((form, formIndex) =>
    form.some((input) => {
      if (!input.required) {
        return false;
      }
      const key = `${formIndex}:${input.name}`;
      const value = values[key];
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === "string" && value.trim() === "") {
        return true;
      }
      return false;
    })
  );

const buildFormValueFromOutputs = (
  node: WorkflowNodeSnapshot,
  run: WorkflowRun
): Record<string, any> => {
  const incoming = run.incoming.get(node.id) ?? [];
  if (incoming.length === 0) {
    return {};
  }
  const definition = node.nodeId ? run.nodeDefinitions[node.nodeId] : undefined;
  const values: Record<string, any> = {};
  incoming.forEach((link) => {
    const inputName = definition?.inputs?.[link.toSlot]?.name ?? node.inputs?.[link.toSlot]?.name;
    if (!inputName) {
      return;
    }
    const outputValue = run.results.get(link.fromNodeId);
    if (outputValue === undefined) {
      return;
    }
    values[`0:${inputName}`] = outputValue;
  });
  return values;
};

const executeNodeWithInputs = async (
  node: WorkflowNodeSnapshot,
  setState: (partial: WorkflowStore | Partial<WorkflowStore> | ((state: WorkflowStore) => WorkflowStore | Partial<WorkflowStore>), replace?: boolean) => void,
  getState: () => WorkflowStore
) => {
  if (!activeRun) {
    return "error";
  }
  const inputForms = toInputForms(node, activeRun.nodeDefinitions);
  const nodeName = getNodeName(node);
  const formValue = buildFormValueFromOutputs(node, activeRun);
  const hasIncoming = (activeRun.incoming.get(node.id)?.length ?? 0) > 0;

  if (hasIncoming) {
    if (inputForms.length > 0 && getRequiredMissing(inputForms, formValue)) {
      setState((state) => ({
        nodes: state.nodes.map((item) =>
          item.id === node.id ? { ...item, status: WorkflowStatus.ERROR } : item
        ),
      }));
      return "error";
    }
    setState((state) => ({
      nodes: state.nodes.map((item) =>
        item.id === node.id
          ? { ...item, status: WorkflowStatus.PROGRESSING, inputFormValues: formValue }
          : item
      ),
    }));
    const result = await getState().executeNode({
      executeId: Number(node.executionId),
      inputFormValues: formValue,
      propertyValues: node.propertyValues ?? {},
    });
    activeRun.results.set(node.id, result);
    setState((state) => ({
      nodes: state.nodes.map((item) =>
        item.id === node.id
          ? { ...item, status: WorkflowStatus.DONE, outputValue: result }
          : item
      ),
      links: state.links.map((link) =>
        link.fromNodeId === node.id ? { ...link, status: WorkflowStatus.DONE } : link
      ),
    }));
    return "success";
  }

  if (inputForms.length === 0) {
    setState((state) => ({
      nodes: state.nodes.map((item) =>
        item.id === node.id ? { ...item, status: WorkflowStatus.PROGRESSING } : item
      ),
    }));
    const result = await getState().executeNode({
      executeId: Number(node.executionId),
      inputFormValues: {},
      propertyValues: node.propertyValues ?? {},
    });
    activeRun.results.set(node.id, result);
    setState((state) => ({
      nodes: state.nodes.map((item) =>
        item.id === node.id
          ? { ...item, status: WorkflowStatus.DONE, outputValue: result }
          : item
      ),
      links: state.links.map((link) =>
        link.fromNodeId === node.id ? { ...link, status: WorkflowStatus.DONE } : link
      ),
    }));
    return "success";
  }

  setState((state) => ({
    nodes: state.nodes.map((item) =>
      item.id === node.id ? { ...item, status: WorkflowStatus.PROGRESSING } : item
    ),
    pendingInputs: upsertPendingInput(state.pendingInputs, {
      nodeId: node.id,
      nodeName,
      form: inputForms,
      status: "pending",
      formValue,
    }),
  }));

  try {
    const resolved = await activeRun.fillWorkflowInputs({
      nodeId: node.id,
      nodeName,
      inputForms,
      formValue,
    });
    if (getRequiredMissing(inputForms, resolved.values)) {
      setState((state) => ({
        nodes: state.nodes.map((item) =>
          item.id === node.id ? { ...item, status: WorkflowStatus.ERROR } : item
        ),
      }));
      return "error";
    }
    const result = await getState().executeNode({
      executeId: Number(node.executionId),
      inputFormValues: resolved.values,
      propertyValues: node.propertyValues ?? {},
    });
    activeRun.results.set(node.id, result);
    setState((state) => ({
      nodes: state.nodes.map((item) =>
        item.id === node.id
          ? {
              ...item,
              status: WorkflowStatus.DONE,
              inputFormValues: resolved.values,
              outputValue: result,
            }
          : item
      ),
      pendingInputs: updatePendingInputStatus(state.pendingInputs, node.id, "done"),
    }));
    setState((state) => ({
      links: state.links.map((link) =>
        link.fromNodeId === node.id ? { ...link, status: WorkflowStatus.DONE } : link
      ),
    }));
    return "success";
  } catch {
    setState((state) => ({
      nodes: state.nodes.map((item) =>
        item.id === node.id ? { ...item, status: WorkflowStatus.WAITING } : item
      ),
      pendingInputs: updatePendingInputStatus(state.pendingInputs, node.id, "waiting"),
    }));
    return "waiting";
  }
};

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
        const fillWorkflowInputs = get().fillWorkflowInputs;
        if (!fillWorkflowInputs) {
          return;
        }
        const { nodes: graphNodes, links: graphLinks } = useGraphStore.getState();
        const nodeDefinitions = useNodeStore.getState().nodes;
        const workflowNodes: WorkflowNodeSnapshot[] = graphNodes.map((node) => ({
          ...node,
          status: WorkflowStatus.PENDING,
          inputFormValues: {},
          propertyValues: { ...(node.properties ?? {}) },
          outputValue: undefined,
        }));
        const workflowLinks: WorkflowLink[] = graphLinks.map((link) => ({
          ...link,
          status: WorkflowStatus.PENDING,
        }));

        const incoming = new Map<string, GraphLink[]>();
        const outgoing = new Map<string, GraphLink[]>();
        graphLinks.forEach((link) => {
          const nextIncoming = incoming.get(link.toNodeId) ?? [];
          nextIncoming.push(link);
          incoming.set(link.toNodeId, nextIncoming);
          const nextOutgoing = outgoing.get(link.fromNodeId) ?? [];
          nextOutgoing.push(link);
          outgoing.set(link.fromNodeId, nextOutgoing);
        });

        const remainingDeps = new Map<string, number>();
        workflowNodes.forEach((node) => {
          remainingDeps.set(node.id, incoming.get(node.id)?.length ?? 0);
        });

        const queue = workflowNodes
          .filter((node) => (incoming.get(node.id)?.length ?? 0) === 0)
          .map((node) => node.id);

        const startInputNodeIds = queue.filter((nodeId) => {
          const node = workflowNodes.find((item) => item.id === nodeId);
          if (!node) {
            return false;
          }
          const form = toInputForms(node, nodeDefinitions);
          return form.length > 0;
        });

        const pendingInputs: PendingInputItem[] = startInputNodeIds
          .map((nodeId) => {
            const node = workflowNodes.find((item) => item.id === nodeId);
            if (!node) {
              return null;
            }
            const form = toInputForms(node, nodeDefinitions);
            return {
              nodeId,
              nodeName: getNodeName(node),
              form,
              status: "pending",
            };
          })
          .filter((item): item is PendingInputItem => item !== null);

        const nextWorkflowNodes = workflowNodes.map((node) =>
          startInputNodeIds.includes(node.id)
            ? { ...node, status: WorkflowStatus.WAITING }
            : node
        );
        set({ nodes: nextWorkflowNodes, links: workflowLinks, pendingInputs });

        activeRun = {
          fillWorkflowInputs,
          incoming,
          outgoing,
          remainingDeps,
          results: new Map<string, unknown>(),
          queue,
          isRunning: false,
          nodeDefinitions,
        };
        set({ workflowStatus: "progressing" });

        const handleNodeSuccess = (nodeId: string) => {
          const currentRun = activeRun;
          if (!currentRun) {
            return;
          }
          const nextLinks = currentRun.outgoing.get(nodeId) ?? [];
          nextLinks.forEach((link) => {
            const nextCount = (currentRun.remainingDeps.get(link.toNodeId) ?? 0) - 1;
            currentRun.remainingDeps.set(link.toNodeId, nextCount);
            if (nextCount === 0) {
              currentRun.queue.push(link.toNodeId);
            }
          });
          if (!currentRun.isRunning && currentRun.queue.length > 0) {
            currentRun.runQueue?.();
          }
        };

        const runQueue = async () => {
          const run = activeRun;
          if (!run || run.isRunning) {
            return;
          }
          run.isRunning = true;
          while (run.queue.length > 0) {
            const status = get().workflowStatus;
            if (status !== "progressing") {
              run.isRunning = false;
              return;
            }
            const batch = run.queue.splice(0);
            const tasks = batch.map(async (nodeId) => {
              const node = get().nodes.find((item) => item.id === nodeId);
              if (!node) {
                return;
              }
              const outcome = await executeNodeWithInputs(node, set, get);
              if (outcome === "success") {
                handleNodeSuccess(nodeId);
              }
            });
            await Promise.all(tasks);
          }
          run.isRunning = false;
          set((state) => ({
            workflowStatus: state.workflowStatus === "progressing" ? "stopped" : state.workflowStatus,
          }));
        };
        activeRun.runQueue = runQueue;

        const run = activeRun;
        if (run) {
          const startNoInputNodeIds = run.queue.filter(
            (nodeId) => !startInputNodeIds.includes(nodeId)
          );
          run.queue = [];

          const processPendingInputs = async () => {
            if (get().workflowStatus !== "progressing") {
              return;
            }
            while (true) {
              const pending = get().pendingInputs.find((item) => item.status === "pending");
              if (!pending) {
                return;
              }
              const nextNode = get().nodes.find((item) => item.id === pending.nodeId);
              if (!nextNode) {
                return;
              }
              const outcome = await executeNodeWithInputs(nextNode, set, get);
              if (outcome === "success") {
                handleNodeSuccess(pending.nodeId);
              }
              if (get().workflowStatus !== "progressing") {
                return;
              }
            }
          };

          const startNoInputTasks = startNoInputNodeIds.map(async (nodeId) => {
            const node = get().nodes.find((item) => item.id === nodeId);
            if (!node) {
              return;
            }
            const outcome = await executeNodeWithInputs(node, set, get);
            if (outcome === "success") {
              handleNodeSuccess(nodeId);
            }
          });

          void processPendingInputs();
          await Promise.all(startNoInputTasks);
        }

        await runQueue();
      },
      onRun: async () => {
        if (get().workflowStatus === "paused") {
          set({ workflowStatus: "progressing" });
          await activeRun?.runQueue?.();
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
        set({ workflowStatus: "paused" });
      },
      onStop: () => {
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
        const run = activeRun;
        if (!run) {
          return;
        }
        const node = get().nodes.find((item) => item.id === nodeId);
        if (!node) {
          return;
        }
        if ((run.incoming.get(nodeId)?.length ?? 0) > 0) {
          return;
        }
        const pending = get().pendingInputs.find((item) => item.nodeId === nodeId);
        const formValue = pending?.formValue ?? buildFormValueFromOutputs(node, run);
        const inputForms = pending?.form ?? toInputForms(node, run.nodeDefinitions);

        set((state) => ({
          nodes: state.nodes.map((item) =>
            item.id === nodeId ? { ...item, status: WorkflowStatus.PROGRESSING } : item
          ),
          pendingInputs: upsertPendingInput(state.pendingInputs, {
            nodeId,
            nodeName: getNodeName(node),
            form: inputForms,
            status: "pending",
            formValue,
          }),
        }));

        try {
          const resolved = await run.fillWorkflowInputs({
            nodeId,
            nodeName: getNodeName(node),
            inputForms,
            formValue,
          });
          if (getRequiredMissing(inputForms, resolved.values)) {
            set((state) => ({
              nodes: state.nodes.map((item) =>
                item.id === nodeId ? { ...item, status: WorkflowStatus.ERROR } : item
              ),
            }));
            return;
          }
          const result = await get().executeNode({
            executeId: Number(node.executionId),
            inputFormValues: resolved.values,
            propertyValues: node.propertyValues ?? {},
          });
          run.results.set(nodeId, result);
          set((state) => ({
            nodes: state.nodes.map((item) =>
              item.id === nodeId
                ? {
                    ...item,
                    status: WorkflowStatus.DONE,
                    inputFormValues: resolved.values,
                    outputValue: result,
                  }
                : item
            ),
          pendingInputs: updatePendingInputStatus(state.pendingInputs, nodeId, "done"),
          }));
          set((state) => ({
            links: state.links.map((link) =>
              link.fromNodeId === nodeId ? { ...link, status: WorkflowStatus.DONE } : link
            ),
          }));

          const nextLinks = run.outgoing.get(nodeId) ?? [];
          nextLinks.forEach((link) => {
            const nextCount = (run.remainingDeps.get(link.toNodeId) ?? 0) - 1;
            run.remainingDeps.set(link.toNodeId, nextCount);
            if (nextCount === 0) {
              run.queue.push(link.toNodeId);
            }
          });

          if (!run.isRunning) {
            run.isRunning = true;
            while (run.queue.length > 0) {
              const nextNodeId = run.queue.shift();
              if (!nextNodeId) {
                continue;
              }
              const nextNode = get().nodes.find((item) => item.id === nextNodeId);
              if (!nextNode) {
                continue;
              }
              const outcome = await executeNodeWithInputs(nextNode, set, get);
              if (outcome !== "success") {
                continue;
              }
              const followingLinks = run.outgoing.get(nextNodeId) ?? [];
              followingLinks.forEach((nextLink) => {
                const count = (run.remainingDeps.get(nextLink.toNodeId) ?? 0) - 1;
                run.remainingDeps.set(nextLink.toNodeId, count);
                if (count === 0) {
                  run.queue.push(nextLink.toNodeId);
                }
              });
            }
            run.isRunning = false;
          }
        } catch {
          set((state) => ({
            nodes: state.nodes.map((item) =>
              item.id === nodeId ? { ...item, status: WorkflowStatus.WAITING } : item
            ),
            pendingInputs: updatePendingInputStatus(state.pendingInputs, nodeId, "waiting"),
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

