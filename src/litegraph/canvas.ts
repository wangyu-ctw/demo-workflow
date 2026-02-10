import { getSlotColor } from "../utils/constants";
import { getCanvasPoint } from "./utils/canvasUtils";
import type { LLink, Point, SlotType } from "./types";
import { LGraph } from "./graph";
import { LGraphNode } from "./node";
import type { InlineInputItem } from "./inlineInputs/controller";
import { InlineInputsController } from "./inlineInputs/controller";

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
  onSelectionChange?: (
    selection:
      | { node: LGraphNode; rect: { x: number; y: number; width: number; height: number } }
      | null
  ) => void;
  onInlineSubmit?: (nodeId: string, values: Record<string, any>) => void;
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
  private inlineController: InlineInputsController;
  private lastSelectionRect:
    | { x: number; y: number; width: number; height: number; nodeId: number }
    | null = null;
  private linkSnapDistance = 18;
  private didAutoCenter = false;
  private isInteracting = false;
  private wheelTimer: number | null = null;
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
    this.inlineController = new InlineInputsController(canvas);
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
    this.inlineController.destroy();
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
    const now = performance.now();
    this.graph.draw(this.ctx, now);
    this.inlineController.setTransform(this.scale, this.offset);
    this.inlineController.render({ ctx: this.ctx, scale: this.scale, offset: this.offset });
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

  getTransform() {
    return { scale: this.scale, offset: [...this.offset] as Point, pixelRatio: this.pixelRatio };
  }

  isInteractionActive() {
    return this.isInteracting;
  }

  getNodeScreenRect(node: LGraphNode) {
    const [x, y] = node.pos;
    const [w, h] = node.size;
    return {
      x: (x + this.offset[0]) * this.scale,
      y: (y + this.offset[1]) * this.scale,
      width: w * this.scale,
      height: h * this.scale,
    };
  }

  getViewportCenter(): Point {
    return this.toGraphSpace(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
  }

  setInlineInputs(
    items: InlineInputItem[],
    resolveNode: (nodeId: string) => LGraphNode | undefined
  ) {
    this.inlineController.setInlineInputs(items, resolveNode);
  }

  private drawGrid() {
    const width = this.canvas.width / this.pixelRatio / this.scale;
    const height = this.canvas.height / this.pixelRatio / this.scale;
    this.ctx.strokeStyle = "#b6b6b6";
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
    this.isInteracting = true;
    const [canvasX, canvasY] = getCanvasPoint(this.canvas, event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    this.lastMouse = [canvasX, canvasY];

    if (this.handleInlineMouseDown(graphX, graphY, event)) {
      return;
    }
    this.inlineController.commitInlineEditor();

    if (this.handleStatusDotMouseDown(graphX, graphY)) {
      return;
    }

    const outputSlot = this.getOutputSlotAt(graphX, graphY);
    if (this.handleLinkingStart(graphX, graphY, outputSlot)) {
      return;
    }

    if (this.handlePropertyMouseDown(graphX, graphY)) {
      return;
    }

    if (this.handleNodeMouseDown(graphX, graphY, event)) {
      return;
    }

    this.handleCanvasMouseDown(event);
  };

  private handleMouseMove = (event: MouseEvent) => {
    const [canvasX, canvasY] = getCanvasPoint(this.canvas, event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    const dx = (canvasX - this.lastMouse[0]) / this.scale;
    const dy = (canvasY - this.lastMouse[1]) / this.scale;
    this.lastMouse = [canvasX, canvasY];

    if (this.handleDraggingNode(graphX, graphY)) {
      return;
    }
    if (this.handleLinkingOutputHover(graphX, graphY)) {
      return;
    }
    if (this.handleLinkingInputHover(graphX, graphY)) {
      return;
    }
    this.handleDraggingCanvas(dx, dy);
    this.updateCursor(graphX, graphY);
  };

  private handleMouseUp = (event: MouseEvent) => {
    this.isInteracting = false;
    if (this.wheelTimer !== null) {
      window.clearTimeout(this.wheelTimer);
      this.wheelTimer = null;
    }
    if (this.handleMouseUpCanvasButtons(event)) {
      return;
    }
    if (!this.linkEditingEnabled) {
      this.resetInteractionState();
      this.updateCursor(...this.toGraphSpace(this.lastMouse[0], this.lastMouse[1]));
      return;
    }
    if (!this.nodeDraggingEnabled) {
      this.draggingNode = null;
    }

    if (this.linkingOutput) {
      this.finalizeLinkingOutput(event);
    }
    if (this.linkingInput) {
      this.finalizeLinkingInput(event);
    }
    if (this.draggingNode) {
      this.onNodeMoved?.(this.draggingNode);
    }

    this.resetInteractionState();
    this.updateCursor(...this.toGraphSpace(this.lastMouse[0], this.lastMouse[1]));
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.isInteracting = true;
    if (this.wheelTimer !== null) {
      window.clearTimeout(this.wheelTimer);
    }
    this.wheelTimer = window.setTimeout(() => {
      this.isInteracting = false;
      this.wheelTimer = null;
    }, 120);
    this.inlineController.closeInlineEditor();
    this.applyZoom(event);
  };

  private handleInlineMouseDown(graphX: number, graphY: number, event: MouseEvent) {
    const inlineHit = this.inlineController.hitTest(graphX, graphY);
    if (!inlineHit) {
      return false;
    }
    this.inlineController.commitInlineEditor();
    event.preventDefault();
    event.stopPropagation();
    if (inlineHit.kind === "submit") {
      this.inlineController.submit(inlineHit.nodeId, (nodeId, values) => {
        this.onInlineSubmit?.(nodeId, values);
      });
    } else if (inlineHit.kind === "option") {
      this.inlineController.handleOptionHit(inlineHit);
    } else {
      this.inlineController.openEditor(inlineHit);
    }
    return true;
  }

  private handleStatusDotMouseDown(graphX: number, graphY: number) {
    for (let index = this.graph.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.graph.nodes[index];
      if (node.getStatusDotHit(graphX, graphY)) {
        this.onStatusDotClick?.(node);
        return true;
      }
    }
    return false;
  }

  private handleLinkingStart(
    graphX: number,
    graphY: number,
    outputSlot?: { node: LGraphNode; slot: number } | null
  ) {
    if (!this.linkEditingEnabled) {
      return false;
    }
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
      return true;
    }
    if (outputSlot) {
      this.linkingOutput = outputSlot;
      return true;
    }
    return false;
  }

  private handlePropertyMouseDown(graphX: number, graphY: number) {
    const propertyHit = this.getPropertyAt(graphX, graphY);
    if (!propertyHit) {
      return false;
    }
    this.setSelectedNode(propertyHit.node);
    this.onPropertyClick?.(propertyHit.node, propertyHit.index);
    return true;
  }

  private handleNodeMouseDown(graphX: number, graphY: number, event: MouseEvent) {
    const node = this.getNodeAt(graphX, graphY);
    if (!node) {
      return false;
    }
    this.setSelectedNode(node);
    this.draggingCanvas = false;
    if (event.button === 2) {
      return true;
    }
    if (!this.nodeDraggingEnabled) {
      return true;
    }
    this.draggingNode = node;
    this.draggingOffset = [graphX - node.pos[0], graphY - node.pos[1]];
    return true;
  }

  private handleCanvasMouseDown(event: MouseEvent) {
    if (event.button === 1 || event.button === 2) {
      this.draggingCanvas = true;
      this.setCursor("grabbing");
      this.setSelectedNode(null);
      return;
    }
    this.setSelectedNode(null);
    if (!this.nodeDraggingEnabled && !this.linkEditingEnabled) {
      this.draggingCanvas = false;
      return;
    }
    this.draggingCanvas = true;
    this.setCursor("grabbing");
  }

  private handleDraggingNode(graphX: number, graphY: number) {
    if (!this.draggingNode) {
      return false;
    }
    if (!this.nodeDraggingEnabled) {
      this.draggingNode = null;
      return true;
    }
    this.draggingNode.pos = [graphX - this.draggingOffset[0], graphY - this.draggingOffset[1]];
    return true;
  }

  private handleLinkingOutputHover(graphX: number, graphY: number) {
    if (!this.linkingOutput) {
      return false;
    }
    const outputType = this.linkingOutput.node.outputs[this.linkingOutput.slot]?.type ?? "number";
    this.hoveredInput = this.findClosestInputSlot(
      graphX,
      graphY,
      this.linkSnapDistance,
      outputType,
      this.linkingOutput.node
    );
    return true;
  }

  private handleLinkingInputHover(graphX: number, graphY: number) {
    if (!this.linkingInput) {
      return false;
    }
    const inputType = this.linkingInput.node.inputs[this.linkingInput.slot]?.type ?? "number";
    this.hoveredOutput = this.findClosestOutputSlot(
      graphX,
      graphY,
      this.linkSnapDistance,
      inputType,
      this.linkingInput.node
    );
    return true;
  }

  private handleDraggingCanvas(dx: number, dy: number) {
    if (!this.draggingCanvas) {
      return;
    }
    if (!this.nodeDraggingEnabled && !this.linkEditingEnabled) {
      this.draggingCanvas = false;
      return;
    }
    this.offset = [this.offset[0] + dx, this.offset[1] + dy];
  }

  private handleMouseUpCanvasButtons(event: MouseEvent) {
    if (event.button !== 1 && event.button !== 2) {
      return false;
    }
    this.draggingCanvas = false;
    this.updateCursor(...this.toGraphSpace(this.lastMouse[0], this.lastMouse[1]));
    return true;
  }

  private finalizeLinkingOutput(event: MouseEvent) {
    const [canvasX, canvasY] = getCanvasPoint(this.canvas, event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    const outputType = this.linkingOutput?.node.outputs[this.linkingOutput.slot]?.type ?? "number";
    const inputSlot =
      this.hoveredInput ?? this.getInputSlotAt(graphX, graphY, outputType, this.linkingOutput?.node);
    if (!inputSlot || !this.linkingOutput) {
      return;
    }
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

  private finalizeLinkingInput(event: MouseEvent) {
    const [canvasX, canvasY] = getCanvasPoint(this.canvas, event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    const inputType = this.linkingInput?.node.inputs[this.linkingInput.slot]?.type ?? "number";
    const outputSlot =
      this.hoveredOutput ?? this.getOutputSlotAt(graphX, graphY, inputType, this.linkingInput?.node);
    if (!outputSlot || !this.linkingInput) {
      return;
    }
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

  private resetInteractionState() {
    this.linkingOutput = null;
    this.linkingInput = null;
    this.hoveredInput = null;
    this.hoveredOutput = null;
    this.draggingNode = null;
    this.draggingCanvas = false;
  }

  private applyZoom(event: WheelEvent) {
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.min(2.5, Math.max(0.2, this.scale * zoomFactor));
    const [canvasX, canvasY] = getCanvasPoint(this.canvas, event);
    const [graphX, graphY] = this.toGraphSpace(canvasX, canvasY);
    this.scale = nextScale;
    this.offset = [canvasX / this.scale - graphX, canvasY / this.scale - graphY];
  }

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

  private setCursor(cursor: string) {
    if (this.canvas.style.cursor !== cursor) {
      this.canvas.style.cursor = cursor;
    }
  }

  private updateCursor(graphX: number, graphY: number) {
    if (this.draggingCanvas) {
      this.setCursor("grabbing");
      return;
    }

    if (this.inlineController.hitTest(graphX, graphY)) {
      this.setCursor("pointer");
      return;
    }

    if (this.getNodeAt(graphX, graphY)) {
      this.setCursor("crosshair");
      return;
    }

    if (this.getLinkAt(graphX, graphY)) {
      this.setCursor("crosshair");
      return;
    }

    this.setCursor("default");
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

  private getLinkAt(graphX: number, graphY: number) {
    const threshold = 6;
    for (const link of this.graph.links.values()) {
      const fromNode = this.graph.getNodeById(link.fromNodeId);
      const toNode = this.graph.getNodeById(link.toNodeId);
      if (!fromNode || !toNode) {
        continue;
      }
      const [startX, startY] = fromNode.getOutputSlotPos(link.fromSlot);
      const [endX, endY] = toNode.getInputSlotPos(link.toSlot);
      const cp1X = startX + 60;
      const cp1Y = startY;
      const cp2X = endX - 60;
      const cp2Y = endY;
      for (let t = 0; t <= 1; t += 0.05) {
        const x =
          Math.pow(1 - t, 3) * startX +
          3 * Math.pow(1 - t, 2) * t * cp1X +
          3 * (1 - t) * Math.pow(t, 2) * cp2X +
          Math.pow(t, 3) * endX;
        const y =
          Math.pow(1 - t, 3) * startY +
          3 * Math.pow(1 - t, 2) * t * cp1Y +
          3 * (1 - t) * Math.pow(t, 2) * cp2Y +
          Math.pow(t, 3) * endY;
        const dx = graphX - x;
        const dy = graphY - y;
        if (Math.hypot(dx, dy) <= threshold) {
          return link;
        }
      }
    }
    return null;
  }
}
