import { NodePropertyType, type NodeProperty } from "../stores/nodeStore";
import { getSlotColor } from "../utils/constants";
import type { NodeInput, NodeOutput, Point, SlotType } from "./types";

export class LGraphNode {
  id: number;
  type: string;
  title: string;
  pos: Point;
  size: Point;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  properties: Record<string, unknown>;
  propertyDefs: NodeProperty<unknown>[];
  slotGap = 18;
  slotTopOffset = 44;
  slotRadius = 5;
  slotHitRadius = 10;
  propertyRowHeight = 20;
  propertyGap = 6;

  constructor(title = "node") {
    this.id = -1;
    this.type = "unknown";
    this.title = title;
    this.pos = [0, 0];
    this.size = [180, 80];
    this.inputs = [];
    this.outputs = [];
    this.properties = {};
    this.propertyDefs = [];
  }

  addInput(name: string, type: SlotType) {
    this.inputs.push({ name, type });
  }

  addOutput(name: string, type: SlotType) {
    this.outputs.push({ name, type, links: [] });
  }

  getInputSlotPos(slotIndex: number): Point {
    const [x, y] = this.pos;
    return [x, y + this.slotTopOffset + slotIndex * this.slotGap];
  }

  getOutputSlotPos(slotIndex: number): Point {
    const [x, y] = this.pos;
    const [w] = this.size;
    return [x + w, y + this.slotTopOffset + slotIndex * this.slotGap];
  }

  getPropertyRect(index: number) {
    const [x, y] = this.pos;
    const [w] = this.size;
    const slots = Math.max(this.inputs.length, this.outputs.length);
    const startY = y + this.slotTopOffset + slots * this.slotGap + 12;
    return {
      x: x + 8,
      y: startY + index * (this.propertyRowHeight + this.propertyGap),
      width: w - 16,
      height: this.propertyRowHeight,
    };
  }

  getPropertyAt(graphX: number, graphY: number) {
    for (let index = 0; index < this.propertyDefs.length; index += 1) {
      const rect = this.getPropertyRect(index);
      if (
        graphX >= rect.x &&
        graphX <= rect.x + rect.width &&
        graphY >= rect.y &&
        graphY <= rect.y + rect.height
      ) {
        return index;
      }
    }
    return null;
  }

  private getRequiredHeight() {
    const [, y] = this.pos;
    const slots = Math.max(this.inputs.length, this.outputs.length);
    const slotsBottom = y + this.slotTopOffset + slots * this.slotGap;
    if (this.propertyDefs.length === 0) {
      return Math.max(this.size[1], slotsBottom + 12 - y);
    }
    const lastIndex = this.propertyDefs.length - 1;
    const lastRect = this.getPropertyRect(lastIndex);
    return Math.max(this.size[1], lastRect.y + lastRect.height + 12 - y);
  }

  draw(ctx: CanvasRenderingContext2D, activeAlpha = 0) {
    const [x, y] = this.pos;
    const requiredHeight = this.getRequiredHeight();
    if (requiredHeight !== this.size[1]) {
      this.size[1] = requiredHeight;
    }
    const [w, h] = this.size;

    ctx.fillStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    if (activeAlpha > 0) {
      ctx.strokeStyle = `rgba(138, 180, 255, ${Math.min(1, activeAlpha)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "#e6e9ef";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.title, x + 12, y + 24);

    ctx.strokeStyle = "#2A2A2A";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 32);
    ctx.lineTo(x + w, y + 32);
    ctx.stroke();

    ctx.font = "12px sans-serif";
    this.inputs.forEach((input, index) => {
      const [slotX, slotY] = this.getInputSlotPos(index);
      ctx.fillStyle = getSlotColor(input.type);
      ctx.beginPath();
      ctx.arc(slotX, slotY, this.slotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#999999";
      ctx.fillText(input.name, slotX + 10, slotY + 4);
    });
    this.outputs.forEach((output, index) => {
      const [slotX, slotY] = this.getOutputSlotPos(index);
      ctx.fillStyle = getSlotColor(output.type);
      ctx.beginPath();
      ctx.arc(slotX, slotY, this.slotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#999999";
      const labelWidth = ctx.measureText(output.name).width;
      ctx.fillText(output.name, slotX - 10 - labelWidth, slotY + 4);
    });

    if (this.propertyDefs.length > 0) {
      ctx.fillStyle = "#7f8a9e";
      ctx.font = "12px sans-serif";
      this.propertyDefs.forEach((prop, index) => {
        const rect = this.getPropertyRect(index);
        ctx.fillStyle = "#222222";
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.width, rect.height, rect.height / 2);
        ctx.fill();
        ctx.fillStyle = "#999999";
        ctx.fillText(prop.label, rect.x + 8, rect.y + 14);
        const value = this.properties[prop.name];
        const displayValue = formatPropertyValue(value, prop.type, prop.options);
        ctx.fillStyle = "#DDDDDD";
        const valueWidth = ctx.measureText(displayValue).width;
        ctx.fillText(displayValue, rect.x + rect.width - valueWidth - 8, rect.y + 14);
      });
    }
  }
}

const formatPropertyValue = (
  value: unknown,
  type: NodePropertyType,
  options?: { name: string; value: unknown }[]
) => {
  if (type === NodePropertyType.switch) {
    return value ? "开启" : "关闭";
  }
  if (type === NodePropertyType.checkGroup && Array.isArray(value)) {
    return value.join(", ");
  }
  if (type === NodePropertyType.select && options) {
    const option = options.find((item) => item.value === value);
    if (option) {
      return option.name;
    }
  }
  if (value === undefined || value === null) {
    return "-";
  }
  return String(value);
};

