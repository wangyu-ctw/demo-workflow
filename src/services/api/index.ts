import type { NodeSnapshot } from "../../stores/nodeStore";
import {
  createNodeDefinition,
  deleteNodeDefinition,
  ensureInitialNodes,
  getNodeDefinition,
  listNodeDefinitions,
  updateNodeDefinition,
} from "../indexedDB";

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getInitialNodes = async (): Promise<NodeSnapshot[]> => {
  await delay(1000);
  const cached = await listNodeDefinitions();
  if (cached.length > 0) {
    return cached;
  }
  await ensureInitialNodes();
  return listNodeDefinitions();
};

export {
  createNodeDefinition,
  deleteNodeDefinition,
  getNodeDefinition,
  listNodeDefinitions,
  updateNodeDefinition,
};

