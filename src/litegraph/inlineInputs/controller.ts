import type { InputForm } from "../../types/workflow";
import type { Point } from "../types";
import type { LGraphNode } from "../node";
import { drawWrappedText, graphRectToScreen, pointInRect, type Rect } from "../utils/canvasUtils";

export type InlineInputItem = {
  nodeId: string;
  nodeName: string;
  form: InputForm[];
  status: "pending" | "done" | "waiting";
  formValue?: Record<string, any>;
};

type InlineInputState = {
  node: LGraphNode;
  item: InlineInputItem;
  values: Record<string, any>;
  errors: Record<string, string>;
};

type InlineHitRect = {
  kind: "field" | "submit" | "option";
  nodeId: string;
  fieldKey?: string;
  input?: InputForm[number];
  optionValue?: string;
  optionLabel?: string;
  rect: Rect;
};

type InlineRenderContext = {
  ctx: CanvasRenderingContext2D;
  scale: number;
  offset: Point;
};

export class InlineInputsController {
  private inlineInputs = new Map<string, InlineInputState>();
  private inlineHitRects: InlineHitRect[] = [];
  private inlineEditor: HTMLInputElement | HTMLTextAreaElement | null = null;
  private inlineEditorMeta: InlineHitRect | null = null;
  private inlineImageCache = new Map<string, HTMLImageElement>();
  private scale = 1;
  private offset: Point = [0, 0];

  constructor(private canvas: HTMLCanvasElement) {}

  setTransform(scale: number, offset: Point) {
    this.scale = scale;
    this.offset = offset;
  }

  setInlineInputs(items: InlineInputItem[], resolveNode: (nodeId: string) => LGraphNode | undefined) {
    const next = new Map<string, InlineInputState>();
    items.forEach((item) => {
      const node = resolveNode(item.nodeId);
      if (!node) {
        return;
      }
      const existing = this.inlineInputs.get(item.nodeId);
      const values = existing?.values ?? { ...(item.formValue ?? {}) };
      const errors = existing?.errors ?? {};
      next.set(item.nodeId, { node, item, values, errors });
    });
    this.inlineInputs = next;
    if (this.inlineInputs.size === 0) {
      this.closeInlineEditor();
    }
  }

  render({ ctx }: InlineRenderContext) {
    if (this.inlineInputs.size === 0) {
      this.inlineHitRects = [];
      return;
    }
    const panelWidth = 240;
    const panelPadding = 10;
    const labelHeight = 14;
    const labelGap = 4;
    const fieldGap = 10;
    const inputHeight = 24;
    const textareaHeight = 72;
    const submitHeight = 26;
    const submitGap = 20;
    const panelOffset = 20;
    const optionRowHeight = 22;
    const thumbSize = 44;
    const thumbGap = 6;
    ctx.textBaseline = "top";
    this.inlineHitRects = [];

    this.inlineInputs.forEach((state) => {
      const { node, item, values, errors } = state;
      const inputs = item.form.flatMap((form, formIndex) =>
        form.map((input) => ({ input, formIndex }))
      );
        const panelX = node.pos[0] - panelOffset - panelWidth;
        const panelY = node.pos[1];

      const computeFieldHeight = (input: InputForm[number], formIndex: number) => {
        if (input.type === "object") {
          return textareaHeight;
        }
        if (input.type === "images") {
          const fieldKey = this.getFieldKey(formIndex, input.name);
          const listValue = Array.isArray(values[fieldKey]) ? values[fieldKey] : [];
          const thumbnails = listValue.length;
          if (thumbnails === 0) {
            return inputHeight;
          }
          const usableWidth = panelWidth - panelPadding * 2;
          const perRow = Math.max(1, Math.floor((usableWidth + thumbGap) / (thumbSize + thumbGap)));
          const rows = Math.ceil(thumbnails / perRow);
          return inputHeight + rows * (thumbSize + thumbGap);
        }
        if (input.type === "select") {
          const optionCount = input.options?.length ?? 0;
          return optionCount > 0 ? optionCount * optionRowHeight : inputHeight;
        }
        return inputHeight;
      };

      let fieldsHeight = 0;
      inputs.forEach(({ input, formIndex }) => {
        const fieldHeight = computeFieldHeight(input, formIndex);
        fieldsHeight += labelHeight + labelGap + fieldHeight;
      });
      const totalGaps = Math.max(0, inputs.length - 1) * fieldGap;
      const totalHeight =
        panelPadding * 2 + fieldsHeight + totalGaps + submitGap + submitHeight;

      ctx.fillStyle = "#161b26";
      ctx.strokeStyle = "#283044";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelWidth, totalHeight, 10);
      ctx.fill();
      ctx.stroke();

      let cursorY = panelY + panelPadding;
      inputs.forEach(({ input, formIndex }, index) => {
        const fieldKey = this.getFieldKey(formIndex, input.name);
        const label = input.label?.trim() || input.name;
        ctx.fillStyle = item.status === "done" ? "#7f8a9e" : "#c8d0db";
        ctx.font = "12px sans-serif";
        ctx.fillText(label, panelX + panelPadding, cursorY);
        if (input.required) {
          const labelWidth = ctx.measureText(label).width;
          ctx.fillStyle = "#ff5a5a";
          ctx.fillText("*", panelX + panelPadding + labelWidth + 4, cursorY);
        }
        cursorY += labelHeight + labelGap;

        const fieldHeight = computeFieldHeight(input, formIndex);
        const fieldRect = {
          x: panelX + panelPadding,
          y: cursorY,
          width: panelWidth - panelPadding * 2,
          height: input.type === "images" ? inputHeight : fieldHeight,
        };

        ctx.fillStyle = "#0f131c";
        ctx.strokeStyle = "#2a2f3a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(fieldRect.x, fieldRect.y, fieldRect.width, fieldRect.height, 6);
        ctx.fill();
        ctx.stroke();

        const value = values[fieldKey];
        let displayText = "";
        if (input.type === "object") {
          if (!value) {
            displayText = "点击输入 JSON";
          } else if (typeof value === "string") {
            displayText = value;
          } else {
            try {
              displayText = JSON.stringify(value, null, 2);
            } catch (error) {
              displayText = String(value);
            }
          }
        } else if (input.type === "number") {
          displayText = value !== undefined && value !== "" ? String(value) : "请输入数字";
        } else if (input.type === "string") {
          displayText = value ? String(value) : "请输入文本";
        } else if (input.type === "select") {
          displayText = "";
        } else if (input.type === "images") {
          const listValue = Array.isArray(value) ? value : [];
          displayText = listValue.length ? `已上传 ${listValue.length} 张` : "点击上传图片";
        }

        ctx.fillStyle = item.status === "done" ? "#6f7a8a" : "#9aa4b2";
        ctx.font = "12px sans-serif";
        if (input.type === "object" || input.type === "string") {
          drawWrappedText(
            ctx,
            displayText,
            fieldRect.x + 8,
            fieldRect.y + 6,
            fieldRect.width - 16,
            fieldRect.height - 8
          );
        } else if (input.type !== "select") {
          ctx.fillText(displayText, fieldRect.x + 8, fieldRect.y + 6);
        }

        if (input.type !== "select" && item.status !== "done") {
          this.inlineHitRects.push({
            kind: "field",
            nodeId: item.nodeId,
            fieldKey,
            input,
            rect: fieldRect,
          });
        }

        if (input.type === "images") {
          const listValue = Array.isArray(value) ? value : [];
          if (listValue.length > 0) {
            const usableWidth = panelWidth - panelPadding * 2;
            const perRow = Math.max(1, Math.floor((usableWidth + thumbGap) / (thumbSize + thumbGap)));
            listValue.forEach((url: string, idx: number) => {
              const row = Math.floor(idx / perRow);
              const col = idx % perRow;
              const thumbX = fieldRect.x + col * (thumbSize + thumbGap);
              const thumbY = fieldRect.y + inputHeight + row * (thumbSize + thumbGap);
              const img = this.getInlineImage(url);
              if (img && img.complete) {
                ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
              } else {
                ctx.fillStyle = "#1c2433";
                ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
              }
            });
          }
        }

        if (input.type === "select") {
          const options = input.options ?? [];
          if (options.length === 0) {
            ctx.fillStyle = "#9aa4b2";
            ctx.fillText("暂无选项", fieldRect.x + 8, fieldRect.y + 6);
          } else {
            const listValue =
              input.max === 1 ? [value].filter(Boolean) : Array.isArray(value) ? value : [];
            options.forEach((option, optionIndex) => {
              const rowY = fieldRect.y + optionIndex * optionRowHeight;
              const isSelected = listValue.includes(option.value);
              ctx.fillStyle = isSelected ? "#1d283a" : "#0f131c";
              ctx.fillRect(fieldRect.x, rowY, fieldRect.width, optionRowHeight - 2);
              ctx.fillStyle = isSelected ? "#2d9cdb" : "#9aa4b2";
              ctx.fillText(isSelected ? "✓" : "•", fieldRect.x + 8, rowY + 4);
              ctx.fillStyle = isSelected ? "#e6e9ef" : "#c8d0db";
              ctx.fillText(option.label, fieldRect.x + 22, rowY + 4);
              if (item.status !== "done") {
                this.inlineHitRects.push({
                  kind: "option",
                  nodeId: item.nodeId,
                  fieldKey,
                  input,
                  optionValue: option.value,
                  optionLabel: option.label,
                  rect: {
                    x: fieldRect.x,
                    y: rowY,
                    width: fieldRect.width,
                    height: optionRowHeight,
                  },
                });
              }
            });
          }
        }

        if (errors[fieldKey]) {
          ctx.fillStyle = "#ff5a5a";
          ctx.fillText(errors[fieldKey], fieldRect.x, fieldRect.y + fieldRect.height + 4);
        }

        cursorY += fieldHeight;
        if (index < inputs.length - 1) {
          cursorY += fieldGap;
        }
      });

      const submitRect = {
        x: panelX + panelPadding,
        y: panelY + panelPadding + fieldsHeight + totalGaps + submitGap,
        width: panelWidth - panelPadding * 2,
        height: submitHeight,
      };
      ctx.fillStyle = item.status === "done" ? "#3a3f4b" : "#2d9cdb";
      ctx.strokeStyle = item.status === "done" ? "#3a3f4b" : "#2d9cdb";
      ctx.beginPath();
      ctx.roundRect(submitRect.x, submitRect.y, submitRect.width, submitRect.height, 6);
      ctx.fill();
      ctx.fillStyle = item.status === "done" ? "#c8d0db" : "#ffffff";
      ctx.font = "12px sans-serif";
      const submitText = item.status === "done" ? "已提交执行" : "提交";
      const submitTextWidth = ctx.measureText(submitText).width;
      ctx.fillText(
        submitText,
        submitRect.x + submitRect.width / 2 - submitTextWidth / 2,
        submitRect.y + 6
      );
      if (item.status !== "done") {
        this.inlineHitRects.push({
          kind: "submit",
          nodeId: item.nodeId,
          rect: submitRect,
        });
      }
    });
  }

  hitTest(graphX: number, graphY: number) {
    return this.inlineHitRects.find((item) => pointInRect(graphX, graphY, item.rect));
  }

  handleOptionHit(hit: InlineHitRect) {
    if (!hit.fieldKey || !hit.input || !hit.optionValue) {
      return;
    }
    this.toggleInlineOption(hit.nodeId, hit.fieldKey, hit.input, hit.optionValue);
  }

  submit(nodeId: string, onSubmit: (nodeId: string, values: Record<string, any>) => void) {
    this.submitInlineValues(nodeId, onSubmit);
  }

  openEditor(hit: InlineHitRect) {
    if (hit.kind !== "field" || !hit.input || !hit.fieldKey) {
      return;
    }
    const fieldKey = hit.fieldKey;
    const state = this.inlineInputs.get(hit.nodeId);
    if (!state || state.item.status === "done") {
      return;
    }
    this.closeInlineEditor();
    const container = this.canvas.parentElement;
    if (!container) {
      return;
    }
    const rect = graphRectToScreen(hit.rect, this.scale, this.offset, this.canvas);
    const commonStyle = {
      position: "absolute",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(60, rect.width)}px`,
      height: `${Math.max(20, rect.height)}px`,
      zIndex: "6",
      pointerEvents: "auto",
      fontSize: `${12 * this.scale}px`,
      color: "#e6e9ef",
      background: "#0f131c",
      border: "1px solid #2a2f3a",
      borderRadius: "6px",
      outline: "none",
      padding: "4px 6px",
      boxSizing: "border-box",
    } as const;

    if (hit.input.type === "object") {
      const textarea = document.createElement("textarea");
      textarea.value = state.values[fieldKey] ?? "";
      Object.assign(textarea.style, commonStyle);
      textarea.style.height = `${Math.max(60, rect.height)}px`;
      textarea.addEventListener("blur", () => {
        this.updateInlineValue(hit.nodeId, fieldKey, textarea.value);
        this.closeInlineEditor();
      });
      container.appendChild(textarea);
      textarea.focus();
      this.inlineEditor = textarea;
      this.inlineEditorMeta = hit;
      return;
    }
    if (hit.input.type === "select") {
      return;
    }
    if (hit.input.type === "images") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (!hit.input.max || hit.input.max > 1) {
        input.multiple = true;
      }
      Object.assign(input.style, commonStyle);
      input.addEventListener("change", () => {
        const files = Array.from(input.files ?? []);
        if (files.length === 0) {
          this.closeInlineEditor();
          return;
        }
        const remaining = hit.input?.max
          ? Math.max(
              0,
              hit.input.max -
                (Array.isArray(state.values[fieldKey]) ? state.values[fieldKey].length : 0)
            )
          : files.length;
        const nextFiles = files.slice(0, remaining);
        const readFile = (file: File) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          });
        Promise.all(nextFiles.map(readFile)).then((urls) => {
          const existing = Array.isArray(state.values[fieldKey]) ? state.values[fieldKey] : [];
          const nextValues = [...existing, ...urls];
          this.updateInlineValue(hit.nodeId, fieldKey, nextValues);
          this.closeInlineEditor();
        });
      });
      input.addEventListener("blur", () => this.closeInlineEditor());
      container.appendChild(input);
      this.inlineEditor = input;
      this.inlineEditorMeta = hit;
      input.click();
      return;
    }
    const input = document.createElement("input");
    input.type = hit.input.type === "number" ? "number" : "text";
    input.value = state.values[fieldKey] ?? "";
    Object.assign(input.style, commonStyle);
    input.addEventListener("blur", () => {
      const nextValue = input.type === "number" ? input.value : input.value;
      this.updateInlineValue(hit.nodeId, fieldKey, nextValue);
      this.closeInlineEditor();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur();
      }
    });
    container.appendChild(input);
    input.focus();
    this.inlineEditor = input;
    this.inlineEditorMeta = hit;
  }

  closeInlineEditor() {
    const editor = this.inlineEditor;
    this.inlineEditor = null;
    this.inlineEditorMeta = null;
    if (editor && editor.isConnected) {
      try {
        editor.remove();
      } catch (error) {
        // swallow to avoid breaking render loop on DOM race
      }
    }
  }

  commitInlineEditor() {
    const editor = this.inlineEditor;
    const meta = this.inlineEditorMeta;
    if (!editor || !meta || meta.kind !== "field" || !meta.fieldKey) {
      return;
    }
    const state = this.inlineInputs.get(meta.nodeId);
    if (!state || state.item.status === "done") {
      this.closeInlineEditor();
      return;
    }
    const inputType = meta.input?.type;
    if (inputType === "images") {
      this.closeInlineEditor();
      return;
    }
    if (inputType === "object") {
      if (editor instanceof HTMLTextAreaElement) {
        this.updateInlineValue(meta.nodeId, meta.fieldKey, editor.value);
      }
      this.closeInlineEditor();
      return;
    }
    if (editor instanceof HTMLInputElement) {
      this.updateInlineValue(meta.nodeId, meta.fieldKey, editor.value);
    }
    this.closeInlineEditor();
  }

  destroy() {
    this.closeInlineEditor();
  }

  private getFieldKey(formIndex: number, inputName: string) {
    return `${formIndex}:${inputName}`;
  }

  private updateInlineValue(nodeId: string, fieldKey: string, value: any) {
    const state = this.inlineInputs.get(nodeId);
    if (!state) {
      return;
    }
    state.values = { ...state.values, [fieldKey]: value };
    if (state.errors[fieldKey]) {
      state.errors = { ...state.errors, [fieldKey]: "" };
    }
    this.inlineInputs.set(nodeId, state);
  }

  private toggleInlineOption(nodeId: string, fieldKey: string, input: InputForm[number], value: string) {
    const state = this.inlineInputs.get(nodeId);
    if (!state || state.item.status === "done") {
      return;
    }
    const selectionMax = input.max;
    if (selectionMax === 1) {
      state.values = { ...state.values, [fieldKey]: value };
      state.errors = { ...state.errors, [fieldKey]: "" };
      this.inlineInputs.set(nodeId, state);
      return;
    }
    const current = Array.isArray(state.values[fieldKey]) ? state.values[fieldKey] : [];
    const exists = current.includes(value);
    let next = current;
    if (exists) {
      next = current.filter((item: string) => item !== value);
    } else {
      if (selectionMax && current.length >= selectionMax) {
        state.errors = { ...state.errors, [fieldKey]: `最多选择 ${selectionMax} 项` };
        this.inlineInputs.set(nodeId, state);
        return;
      }
      next = [...current, value];
    }
    state.values = { ...state.values, [fieldKey]: next };
    state.errors = { ...state.errors, [fieldKey]: "" };
    this.inlineInputs.set(nodeId, state);
  }

  private submitInlineValues(nodeId: string, onSubmit: (nodeId: string, values: Record<string, any>) => void) {
    const state = this.inlineInputs.get(nodeId);
    if (!state) {
      return;
    }
    const nextValues = { ...state.values };
    const nextErrors: Record<string, string> = {};
    state.item.form.forEach((form, formIndex) => {
      form.forEach((input) => {
        const key = this.getFieldKey(formIndex, input.name);
        const value = nextValues[key];
        if (input.type === "object") {
          if (value === undefined || value === null || String(value).trim() === "") {
            if (input.required) {
              nextErrors[key] = "必填";
            }
            return;
          }
          try {
            nextValues[key] = typeof value === "string" ? JSON.parse(value) : value;
          } catch (error) {
            nextErrors[key] = "JSON 格式错误";
          }
          return;
        }
        if (input.type === "images") {
          const listValue = Array.isArray(value) ? value : value ? [value] : [];
          if (input.max && listValue.length > input.max) {
            nextErrors[key] = `最多上传 ${input.max} 张`;
            return;
          }
          if (input.required && listValue.length === 0) {
            nextErrors[key] = "必填";
          }
          nextValues[key] = listValue;
          return;
        }
        if (input.type === "select") {
          const selectionMax = input.max;
          if (selectionMax === 1) {
            if (
              input.required &&
              (value === undefined || value === null || String(value).trim() === "")
            ) {
              nextErrors[key] = "必填";
            }
            return;
          }
          const listValue = Array.isArray(value) ? value : [];
          if (selectionMax && listValue.length > selectionMax) {
            nextErrors[key] = `最多选择 ${selectionMax} 项`;
            return;
          }
          if (input.required && listValue.length === 0) {
            nextErrors[key] = "必填";
          }
          return;
        }
        if (!input.required) {
          return;
        }
        const isEmptyArray = Array.isArray(value) && value.length === 0;
        if (isEmptyArray || value === undefined || value === null || String(value).trim() === "") {
          nextErrors[key] = "必填";
        }
      });
    });
    state.errors = nextErrors;
    this.inlineInputs.set(nodeId, state);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    state.item = { ...state.item, status: "done" };
    this.inlineInputs.set(nodeId, state);
    onSubmit(nodeId, nextValues);
  }

  private getInlineImage(url: string) {
    if (!url) {
      return null;
    }
    const cached = this.inlineImageCache.get(url);
    if (cached) {
      return cached;
    }
    const img = new Image();
    img.src = url;
    this.inlineImageCache.set(url, img);
    return img;
  }
}

