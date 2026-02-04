import type { SlotType } from "../litegraph/types";
import { WorkflowStatus } from "../types/workflow";

export const MACARON_COLORS = [
  "#FF9AA2",
  "#FFB347",
  "#FFF59D",
  "#B5E48C",
  "#9BF6FF",
  "#8ECAE6",
  "#9A8CFF",
  "#C77DFF",
  "#FFAFCC",
];

export const SLOT_TYPE_COLORS: Record<SlotType, string> = {
  image: MACARON_COLORS[0],
  prompt: MACARON_COLORS[1],
  number: MACARON_COLORS[2],
  string: MACARON_COLORS[3],
  boolean: MACARON_COLORS[4],
  select: MACARON_COLORS[5],
  checkbox: MACARON_COLORS[6],
};

export const getSlotColor = (type: SlotType) => SLOT_TYPE_COLORS[type];

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.PENDING]: "#FFF3BF",
  [WorkflowStatus.DONE]: "#27AE60",
  [WorkflowStatus.PROGRESSING]: "#2D9CDB",
  [WorkflowStatus.ERROR]: "#EB5757",
  [WorkflowStatus.PAUSED]: "#828282",
  [WorkflowStatus.WAITING]: "#F2994A",
};

