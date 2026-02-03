import type { SlotType } from "../litegraph/types";

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
};

export const getSlotColor = (type: SlotType) => SLOT_TYPE_COLORS[type];

