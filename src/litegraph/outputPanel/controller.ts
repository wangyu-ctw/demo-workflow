import type { LGraphNode } from "../node";
import type { Point, SlotType } from "../types";
import { WorkflowStatus } from "../../types/workflow";

type RowLayout = {
  label: string;
  type: SlotType;
  lines: string[];
  images: HTMLImageElement[];
};

type PanelCacheEntry = {
  outputValueRef: unknown;
  outputsSignature: string;
  width: number;
  height: number;
  labelCanvas: HTMLCanvasElement;
  fullCanvas: HTMLCanvasElement;
  pendingImages: boolean;
};

const OUTPUT_PANEL_GAP = 20;
const OUTPUT_PANEL_PADDING = 10;
const OUTPUT_PANEL_RADIUS = 10;
const OUTPUT_PANEL_WIDTH = 280;
const OUTPUT_PANEL_ROW_GAP = 8;
const OUTPUT_PANEL_LINE_HEIGHT = 16;
const OUTPUT_PANEL_TEXT_MAX_HEIGHT = 200;
const OUTPUT_PANEL_IMAGE_GAP = 6;
const OUTPUT_PANEL_IMAGE_PLACEHOLDER = 120;
const OUTPUT_PANEL_BG = "rgba(15, 19, 28, 0.92)";
const OUTPUT_PANEL_BORDER = "#2a3246";
const OUTPUT_PANEL_LABEL_COLOR = "#9aa4b2";
const OUTPUT_PANEL_TEXT_COLOR = "#e6e9ef";

export class OutputPanelController {
  private nodes = new Map<string, LGraphNode>();
  private scale = 1;
  private offset: Point = [0, 0];
  private pixelRatio = 1;
  private renderValues = true;
  private imageCache = new Map<string, HTMLImageElement>();
  private panelBitmapCache = new Map<number, PanelCacheEntry>();
  private imageWaiters = new Map<string, Set<number>>();
  private imageListenerAttached = new WeakSet<HTMLImageElement>();

  constructor(private canvas: HTMLCanvasElement) {}

  setNodes(nodes: Map<string, LGraphNode>) {
    this.nodes = nodes;
  }

  setTransform(scale: number, offset: Point, pixelRatio: number) {
    this.scale = scale;
    this.offset = offset;
    this.pixelRatio = pixelRatio;
  }

  setInteractionActive(active: boolean) {
    this.renderValues = true;
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.nodes.size === 0) {
      return;
    }
    const valueWidth = OUTPUT_PANEL_WIDTH - OUTPUT_PANEL_PADDING * 2;
    const maxTextLines = Math.max(
      1,
      Math.floor(OUTPUT_PANEL_TEXT_MAX_HEIGHT / OUTPUT_PANEL_LINE_HEIGHT)
    );
    ctx.save();
    const scaledRatio = this.pixelRatio * this.scale;
    ctx.setTransform(
      scaledRatio,
      0,
      0,
      scaledRatio,
      this.offset[0] * scaledRatio,
      this.offset[1] * scaledRatio
    );
    this.nodes.forEach((node) => {
      if (node.status !== WorkflowStatus.DONE || node.outputValue === undefined) {
        return;
      }
      const [x, y] = node.pos;
      const [w] = node.size;
      const startX = x + w + OUTPUT_PANEL_GAP;
      const outputs: { name: string; type: SlotType }[] =
        node.outputs.length > 0 ? node.outputs : [{ name: "输出", type: "object" }];
      const outputsSignature = outputs.map((output) => `${output.name}:${output.type}`).join("|");
      let cache = this.panelBitmapCache.get(node.id);
      if (!cache || cache.outputValueRef !== node.outputValue || cache.outputsSignature !== outputsSignature) {
        cache = this.buildPanelCache(ctx, node, outputs, valueWidth, maxTextLines);
        this.panelBitmapCache.set(node.id, cache);
      }
      const panelCanvas = this.renderValues ? cache.fullCanvas : cache.labelCanvas;
      ctx.drawImage(panelCanvas, startX, y, cache.width, cache.height);
    });
    ctx.restore();
  }

  private resolveOutputValue(outputName: string, outputValue: unknown, outputCount: number) {
    if (outputCount <= 1) {
      return outputValue;
    }
    if (outputValue && typeof outputValue === "object" && !Array.isArray(outputValue)) {
      const record = outputValue as Record<string, unknown>;
      if (outputName in record) {
        return record[outputName];
      }
    }
    return outputValue;
  }

  private toImageSrc(value: unknown) {
    if (typeof value !== "string") {
      return "";
    }
    if (value.startsWith("data:")) {
      return value;
    }
    return `data:image/png;base64,${value}`;
  }

  private toTextValue(value: unknown) {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return String(value);
      }
    }
    return String(value);
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (!text) {
      return [""];
    }
    const lines: string[] = [];
    let current = "";
    for (const ch of text) {
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) {
      lines.push(current);
    }
    return lines;
  }

  private getImage(src: string) {
    if (!src) {
      return null;
    }
    const cached = this.imageCache.get(src);
    if (cached) {
      return cached;
    }
    const img = new Image();
    img.src = src;
    this.imageCache.set(src, img);
    if (!this.imageListenerAttached.has(img)) {
      this.imageListenerAttached.add(img);
      img.onload = () => {
        const waiters = this.imageWaiters.get(src);
        if (waiters) {
          waiters.forEach((nodeId) => {
            this.panelBitmapCache.delete(nodeId);
          });
          this.imageWaiters.delete(src);
        }
      };
      img.onerror = () => {
        const waiters = this.imageWaiters.get(src);
        if (waiters) {
          waiters.forEach((nodeId) => {
            this.panelBitmapCache.delete(nodeId);
          });
          this.imageWaiters.delete(src);
        }
      };
    }
    return img;
  }

  private registerImageWaiter(src: string, nodeId: number, img: HTMLImageElement) {
    if (img.complete && img.naturalWidth > 0) {
      return;
    }
    const waiters = this.imageWaiters.get(src) ?? new Set<number>();
    waiters.add(nodeId);
    this.imageWaiters.set(src, waiters);
  }

  private buildPanelCache(
    ctx: CanvasRenderingContext2D,
    node: LGraphNode,
    outputs: { name: string; type: SlotType }[],
    valueWidth: number,
    maxTextLines: number
  ): PanelCacheEntry {
    const rows: RowLayout[] = outputs.map((output) => {
      const value = this.resolveOutputValue(output.name, node.outputValue, outputs.length);
      if (output.type === "images") {
        const items = Array.isArray(value) ? value : value ? [value] : [];
        const images = items
          .map((item) => {
            const src = this.toImageSrc(item);
            const img = this.getImage(src);
            if (img) {
              this.registerImageWaiter(src, node.id, img);
            }
            return img;
          })
          .filter((item): item is HTMLImageElement => Boolean(item));
        return { label: output.name, type: output.type, lines: [], images };
      }
      const text = this.toTextValue(value);
      const lines = this.wrapText(ctx, text, valueWidth).slice(0, maxTextLines);
      return { label: output.name, type: output.type, lines, images: [] };
    });

    let pendingImages = false;
    const layoutRows = rows.map((row) => {
      if (row.type === "images" && row.images.length > 0) {
        const imageHeights = row.images.map((img) => {
          if (!img.complete || img.naturalWidth === 0) {
            pendingImages = true;
            return OUTPUT_PANEL_IMAGE_PLACEHOLDER;
          }
          return (img.naturalHeight / img.naturalWidth) * valueWidth;
        });
        const totalHeight =
          imageHeights.reduce((acc, height) => acc + height, 0) +
          Math.max(0, imageHeights.length - 1) * OUTPUT_PANEL_IMAGE_GAP;
        return {
          row,
          imageHeights,
          height: OUTPUT_PANEL_LINE_HEIGHT + Math.max(OUTPUT_PANEL_LINE_HEIGHT, totalHeight),
        };
      }
      const textHeight = Math.max(OUTPUT_PANEL_LINE_HEIGHT, row.lines.length * OUTPUT_PANEL_LINE_HEIGHT);
      return { row, imageHeights: [] as number[], height: OUTPUT_PANEL_LINE_HEIGHT + textHeight };
    });
    const contentHeight =
      layoutRows.reduce((acc, item) => acc + item.height, 0) +
      Math.max(0, layoutRows.length - 1) * OUTPUT_PANEL_ROW_GAP;
    const panelHeight = contentHeight + OUTPUT_PANEL_PADDING * 2;

    const drawPanel = (panelCtx: CanvasRenderingContext2D, renderValues: boolean) => {
      panelCtx.clearRect(0, 0, OUTPUT_PANEL_WIDTH, panelHeight);
      panelCtx.fillStyle = OUTPUT_PANEL_BG;
      panelCtx.strokeStyle = OUTPUT_PANEL_BORDER;
      panelCtx.lineWidth = 1;
      panelCtx.beginPath();
      panelCtx.roundRect(0, 0, OUTPUT_PANEL_WIDTH, panelHeight, OUTPUT_PANEL_RADIUS);
      panelCtx.fill();
      panelCtx.stroke();

      panelCtx.font = "12px sans-serif";
      panelCtx.fillStyle = OUTPUT_PANEL_LABEL_COLOR;
      let cursorY = OUTPUT_PANEL_PADDING;
      layoutRows.forEach((item) => {
        const row = item.row;
        const labelY = cursorY + OUTPUT_PANEL_LINE_HEIGHT - 4;
        panelCtx.fillText(row.label, OUTPUT_PANEL_PADDING, labelY);
        if (renderValues) {
          const valueStartY = cursorY + OUTPUT_PANEL_LINE_HEIGHT;
          panelCtx.fillStyle = OUTPUT_PANEL_TEXT_COLOR;
          if (row.type === "images" && row.images.length > 0) {
            let imageY = valueStartY;
            row.images.forEach((img, index) => {
              const height = item.imageHeights[index] ?? OUTPUT_PANEL_IMAGE_PLACEHOLDER;
              if (img.complete && img.naturalWidth > 0) {
                panelCtx.drawImage(img, OUTPUT_PANEL_PADDING, imageY, valueWidth, height);
              } else {
                panelCtx.strokeStyle = OUTPUT_PANEL_BORDER;
                panelCtx.strokeRect(OUTPUT_PANEL_PADDING, imageY, valueWidth, height);
              }
              imageY += height + OUTPUT_PANEL_IMAGE_GAP;
            });
          } else {
            row.lines.forEach((line, lineIndex) => {
              const lineY = valueStartY + (lineIndex + 1) * OUTPUT_PANEL_LINE_HEIGHT - 4;
              panelCtx.fillText(line, OUTPUT_PANEL_PADDING, lineY);
            });
          }
          panelCtx.fillStyle = OUTPUT_PANEL_LABEL_COLOR;
        }
        cursorY += item.height + OUTPUT_PANEL_ROW_GAP;
      });
    };

    const labelCanvas = document.createElement("canvas");
    const pixelRatio = Math.max(1, this.pixelRatio || 1);
    labelCanvas.width = Math.ceil(OUTPUT_PANEL_WIDTH * pixelRatio);
    labelCanvas.height = Math.ceil(panelHeight * pixelRatio);
    labelCanvas.style.width = `${OUTPUT_PANEL_WIDTH}px`;
    labelCanvas.style.height = `${Math.ceil(panelHeight)}px`;
    const labelCtx = labelCanvas.getContext("2d");
    if (labelCtx) {
      labelCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawPanel(labelCtx, false);
    }

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = Math.ceil(OUTPUT_PANEL_WIDTH * pixelRatio);
    fullCanvas.height = Math.ceil(panelHeight * pixelRatio);
    fullCanvas.style.width = `${OUTPUT_PANEL_WIDTH}px`;
    fullCanvas.style.height = `${Math.ceil(panelHeight)}px`;
    const fullCtx = fullCanvas.getContext("2d");
    if (fullCtx) {
      fullCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawPanel(fullCtx, true);
    }

    return {
      outputValueRef: node.outputValue,
      outputsSignature: outputs.map((output) => `${output.name}:${output.type}`).join("|"),
      width: OUTPUT_PANEL_WIDTH,
      height: panelHeight,
      labelCanvas,
      fullCanvas,
      pendingImages,
    };
  }
}

