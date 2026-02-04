import { getSlotColor } from "../utils/constants";
import type { LLink, Point, SlotType } from "./types";
import { LGraph } from "./graph";
import { LGraphNode } from "./node";
import { WorkflowStatus } from "../types/workflow";

export class LGraphCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  graph: LGraph;
  drawCustom?: (ctx: CanvasRenderingContext2D) => void;
  onNodeMoved?: (node: LGraphNode) => void;
  onLinkAdded?: (link: LLink) => void;
  onLinkRemoved?: (link: LLink) => void;
  onPropertyClick?: (node: LGraphNode, propertyIndex: number) => void;
  onStatusDotClick?: (node: LGraphNode) => void;
  onOutputDotClick?: (payload: { node: LGraphNode; slot: number }) => void;
  onSelectionChange?: (
    selection:
      | { node: LGraphNode; rect: { x: number; y: number; width: number; height: number } }
      | null
  ) => void;
  private animationFrameId: number | null = null;
  private pixelRatio = 1;
  private offset: Point = [0, 0];
  private scale = 1;
  private draggingNode: LGraphNode | null = null;
  private draggingCanvas = false;
  private draggingOffset: Point = [0, 0];
  private lastMouse: Point = [0, 0];
  private linkingOutput:
    | { node: LGraphNode; slot: number }
    | null = null;
  private linkingInput:
    | { node: LGraphNode; slot: number }
    | null = null;
  private hoveredInput: { node: LGraphNode; slot: number } | null = null;
  private hoveredOutput: { node: LGraphNode; slot: number } | null = null;
  private selectedNode: LGraphNode | null = null;
  private selectionPadding = 8;
  private lastSelectionRect:
    | { x: number; y: number; width: number; height: number; nodeId: number }
    | null = null;
  private linkSnapDistance = 18;
  private didAutoCenter = false;
  linkEditingEnabled = true;
  nodeDraggingEnabled = true;

  constructor(canvas: HTMLCanvasElement, graph: LGraph) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available");
    }
    this.ctx = ctx;
    this.graph = graph;
    this.resize();
    window.addEventListener("resize", this.resize);
    this.bindEvents();
  }

  start() {
    const loop = () => {
      if (!this.didAutoCenter && this.graph.nodes.length > 0) {
        this.centerOnNodes();
        this.didAutoCenter = true;
      }
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = null;
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.resize);
    this.unbindEvents();
  }

  draw() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    const scaledRatio = this.pixelRatio * this.scale;
    this.ctx.setTransform(
      scaledRatio,
      0,
      0,
      scaledRatio,
      this.offset[0] * scaledRatio,
      this.offset[1] * scaledRatio
    );
    this.drawGrid();
    this.graph.draw(this.ctx, performance.now());
    this.drawSelection();
    this.drawLinkPreview();
    this.ctx.restore();
    this.emitSelectionChange();
    if (this.drawCustom) {
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.drawCustom(this.ctx);
    }
  }

  clearSelection() {
    this.setSelectedNode(null);
  }

  getViewportCenter(): Point {
    return this.toGraphSpace(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
  }

  private drawGrid() {
    const width = this.canvas.width / this.pixelRatio / this.scale;
    const height = this.canvas.height / this.pixelRatio / this.scale;
    this.ctx.strokeStyle = "#151515";
    this.ctx.lineWidth = 1;
    const gridSize = 24;
    const startX = Math.floor(-this.offset[0] / gridSize) * gridSize;
    const startY = Math.floor(-this.offset[1] / gridSize) * gridSize;
    const endX = -this.offset[0] + width;
    const endY = -this.offset[1] + height;
    for (let x = startX; x < endX; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, -this.offset[1]);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(-this.offset[0], y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  private resize = () => {
    const { clientWidth, clientHeight } = this.canvas;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = clientWidth * this.pixelRatio;
    this.canvas.height = clientHeight * this.pixelRatio;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  };

  private bindEvents() {
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.handleContextMenu);
  }

  private unbindEvents() {
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
  }

  private handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private handleMouseDown = (event: MouseEvent) => {
    const [canvasX, canvasY] = this.getCanvasPoint(event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    this.lastMouse = [canvasX, canvasY];

    for (let index = this.graph.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.graph.nodes[index];
      if (node.getStatusDotHit(graphX, graphY)) {
        this.onStatusDotClick?.(node);
        return;
      }
    }

    const outputSlot = this.getOutputSlotAt(graphX, graphY);
    if (
      outputSlot &&
      outputSlot.node.status === WorkflowStatus.DONE &&
      outputSlot.node.outputValue !== undefined
    ) {
      this.onOutputDotClick?.(outputSlot);
      return;
    }

    if (this.linkEditingEnabled) {
      const inputSlot = this.getInputSlotAt(graphX, graphY);
      if (inputSlot) {
        const existingLinkId = inputSlot.node.inputs[inputSlot.slot]?.linkId;
        if (existingLinkId !== undefined) {
          const existingLink = this.graph.getLinkById(existingLinkId);
          if (existingLink) {
            const fromNode = this.graph.getNodeById(existingLink.fromNodeId);
            if (fromNode) {
              this.onLinkRemoved?.(existingLink);
              this.graph.removeLink(existingLinkId);
              this.linkingInput = { node: inputSlot.node, slot: inputSlot.slot };
            }
          }
        }
        this.linkingInput = { node: inputSlot.node, slot: inputSlot.slot };
        return;
      }

      if (outputSlot) {
        this.linkingOutput = outputSlot;
        return;
      }
    }

    const propertyHit = this.getPropertyAt(graphX, graphY);
    if (propertyHit) {
      this.setSelectedNode(propertyHit.node);
      this.onPropertyClick?.(propertyHit.node, propertyHit.index);
      return;
    }

    const node = this.getNodeAt(graphX, graphY);
    if (node) {
      this.setSelectedNode(node);
      this.draggingCanvas = false;
      if (event.button === 2) {
        return;
      }
      if (!this.nodeDraggingEnabled) {
        return;
      }
      this.draggingNode = node;
      this.draggingOffset = [graphX - node.pos[0], graphY - node.pos[1]];
      return;
    }

    if (event.button === 1 || event.button === 2) {
      this.draggingCanvas = true;
      this.setSelectedNode(null);
      return;
    }

    this.setSelectedNode(null);
    if (!this.nodeDraggingEnabled && !this.linkEditingEnabled) {
      this.draggingCanvas = false;
      return;
    }
    this.draggingCanvas = true;
  };

  private handleMouseMove = (event: MouseEvent) => {
    const [canvasX, canvasY] = this.getCanvasPoint(event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    const dx = (canvasX - this.lastMouse[0]) / this.scale;
    const dy = (canvasY - this.lastMouse[1]) / this.scale;
    this.lastMouse = [canvasX, canvasY];

    if (this.draggingNode) {
      if (!this.nodeDraggingEnabled) {
        this.draggingNode = null;
        return;
      }
      this.draggingNode.pos = [graphX - this.draggingOffset[0], graphY - this.draggingOffset[1]];
      return;
    }

    if (this.linkingOutput) {
      const outputType =
        this.linkingOutput.node.outputs[this.linkingOutput.slot]?.type ?? "number";
      this.hoveredInput = this.findClosestInputSlot(
        graphX,
        graphY,
        this.linkSnapDistance,
        outputType,
        this.linkingOutput.node
      );
      return;
    }

    if (this.linkingInput) {
      const inputType =
        this.linkingInput.node.inputs[this.linkingInput.slot]?.type ?? "number";
      this.hoveredOutput = this.findClosestOutputSlot(
        graphX,
        graphY,
        this.linkSnapDistance,
        inputType,
        this.linkingInput.node
      );
      return;
    }

    if (this.draggingCanvas) {
      if (!this.nodeDraggingEnabled && !this.linkEditingEnabled) {
        this.draggingCanvas = false;
        return;
      }
      this.offset = [this.offset[0] + dx, this.offset[1] + dy];
    }
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (event.button === 1 || event.button === 2) {
      this.draggingCanvas = false;
      return;
    }
    if (!this.linkEditingEnabled) {
      this.linkingOutput = null;
      this.linkingInput = null;
      this.hoveredInput = null;
      this.hoveredOutput = null;
      this.draggingNode = null;
      this.draggingCanvas = false;
      return;
    }
    if (!this.nodeDraggingEnabled) {
      this.draggingNode = null;
    }

    if (this.linkingOutput) {
      const [canvasX, canvasY] = this.getCanvasPoint(event);
      const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
      const outputType =
        this.linkingOutput.node.outputs[this.linkingOutput.slot]?.type ?? "number";
      const inputSlot =
        this.hoveredInput ??
        this.getInputSlotAt(graphX, graphY, outputType, this.linkingOutput.node);
      if (inputSlot) {
        const existingLinkId = inputSlot.node.inputs[inputSlot.slot]?.linkId;
        if (existingLinkId !== undefined) {
          const existingLink = this.graph.getLinkById(existingLinkId);
          if (existingLink) {
            this.onLinkRemoved?.(existingLink);
          }
        }
        const link = this.graph.connect(
          this.linkingOutput.node,
          this.linkingOutput.slot,
          inputSlot.node,
          inputSlot.slot
        );
        this.onLinkAdded?.(link);
      }
    }

    if (this.linkingInput) {
      const [canvasX, canvasY] = this.getCanvasPoint(event);
      const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
      const inputType =
        this.linkingInput.node.inputs[this.linkingInput.slot]?.type ?? "number";
      const outputSlot =
        this.hoveredOutput ??
        this.getOutputSlotAt(graphX, graphY, inputType, this.linkingInput.node);
      if (outputSlot) {
        const existingLinkId = this.linkingInput.node.inputs[this.linkingInput.slot]?.linkId;
        if (existingLinkId !== undefined) {
          const existingLink = this.graph.getLinkById(existingLinkId);
          if (existingLink) {
            this.onLinkRemoved?.(existingLink);
      }
        }
        const link = this.graph.connect(
          outputSlot.node,
          outputSlot.slot,
          this.linkingInput.node,
          this.linkingInput.slot
        );
        this.onLinkAdded?.(link);
      }
    }

    if (this.draggingNode) {
      this.onNodeMoved?.(this.draggingNode);
    }

    this.linkingOutput = null;
    this.linkingInput = null;
    this.hoveredInput = null;
    this.hoveredOutput = null;
    this.draggingNode = null;
    this.draggingCanvas = false;
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.min(2.5, Math.max(0.2, this.scale * zoomFactor));
    const [canvasX, canvasY] = this.getCanvasPoint(event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    this.scale = nextScale;
    this.offset = [canvasX / this.scale - graphX, canvasY / this.scale - graphY];
  };

  private centerOnNodes() {
    if (this.graph.nodes.length === 0) {
      return;
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    this.graph.nodes.forEach((node) => {
      const [x, y] = node.pos;
      const [w, h] = node.size;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const viewportWidth = this.canvas.clientWidth;
    const viewportHeight = this.canvas.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const fitScale = Math.min(
      1,
      Math.min(viewportWidth / (graphWidth + 120), viewportHeight / (graphHeight + 120))
    );
    this.scale = Math.min(1.2, Math.max(0.4, fitScale));

    const centerX = minX + graphWidth / 2;
    const centerY = minY + graphHeight / 2;
    this.offset = [
      viewportWidth / this.scale / 2 - centerX,
      viewportHeight / this.scale / 2 - centerY,
    ];
  }

  private toGraphSpace(screenX: number, screenY: number): Point {
    return [screenX / this.scale - this.offset[0], screenY / this.scale - this.offset[1]];
  }

  private getCanvasPoint(event: MouseEvent | WheelEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  private getNodeAt(graphX: number, graphY: number) {
    for (let i = this.graph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.graph.nodes[i];
      const [x, y] = node.pos;
      const [w, h] = node.size;
      if (graphX >= x && graphX <= x + w && graphY >= y && graphY <= y + h) {
        return node;
      }
    }
    return null;
  }

  private getPropertyAt(graphX: number, graphY: number) {
    for (let i = this.graph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.graph.nodes[i];
      const index = node.getPropertyAt(graphX, graphY);
      if (index !== null) {
        return { node, index };
      }
    }
    return null;
  }

  private getInputSlotAt(
    graphX: number,
    graphY: number,
    matchType?: SlotType,
    excludeNode?: LGraphNode
  ) {
    for (let i = this.graph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.graph.nodes[i];
      if (excludeNode && node === excludeNode) {
        continue;
      }
      for (let slot = 0; slot < node.inputs.length; slot += 1) {
        if (matchType && node.inputs[slot]?.type !== matchType) {
          continue;
        }
        const [slotX, slotY] = node.getInputSlotPos(slot);
        const dx = graphX - slotX;
        const dy = graphY - slotY;
        if (Math.hypot(dx, dy) <= node.slotHitRadius) {
          return { node, slot };
        }
      }
    }
    return null;
  }

  private findClosestInputSlot(
    graphX: number,
    graphY: number,
    maxDistance: number,
    matchType?: SlotType,
    excludeNode?: LGraphNode
  ) {
    let closest: { node: LGraphNode; slot: number } | null = null;
    let bestDistance = maxDistance;
    for (let i = this.graph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.graph.nodes[i];
      if (excludeNode && node === excludeNode) {
        continue;
      }
      for (let slot = 0; slot < node.inputs.length; slot += 1) {
        if (matchType && node.inputs[slot]?.type !== matchType) {
          continue;
        }
        const [slotX, slotY] = node.getInputSlotPos(slot);
        const dx = graphX - slotX;
        const dy = graphY - slotY;
        const distance = Math.hypot(dx, dy);
        if (distance <= bestDistance) {
          bestDistance = distance;
          closest = { node, slot };
        }
      }
    }
    return closest;
  }

  private getOutputSlotAt(
    graphX: number,
    graphY: number,
    matchType?: SlotType,
    excludeNode?: LGraphNode
  ) {
    for (let i = this.graph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.graph.nodes[i];
      if (excludeNode && node === excludeNode) {
        continue;
      }
      for (let slot = 0; slot < node.outputs.length; slot += 1) {
        if (matchType && node.outputs[slot]?.type !== matchType) {
          continue;
        }
        const [slotX, slotY] = node.getOutputSlotPos(slot);
        const dx = graphX - slotX;
        const dy = graphY - slotY;
        if (Math.hypot(dx, dy) <= node.slotHitRadius) {
          return { node, slot };
        }
      }
    }
    return null;
  }

  private findClosestOutputSlot(
    graphX: number,
    graphY: number,
    maxDistance: number,
    matchType?: SlotType,
    excludeNode?: LGraphNode
  ) {
    let closest: { node: LGraphNode; slot: number } | null = null;
    let bestDistance = maxDistance;
    for (let i = this.graph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.graph.nodes[i];
      if (excludeNode && node === excludeNode) {
        continue;
      }
      for (let slot = 0; slot < node.outputs.length; slot += 1) {
        if (matchType && node.outputs[slot]?.type !== matchType) {
          continue;
        }
        const [slotX, slotY] = node.getOutputSlotPos(slot);
        const dx = graphX - slotX;
        const dy = graphY - slotY;
        const distance = Math.hypot(dx, dy);
        if (distance <= bestDistance) {
          bestDistance = distance;
          closest = { node, slot };
        }
      }
    }
    return closest;
  }

  private drawLinkPreview() {
    if (!this.linkingOutput && !this.linkingInput) {
      return;
    }

    if (this.linkingOutput) {
    const [startX, startY] = this.linkingOutput.node.getOutputSlotPos(this.linkingOutput.slot);
    let endX: number;
    let endY: number;
    if (this.hoveredInput) {
      [endX, endY] = this.hoveredInput.node.getInputSlotPos(this.hoveredInput.slot);
    } else {
      [endX, endY] = this.toGraphSpace(this.lastMouse[0], this.lastMouse[1]);
    }
      const outputType = (this.linkingOutput.node.outputs[this.linkingOutput.slot]?.type ??
        "number") as SlotType;
      this.ctx.strokeStyle = getSlotColor(outputType);
      this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.bezierCurveTo(startX + 60, startY, endX - 60, endY, endX, endY);
    this.ctx.stroke();

    if (this.hoveredInput) {
        const inputType = (this.hoveredInput.node.inputs[this.hoveredInput.slot]?.type ??
          "number") as SlotType;
        this.ctx.strokeStyle = getSlotColor(inputType);
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(endX, endY, this.hoveredInput.node.slotRadius + 4, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      return;
    }

    if (this.linkingInput) {
      const [startX, startY] = this.linkingInput.node.getInputSlotPos(this.linkingInput.slot);
      let endX: number;
      let endY: number;
      if (this.hoveredOutput) {
        [endX, endY] = this.hoveredOutput.node.getOutputSlotPos(this.hoveredOutput.slot);
      } else {
        [endX, endY] = this.toGraphSpace(this.lastMouse[0], this.lastMouse[1]);
      }
      const inputType = (this.linkingInput.node.inputs[this.linkingInput.slot]?.type ??
        "number") as SlotType;
      this.ctx.strokeStyle = getSlotColor(inputType);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.bezierCurveTo(startX + 60, startY, endX - 60, endY, endX, endY);
      this.ctx.stroke();

      if (this.hoveredOutput) {
        const outputType = (this.hoveredOutput.node.outputs[this.hoveredOutput.slot]?.type ??
          "number") as SlotType;
        this.ctx.strokeStyle = getSlotColor(outputType);
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(endX, endY, this.hoveredOutput.node.slotRadius + 4, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  private drawSelection() {
    if (!this.selectedNode) {
      return;
    }
    const [x, y] = this.selectedNode.pos;
    const [w, h] = this.selectedNode.size;
    const padding = this.selectionPadding;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(
      x - padding,
      y - padding,
      w + padding * 2,
      h + padding * 2,
      8 + padding
    );
    this.ctx.stroke();
  }

  private getSelectionRect(node: LGraphNode) {
    const [x, y] = node.pos;
    const [w, h] = node.size;
    const padding = this.selectionPadding;
    return {
      x: (x - padding + this.offset[0]) * this.scale,
      y: (y - padding + this.offset[1]) * this.scale,
      width: (w + padding * 2) * this.scale,
      height: (h + padding * 2) * this.scale,
    };
  }

  private emitSelectionChange() {
    if (!this.onSelectionChange) {
      return;
    }
    if (!this.selectedNode) {
      if (this.lastSelectionRect) {
        this.lastSelectionRect = null;
        this.onSelectionChange(null);
      }
      return;
    }
    const rect = this.getSelectionRect(this.selectedNode);
    const prev = this.lastSelectionRect;
    const next = { ...rect, nodeId: this.selectedNode.id };
    if (
      prev &&
      prev.nodeId === next.nodeId &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
    ) {
      return;
    }
    this.lastSelectionRect = next;
    this.onSelectionChange({ node: this.selectedNode, rect });
  }

  private setSelectedNode(node: LGraphNode | null) {
    if (this.selectedNode === node) {
      return;
    }
    this.selectedNode = node;
    this.emitSelectionChange();
  }
}

