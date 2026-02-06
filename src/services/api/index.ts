import type { NodeSnapshot } from "../../stores/nodeStore";
import {
  createNodeDefinition,
  deleteNodeDefinition,
  ensureInitialNodes,
  getNodeDefinition,
  listNodeDefinitions,
  resetNodeDefinitionsOnce,
  updateNodeDefinition,
} from "../indexedDB";
import { executor } from "../mock/executor";

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getInitialNodes = async (): Promise<NodeSnapshot[]> => {
  await resetNodeDefinitionsOnce();
  await delay(1000);
  const cached = await listNodeDefinitions();
  if (cached.length > 0) {
    return cached;
  }
  await ensureInitialNodes();
  return listNodeDefinitions();
};

export const execute = async (
  executeId: number,
  payload: { inputFormValues: Record<string, unknown>; propertyValues: Record<string, unknown> }
) => executor(executeId, payload);

export {
  createNodeDefinition,
  deleteNodeDefinition,
  getNodeDefinition,
  listNodeDefinitions,
  resetNodeDefinitionsOnce,
  updateNodeDefinition,
};

