import type { NodeSnapshot } from "../../stores/nodeStore";
import initialNodes from "../mock/initialNodes.json";
import { NODE_STORE, openDatabase, requestToPromise, transactionDone } from "./db";

const INITIAL_NODES_FLAG = "artifex.initialNodesSeeded";
const RESET_NODES_FLAG = "artifex.nodeDefinitionsReset.20260206";

type InitialNodesPayload = {
  version: string;
  data: NodeSnapshot[];
};

const initialNodesPayload = initialNodes as InitialNodesPayload;

const withStore = async <T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T>
) => {
  const db = await openDatabase();
  const tx = db.transaction(NODE_STORE, mode);
  const store = tx.objectStore(NODE_STORE);
  const result = await runner(store);
  await transactionDone(tx);
  db.close();
  return result;
};

export const ensureInitialNodes = async () =>
  withStore("readwrite", async (store) => {
    const count = await requestToPromise(store.count());
    const storedVersion = window.localStorage.getItem(INITIAL_NODES_FLAG);
    const needsSeed = storedVersion !== initialNodesPayload.version || count === 0;
    if (!needsSeed) {
      return;
    }
    console.log("seeding initial nodes");
    await requestToPromise(store.clear());
    initialNodesPayload.data.forEach((node) => {
      store.add(node);
    });
    window.localStorage.setItem(INITIAL_NODES_FLAG, initialNodesPayload.version);
  });

export const resetNodeDefinitions = async () =>
  withStore("readwrite", async (store) => {
    await requestToPromise(store.clear());
    window.localStorage.removeItem(INITIAL_NODES_FLAG);
  });

export const resetNodeDefinitionsOnce = async () => {
  const hasReset = window.localStorage.getItem(RESET_NODES_FLAG);
  if (hasReset) {
    return;
  }
  await resetNodeDefinitions();
  window.localStorage.setItem(RESET_NODES_FLAG, "true");
};

export const listNodeDefinitions = async () =>
  withStore("readonly", async (store) =>
    requestToPromise(store.getAll() as IDBRequest<NodeSnapshot[]>)
  );

export const getNodeDefinition = async (nodeId: number) =>
  withStore("readonly", async (store) => {
    const node = await requestToPromise(
      store.get(nodeId) as IDBRequest<NodeSnapshot | undefined>
    );
    return node ?? null;
  });

export const createNodeDefinition = async (node: Omit<NodeSnapshot, "id">) =>
  withStore("readwrite", async (store) => {
    const createdId = await requestToPromise(store.add(node));
    const id = typeof createdId === "number" ? createdId : Number(createdId);
    return { ...node, id };
  });

export const updateNodeDefinition = async (
  nodeId: number,
  updates: Omit<NodeSnapshot, "id">
) =>
  withStore("readwrite", async (store) => {
    const existing = await requestToPromise(
      store.get(nodeId) as IDBRequest<NodeSnapshot | undefined>
    );
    if (!existing) {
      return null;
    }
    const updated = { ...existing, ...updates, id: nodeId };
    await requestToPromise(store.put(updated));
    return updated;
  });

export const deleteNodeDefinition = async (nodeId: number) =>
  withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(nodeId));
  });

export const exportNodeDefinitionsAsJson = async (
  name = "initialNodes",
  versionOverride?: string
) => {
  const nodes = await listNodeDefinitions();
  const version =
    versionOverride ??
    window.localStorage.getItem(INITIAL_NODES_FLAG) ??
    initialNodesPayload.version;
  const payload = JSON.stringify(
    {
      version,
      data: [...nodes].sort((a, b) => a.id - b.id),
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return payload;
};

