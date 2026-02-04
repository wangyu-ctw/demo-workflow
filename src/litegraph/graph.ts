import { getSlotColor, WORKFLOW_STATUS_COLORS } from "../utils/constants";
import { WorkflowStatus } from "../types/workflow";
import type { LLink, SlotType } from "./types";
import { LGraphNode } from "./node";

export class LGraph {
  nodes: LGraphNode[] = [];
  links = new Map<number, LLink>();
  private lastNodeId = 0;
  private lastLinkId = 0;
  private nodeExecutionTime = new Map<number, number>();
  private linkExecutionTime = new Map<number, number>();
  executionDecayMs = 900;

  add(node: LGraphNode) {
    this.lastNodeId += 1;
    node.id = this.lastNodeId;
    this.nodes.push(node);
  }

  remove(node: LGraphNode) {
    const inputLinkIds = node.inputs
      .map((input) => input.linkId)
      .filter((linkId): linkId is number => linkId !== undefined);
    inputLinkIds.forEach((linkId) => this.removeLink(linkId));

    const outputLinkIds = node.outputs.flatMap((output) => output.links);
    outputLinkIds.forEach((linkId) => this.removeLink(linkId));

    this.nodes = this.nodes.filter((item) => item !== node);
    this.nodeExecutionTime.delete(node.id);
  }

  connect(fromNode: LGraphNode, fromSlot: number, toNode: LGraphNode, toSlot: number): LLink {
    const existingLinkId = toNode.inputs[toSlot]?.linkId;
    if (existingLinkId !== undefined) {
      this.removeLink(existingLinkId);
    }
    const linkId = ++this.lastLinkId;
    const link: LLink = {
      id: linkId,
      fromNodeId: fromNode.id,
      fromSlot,
      toNodeId: toNode.id,
      toSlot,
    };
    this.links.set(linkId, link);
    fromNode.outputs[fromSlot]?.links.push(linkId);
    toNode.inputs[toSlot].linkId = linkId;
    return link;
  }

  removeLink(linkId: number): LLink | null {
    const link = this.links.get(linkId);
    if (!link) {
      return null;
    }
    const fromNode = this.getNodeById(link.fromNodeId);
    const toNode = this.getNodeById(link.toNodeId);
    if (fromNode) {
      const outputLinks = fromNode.outputs[link.fromSlot]?.links ?? [];
      fromNode.outputs[link.fromSlot].links = outputLinks.filter((id) => id !== linkId);
    }
    if (toNode) {
      if (toNode.inputs[link.toSlot]?.linkId === linkId) {
        toNode.inputs[link.toSlot].linkId = undefined;
      }
    }
    this.links.delete(linkId);
    return link;
  }

  getNodeById(id: number) {
    return this.nodes.find((node) => node.id === id) ?? null;
  }

  getLinkById(id: number) {
    return this.links.get(id) ?? null;
  }

  draw(ctx: CanvasRenderingContext2D, now = performance.now()) {
    this.drawLinks(ctx, now);
    this.nodes.forEach((node) => {
      const activeAlpha = this.getExecutionAlpha(this.nodeExecutionTime, node.id, now);
      node.draw(ctx, activeAlpha);
    });
  }

  touchNode(nodeId: number) {
    this.nodeExecutionTime.set(nodeId, performance.now());
  }

  touchLink(linkId: number) {
    this.linkExecutionTime.set(linkId, performance.now());
  }

  private drawLinks(ctx: CanvasRenderingContext2D, now: number) {
    for (const link of this.links.values()) {
      const fromNode = this.getNodeById(link.fromNodeId);
      const toNode = this.getNodeById(link.toNodeId);
      if (!fromNode || !toNode) {
        continue;
      }
      const [startX, startY] = fromNode.getOutputSlotPos(link.fromSlot);
      const [endX, endY] = toNode.getInputSlotPos(link.toSlot);

      const slotType = (fromNode.outputs[link.fromSlot]?.type ?? "number") as SlotType;
      const baseColor = getSlotColor(slotType);
      const statusColor = link.status ? WORKFLOW_STATUS_COLORS[link.status] : null;
      const strokeColor = statusColor ?? baseColor;
      const activeAlpha = this.getExecutionAlpha(this.linkExecutionTime, link.id, now);
      const baseAlpha = activeAlpha > 0 ? activeAlpha : 1;
      const blinkAlpha = link.status === WorkflowStatus.PROGRESSING ? getBlinkAlpha(now) : 1;
      const mergedAlpha = Math.min(1, baseAlpha * blinkAlpha);
      ctx.strokeStyle = mergedAlpha < 1 ? toRgba(strokeColor, mergedAlpha) : strokeColor;
      ctx.lineWidth = activeAlpha > 0 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(startX + 60, startY, endX - 60, endY, endX, endY);
      ctx.stroke();
    }
  }

  private getExecutionAlpha(map: Map<number, number>, id: number, now: number) {
    const lastTime = map.get(id);
    if (!lastTime) {
      return 0;
    }
    const elapsed = now - lastTime;
    if (elapsed > this.executionDecayMs) {
      map.delete(id);
      return 0;
    }
    return 1 - elapsed / this.executionDecayMs;
  }
}

const toRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
};

const getBlinkAlpha = (now: number) => {
  const wave = (Math.sin(now / 220) + 1) / 2;
  return 0.3 + 0.7 * wave;
};

