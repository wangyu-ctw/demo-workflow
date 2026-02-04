export type SlotType = "image" | "prompt" | "number" | "string" | "boolean" | "select" | "checkbox";

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
}

export type Point = [number, number];

