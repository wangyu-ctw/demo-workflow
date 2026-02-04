import type { GraphLink, GraphNodeSnapshot } from "../stores/graphStore";
import type { NodePort } from "../stores/nodeStore";

export enum WorkflowStatus {
  PENDING = "PENDING",
  DONE = "DONE",
  PROGRESSING = "PROGRESSING",
  ERROR = "ERROR",
  PAUSED = "PAUSED",
  WAITING = "WAITING",
}

export type WorkflowNodeSnapshot = GraphNodeSnapshot & {
  status: WorkflowStatus;
  inputFormValues: Record<string, any>;
  propertyValues: Record<string, any>;
  outputValue?: unknown;
};

export type WorkflowLink = GraphLink & {
  status: WorkflowStatus;
};

export type InputForm = NodePort[];

