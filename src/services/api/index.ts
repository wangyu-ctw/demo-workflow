import type { GraphLink, GraphNodeSnapshot } from "../../stores/graphStore";
import type { NodeSnapshot } from "../../stores/nodeStore";
import initialGraph from "../mock/initialGraph.json";
import initialNodes from "../mock/initialNodes.json";

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getInitialGraph = async (): Promise<{
  nodes: GraphNodeSnapshot[];
  links: GraphLink[];
}> => {
  await delay(1000);
  return initialGraph as { nodes: GraphNodeSnapshot[]; links: GraphLink[] };
};

export const getInitialNodes = async (): Promise<NodeSnapshot[]> => {
  await delay(1000);
  return initialNodes as NodeSnapshot[];
};

