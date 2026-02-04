import type { NodeSnapshot } from "../../stores/nodeStore";
import initialNodes from "../mock/initialNodes.json";
import { NODE_STORE, openDatabase, requestToPromise, transactionDone } from "./db";

const INITIAL_NODES_FLAG = "artifex.initialNodesSeeded";

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
    if (count > 0) {
      window.localStorage.setItem(INITIAL_NODES_FLAG, "true");
      return;
    }
    console.log("seeding initial nodes");
    (initialNodes as NodeSnapshot[]).forEach((node) => {
      store.add(node);
    });
    window.localStorage.setItem(INITIAL_NODES_FLAG, "true");
  });

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

