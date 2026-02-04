import type { GraphConfig } from "../stores/graphStore";

const toBaseName = (fileName: string) => fileName.replace(/\.[^/.]+$/, "");

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateGraphConfig = (payload: unknown): GraphConfig => {
  if (!isPlainObject(payload)) {
    throw new Error("Invalid graph payload");
  }
  const { nodes, links, name } = payload;
  if (!Array.isArray(nodes) || !Array.isArray(links)) {
    throw new Error("Graph config must include nodes and links arrays");
  }
  if (name !== undefined && typeof name !== "string") {
    throw new Error("Graph name must be a string");
  }
  return { nodes, links, name };
};

export const readGraphConfigFile = async (file: File): Promise<GraphConfig> => {
  const content = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("JSON 解析失败");
  }
  return validateGraphConfig(parsed);
};

export const getGraphNameFromFile = (file: File) => toBaseName(file.name);

export const exportGraphConfig = (config: GraphConfig, name: string) => {
  const payload = {
    name,
    nodes: config.nodes,
    links: config.links,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

