import type { LGraphNode } from "../litegraph";
import { LGraph, LGraphCanvas, LGraphNode as BaseGraphNode } from "../litegraph";
import type { GraphLink, GraphNodeSnapshot } from "../stores/graphStore";
import { useGraphStore } from "../stores/graphStore";
import type { NodeProperty, NodeSnapshot } from "../stores/nodeStore";
import { getNodeDefaultProperties, useNodeStore } from "../stores/nodeStore";
import { useWorkflowStore } from "../stores/workflowStore";
import type { SlotType } from "./types";
import { WorkflowStatus } from "../types/workflow";

type SelectionRect = { x: number; y: number; width: number; height: number };
type GraphSessionOptions = {
  onSelectionChange?: (selection: { rect: SelectionRect; node: GraphNodeSnapshot } | null) => void;
  onPropertyClick?: (payload: {
    node: GraphNodeSnapshot;
    property: NodeProperty<unknown>;
    value: unknown;
  }) => void;
  onStatusDotClick?: (node: GraphNodeSnapshot) => void;
  onOutputDotClick?: (payload: {
    node: GraphNodeSnapshot;
    outputType: SlotType;
    value: unknown;
  }) => void;
};

type RowLayout = {
  label: string;
  type: SlotType;
  lines: string[];
  images: HTMLImageElement[];
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

export const createGraphSession = (canvas: HTMLCanvasElement, options: GraphSessionOptions = {}) => {
  const graph = new LGraph();
  const canvasView = new LGraphCanvas(canvas, graph);

  const { nodes: graphNodes, links } = useGraphStore.getState();
  const { updateNodePosition, addLink, removeLink, removeNode, updateNodeProperty } =
    useGraphStore.getState();
  const nodeInstances = new Map<string, LGraphNode>();
  const nodeIdMap = new Map<number, string>();
  const linkKeyMap = new Map<string, number>();
  const imageCache = new Map<string, HTMLImageElement>();
  const panelCache = new Map<number, { outputValueRef: unknown; outputsSignature: string; rows: RowLayout[] }>();

  const resolveOutputValue = (outputName: string, outputValue: unknown, outputCount: number) => {
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
  };

  const toImageSrc = (value: unknown) => {
    if (typeof value !== "string") {
      return "";
    }
    if (value.startsWith("data:")) {
      return value;
    }
    return `data:image/png;base64,${value}`;
  };

  const toTextValue = (value: unknown) => {
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
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
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
  };

  const getImage = (src: string) => {
    if (!src) {
      return null;
    }
    const cached = imageCache.get(src);
    if (cached) {
      return cached;
    }
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
    return img;
  };

  const drawOutputPanels = (ctx: CanvasRenderingContext2D) => {
    const valueWidth = OUTPUT_PANEL_WIDTH - OUTPUT_PANEL_PADDING * 2;
    const maxTextLines = Math.max(1, Math.floor(OUTPUT_PANEL_TEXT_MAX_HEIGHT / OUTPUT_PANEL_LINE_HEIGHT));
    const renderValues = !canvasView.isInteractionActive();
    const { scale, offset, pixelRatio } = canvasView.getTransform();
    ctx.save();
    const scaledRatio = pixelRatio * scale;
    ctx.setTransform(
      scaledRatio,
      0,
      0,
      scaledRatio,
      offset[0] * scaledRatio,
      offset[1] * scaledRatio
    );
    nodeInstances.forEach((node) => {
      if (node.status !== WorkflowStatus.DONE || node.outputValue === undefined) {
        return;
      }
      const [x, y] = node.pos;
      const [w] = node.size;
      const startX = x + w + OUTPUT_PANEL_GAP;
      let cursorY = y + OUTPUT_PANEL_PADDING;
      const outputs: { name: string; type: SlotType }[] =
        node.outputs.length > 0 ? node.outputs : [{ name: "输出", type: "object" }];
      const outputsSignature = outputs.map((output) => `${output.name}:${output.type}`).join("|");
      const cached = panelCache.get(node.id);
      let rows: RowLayout[];
      if (cached && cached.outputValueRef === node.outputValue && cached.outputsSignature === outputsSignature) {
        rows = cached.rows;
      } else {
        rows = outputs.map((output) => {
          const value = resolveOutputValue(output.name, node.outputValue, outputs.length);
          if (output.type === "images") {
            const items = Array.isArray(value) ? value : value ? [value] : [];
            const images = items
              .map((item) => getImage(toImageSrc(item)))
              .filter((item): item is HTMLImageElement => Boolean(item));
            return {
              label: output.name,
              type: output.type,
              lines: [],
              images,
            };
          }
          const text = toTextValue(value);
          const lines = wrapText(ctx, text, valueWidth).slice(0, maxTextLines);
          return {
            label: output.name,
            type: output.type,
            lines,
            images: [],
          };
        });
        panelCache.set(node.id, { outputValueRef: node.outputValue, outputsSignature, rows });
      }

      const layoutRows = rows.map((row) => {
        if (row.type === "images" && row.images.length > 0) {
          const imageHeights = row.images.map((img) => {
            if (!img.complete || img.naturalWidth === 0) {
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

      ctx.fillStyle = OUTPUT_PANEL_BG;
      ctx.strokeStyle = OUTPUT_PANEL_BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(startX, y, OUTPUT_PANEL_WIDTH, panelHeight, OUTPUT_PANEL_RADIUS);
      ctx.fill();
      ctx.stroke();

      ctx.font = "12px sans-serif";
      ctx.fillStyle = OUTPUT_PANEL_LABEL_COLOR;
      layoutRows.forEach((item) => {
        const row = item.row;
        const labelY = cursorY + OUTPUT_PANEL_LINE_HEIGHT - 4;
        ctx.fillText(row.label, startX + OUTPUT_PANEL_PADDING, labelY);
        if (renderValues) {
          const valueX = startX + OUTPUT_PANEL_PADDING;
          const valueStartY = cursorY + OUTPUT_PANEL_LINE_HEIGHT;
          ctx.fillStyle = OUTPUT_PANEL_TEXT_COLOR;
          if (row.type === "images" && row.images.length > 0) {
            let imageY = valueStartY;
            row.images.forEach((img, index) => {
              const height = item.imageHeights[index] ?? OUTPUT_PANEL_IMAGE_PLACEHOLDER;
              if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, valueX, imageY, valueWidth, height);
              } else {
                ctx.strokeStyle = OUTPUT_PANEL_BORDER;
                ctx.strokeRect(valueX, imageY, valueWidth, height);
              }
              imageY += height + OUTPUT_PANEL_IMAGE_GAP;
            });
          } else {
            row.lines.forEach((line, lineIndex) => {
              const lineY = valueStartY + (lineIndex + 1) * OUTPUT_PANEL_LINE_HEIGHT - 4;
              ctx.fillText(line, valueX, lineY);
            });
          }
          ctx.fillStyle = OUTPUT_PANEL_LABEL_COLOR;
        }
        cursorY += item.height + OUTPUT_PANEL_ROW_GAP;
      });
    });
    ctx.restore();
  };

  const getLinkKey = (link: GraphLink) =>
    `${link.fromNodeId}:${link.fromSlot}:${link.toNodeId}:${link.toSlot}`;

  const buildGraphNode = (graphNode: GraphNodeSnapshot) => {
    const node = new BaseGraphNode(graphNode.title ?? "Node");
    node.type = graphNode.executionId;
    const baseNode = useNodeStore.getState().nodes[graphNode.nodeId];
    if (!baseNode) {
      return null;
    }
    node.propertyDefs = baseNode?.properties ?? [];
    if (baseNode) {
      node.properties = {
        ...getNodeDefaultProperties(baseNode),
        ...(graphNode.properties ?? {}),
      };
    } else {
      node.properties = { ...(graphNode.properties ?? {}) };
    }
    (baseNode?.inputs ?? []).forEach((input) => {
      const label = input.label?.trim() || input.name;
      node.addInput(label, input.type);
    });
    (baseNode?.outputs ?? []).forEach((output) => {
      const label = output.label?.trim() || output.name;
      node.addOutput(label, output.type);
    });
    return node;
  };

  const addGraphNode = (graphNode: GraphNodeSnapshot) => {
    const node = buildGraphNode(graphNode);
    if (!node) {
      return null;
    }
    graph.add(node);
    node.pos = graphNode.pos;
    nodeInstances.set(graphNode.id, node);
    nodeIdMap.set(node.id, graphNode.id);
    return node;
  };

  graphNodes.forEach((graphNode: GraphNodeSnapshot) => {
    addGraphNode(graphNode);
  });

  links.forEach((link: GraphLink) => {
    const fromNode = nodeInstances.get(link.fromNodeId);
    const toNode = nodeInstances.get(link.toNodeId);
    if (!fromNode || !toNode) {
      return;
    }
    const graphLink = graph.connect(fromNode, link.fromSlot, toNode, link.toSlot);
    linkKeyMap.set(getLinkKey(link), graphLink.id);
  });

  canvasView.onNodeMoved = (node) => {
    const graphNodeId = nodeIdMap.get(node.id);
    if (!graphNodeId) {
      return;
    }
    updateNodePosition(graphNodeId, [...node.pos]);
  };

  canvasView.onSelectionChange = (selection) => {
    if (!options.onSelectionChange) {
      return;
    }
    if (!selection) {
      options.onSelectionChange(null);
      return;
    }
    const graphNodeId = nodeIdMap.get(selection.node.id);
    if (!graphNodeId) {
      options.onSelectionChange(null);
      return;
    }
    const graphNode = useGraphStore.getState().nodes.find((node) => node.id === graphNodeId);
    if (!graphNode) {
      options.onSelectionChange(null);
      return;
    }
    options.onSelectionChange({ rect: selection.rect, node: graphNode });
  };

  canvasView.onPropertyClick = (node, propertyIndex) => {
    if (!options.onPropertyClick) {
      return;
    }
    const graphNodeId = nodeIdMap.get(node.id);
    if (!graphNodeId) {
      return;
    }
    const graphNode = useGraphStore.getState().nodes.find((item) => item.id === graphNodeId);
    if (!graphNode) {
      return;
    }
    const property = node.propertyDefs[propertyIndex];
    if (!property) {
      return;
    }
    const value = node.properties[property.name];
    options.onPropertyClick({ node: graphNode, property, value });
  };

  canvasView.onStatusDotClick = (node) => {
    if (!options.onStatusDotClick) {
      return;
    }
    const graphNodeId = nodeIdMap.get(node.id);
    if (!graphNodeId) {
      return;
    }
    const graphNode = useGraphStore.getState().nodes.find((item) => item.id === graphNodeId);
    if (!graphNode) {
      return;
    }
    options.onStatusDotClick(graphNode);
  };

  canvasView.onOutputDotClick = (payload) => {
    if (!options.onOutputDotClick) {
      return;
    }
    const graphNodeId = nodeIdMap.get(payload.node.id);
    if (!graphNodeId) {
      return;
    }
    const graphNode = useGraphStore.getState().nodes.find((item) => item.id === graphNodeId);
    if (!graphNode) {
      return;
    }
    const output = payload.node.outputs[payload.slot];
    if (!output) {
      return;
    }
    options.onOutputDotClick({
      node: graphNode,
      outputType: output.type,
      value: payload.node.outputValue,
    });
  };

  canvasView.onLinkAdded = (link) => {
    if (!useGraphStore.getState().editing) {
      return;
    }
    const fromNodeId = nodeIdMap.get(link.fromNodeId);
    const toNodeId = nodeIdMap.get(link.toNodeId);
    if (!fromNodeId || !toNodeId) {
      return;
    }
    addLink({
      fromNodeId,
      fromSlot: link.fromSlot,
      toNodeId,
      toSlot: link.toSlot,
    });
    linkKeyMap.set(
      getLinkKey({ fromNodeId, fromSlot: link.fromSlot, toNodeId, toSlot: link.toSlot }),
      link.id
    );
  };

  canvasView.onLinkRemoved = (link) => {
    if (!useGraphStore.getState().editing) {
      return;
    }
    const fromNodeId = nodeIdMap.get(link.fromNodeId);
    const toNodeId = nodeIdMap.get(link.toNodeId);
    if (!fromNodeId || !toNodeId) {
      return;
    }
    removeLink({
      fromNodeId,
      fromSlot: link.fromSlot,
      toNodeId,
      toSlot: link.toSlot,
    });
    linkKeyMap.delete(
      getLinkKey({ fromNodeId, fromSlot: link.fromSlot, toNodeId, toSlot: link.toSlot })
    );
  };

  canvasView.linkEditingEnabled = useGraphStore.getState().editing;
  canvasView.nodeDraggingEnabled = true;
  canvasView.onInlineSubmit = (nodeId, values) => {
    useWorkflowStore.getState().submitNodeInput(nodeId, values);
  };
  canvasView.drawCustom = (ctx) => {
    drawOutputPanels(ctx);
  };

  const unsubscribeWorkflow = useWorkflowStore.subscribe((state) => {
    nodeInstances.forEach((node, graphNodeId) => {
      const workflowNode = state.nodes.find((item) => item.id === graphNodeId);
      node.status = workflowNode?.status;
      node.outputValue = workflowNode?.outputValue;
    });
    linkKeyMap.forEach((linkId, key) => {
      const link = graph.getLinkById(linkId);
      if (!link) {
        return;
      }
      const workflowLink = state.links.find((item) => getLinkKey(item) === key);
      link.status = workflowLink?.status;
    });
    canvasView.setInlineInputs(state.pendingInputs, (nodeId) => nodeInstances.get(nodeId));
  });

  const unsubscribeGraph = useGraphStore.subscribe((state) => {
    canvasView.linkEditingEnabled = state.editing;
  });

  canvasView.start();

  const addNodeAtCenter = (nodeId: number) => {
    if (!useGraphStore.getState().editing) {
      return;
    }
    const baseNode = useNodeStore.getState().nodes[nodeId];
    if (!baseNode) {
      return;
    }
    const position = canvasView.getViewportCenter();
    const defaults = getNodeDefaultProperties(baseNode);
    const graphNode = useGraphStore.getState().addNode({
      nodeId: baseNode.id,
      executionId: baseNode.executionId,
      title: baseNode.title,
      pos: position,
      properties: defaults,
    });
    addGraphNode(graphNode);
  };

  const removeGraphNode = (graphNodeId: string) => {
    const node = nodeInstances.get(graphNodeId);
    if (!node) {
      return;
    }
    removeNode(graphNodeId);
    graph.remove(node);
    nodeInstances.delete(graphNodeId);
    nodeIdMap.delete(node.id);
    canvasView.clearSelection();
  };

  const syncNodePorts = (
    node: LGraphNode,
    nextInputs: NodeSnapshot["inputs"] = [],
    nextOutputs: NodeSnapshot["outputs"] = []
  ) => {
    const normalizedInputs = (nextInputs ?? []) as NonNullable<NodeSnapshot["inputs"]>;
    const normalizedOutputs = (nextOutputs ?? []) as NonNullable<NodeSnapshot["outputs"]>;
    node.inputs.forEach((input, index) => {
      const nextInput = normalizedInputs[index];
      if (!nextInput || nextInput.type !== input.type) {
        if (input.linkId !== undefined) {
          graph.removeLink(input.linkId);
        }
      }
    });

    node.outputs.forEach((output, index) => {
      const nextOutput = normalizedOutputs[index];
      if (!nextOutput || nextOutput.type !== output.type) {
        output.links.forEach((linkId) => {
          graph.removeLink(linkId);
        });
      }
    });

    node.inputs = normalizedInputs.map((input, index) => ({
      name: input.label?.trim() || input.name,
      type: input.type,
      linkId:
        node.inputs[index]?.type === input.type ? node.inputs[index]?.linkId : undefined,
    }));
    node.outputs = normalizedOutputs.map((output, index) => ({
      name: output.label?.trim() || output.name,
      type: output.type,
      links: node.outputs[index]?.type === output.type ? [...node.outputs[index].links] : [],
    }));
  };

  const syncNodeDefinition = (definitionId: number) => {
    const graphNodes = useGraphStore.getState().nodes;
    const baseNode = useNodeStore.getState().nodes[definitionId];
    graphNodes.forEach((graphNode) => {
      if (graphNode.nodeId !== definitionId) {
        return;
      }
      const node = nodeInstances.get(graphNode.id);
      if (!node) {
        return;
      }
      node.title = graphNode.title ?? node.title;
      node.type = graphNode.executionId;
      syncNodePorts(node, baseNode?.inputs ?? [], baseNode?.outputs ?? []);
      node.propertyDefs = baseNode?.properties ?? [];
      if (baseNode) {
        node.properties = {
          ...getNodeDefaultProperties(baseNode),
          ...(graphNode.properties ?? {}),
        };
      } else {
        node.properties = { ...(graphNode.properties ?? {}) };
      }
    });
  };

  return {
    addNodeAtCenter,
    updateNodeProperty: (graphNodeId: string, propertyName: string, value: unknown) => {
      const node = nodeInstances.get(graphNodeId);
      if (!node) {
        return;
      }
      updateNodeProperty(graphNodeId, propertyName, value);
      node.properties = { ...node.properties, [propertyName]: value };
    },
    removeNode: removeGraphNode,
    syncNodeDefinition,
    destroy: () => {
      unsubscribeWorkflow();
      unsubscribeGraph();
      canvasView.destroy();
    },
  };
};

