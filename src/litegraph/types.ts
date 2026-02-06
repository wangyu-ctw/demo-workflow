import type { WorkflowStatus } from "../types/workflow";

export type SlotType = "object" | "images" | "string" | "select" | "number";

export interface NodeInput {
  name: string;
  type: SlotType;
  linkId?: number;
}

export interface NodeOutput {
  name: string;
  type: SlotType;
  links: number[];
}

export interface LLink {
  id: number;
  fromNodeId: number;
  fromSlot: number;
  toNodeId: number;
  toSlot: number;
  status?: WorkflowStatus;
}

export type Point = [number, number];

