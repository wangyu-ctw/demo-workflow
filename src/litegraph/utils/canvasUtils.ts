import type { Point } from "../types";

export type Rect = { x: number; y: number; width: number; height: number };

export const pointInRect = (x: number, y: number, rect: Rect) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

export const graphRectToScreen = (
  rect: Rect,
  scale: number,
  offset: Point,
  canvas: HTMLCanvasElement
) => {
  const canvasRect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const offsetLeft = parentRect ? canvasRect.left - parentRect.left : canvasRect.left;
  const offsetTop = parentRect ? canvasRect.top - parentRect.top : canvasRect.top;
  return {
    left: offsetLeft + (rect.x + offset[0]) * scale,
    top: offsetTop + (rect.y + offset[1]) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
};

export const getCanvasPoint = (canvas: HTMLCanvasElement, event: MouseEvent | WheelEvent): Point => {
  const rect = canvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
};

export const drawWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  lineHeight = 14
) => {
  const maxY = y + maxHeight;
  const flushLine = (line: string, lineY: number) => {
    if (!line) {
      return lineY;
    }
    ctx.fillText(line, x, lineY);
    return lineY + lineHeight;
  };
  const content = String(text);
  const hasSpaces = /\s/.test(content);
  if (!hasSpaces) {
    let line = "";
    let lineY = y;
    for (const ch of content) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lineY = flushLine(line, lineY);
        if (lineY + lineHeight > maxY) {
          return;
        }
        line = ch;
      } else {
        line = test;
      }
    }
    flushLine(line, lineY);
    return;
  }
  const words = content.split(/\s+/g);
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lineY = flushLine(line, lineY);
      if (lineY + lineHeight > maxY) {
        return;
      }
      line = word;
    } else {
      line = test;
    }
  }
  flushLine(line, lineY);
};
