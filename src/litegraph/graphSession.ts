import type { LGraphNode } from "../litegraph";
import { LGraph, LGraphCanvas, LGraphNode as BaseGraphNode } from "../litegraph";
import type { GraphLink, GraphNodeSnapshot } from "../stores/graphStore";
import { useGraphStore } from "../stores/graphStore";
import type { NodeProperty, NodeSnapshot } from "../stores/nodeStore";
import { getNodeDefaultProperties, useNodeStore } from "../stores/nodeStore";
import { useWorkflowStore } from "../stores/workflowStore";
import type { SlotType } from "./types";

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

export const createGraphSession = (canvas: HTMLCanvasElement, options: GraphSessionOptions = {}) => {
  const graph = new LGraph();
  const canvasView = new LGraphCanvas(canvas, graph);

  const { nodes: graphNodes, links } = useGraphStore.getState();
  const { updateNodePosition, addLink, removeLink, removeNode, updateNodeProperty } =
    useGraphStore.getState();
  const nodeInstances = new Map<string, LGraphNode>();
  const nodeIdMap = new Map<number, string>();
  const linkKeyMap = new Map<string, number>();

  const getLinkKey = (link: GraphLink) =>
    `${link.fromNodeId}:${link.fromSlot}:${link.toNodeId}:${link.toSlot}`;

  const buildGraphNode = (graphNode: GraphNodeSnapshot) => {
    const node = new BaseGraphNode(graphNode.title ?? "Node");
    node.type = graphNode.executionId;
    const baseNode = graphNode.nodeId
      ? useNodeStore.getState().nodes[graphNode.nodeId]
      : undefined;
    node.propertyDefs = baseNode?.properties ?? [];
    if (baseNode) {
      node.properties = {
        ...getNodeDefaultProperties(baseNode),
        ...(graphNode.properties ?? {}),
      };
    } else {
      node.properties = { ...(graphNode.properties ?? {}) };
    }
    if (graphNode.size) {
      node.size = graphNode.size;
    }
    graphNode.inputs?.forEach((input) => {
      node.addInput(input.name, input.type);
    });
    (baseNode?.outputs ?? []).forEach((output) => {
      node.addOutput(output.name, output.type);
    });
    return node;
  };

  const addGraphNode = (graphNode: GraphNodeSnapshot) => {
    const node = buildGraphNode(graphNode);
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
    if (useWorkflowStore.getState().workflowStatus !== "stopped") {
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
    if (useWorkflowStore.getState().workflowStatus !== "stopped") {
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

  const unsubscribeWorkflow = useWorkflowStore.subscribe((state) => {
    const isStopped = state.workflowStatus === "stopped";
    canvasView.linkEditingEnabled = isStopped;
    canvasView.nodeDraggingEnabled = isStopped;
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
  });

  canvasView.start();

  const addNodeAtCenter = (nodeId: number) => {
    if (useWorkflowStore.getState().workflowStatus !== "stopped") {
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
      size: baseNode.size,
      inputs: baseNode.inputs ?? [],
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
    nextInputs: GraphNodeSnapshot["inputs"] = [],
    nextOutputs: NodeSnapshot["outputs"] = []
  ) => {
    node.inputs.forEach((input, index) => {
      const nextInput = nextInputs[index];
      if (!nextInput || nextInput.type !== input.type) {
        if (input.linkId !== undefined) {
          graph.removeLink(input.linkId);
        }
      }
    });

    node.outputs.forEach((output, index) => {
      const nextOutput = nextOutputs[index];
      if (!nextOutput || nextOutput.type !== output.type) {
        output.links.forEach((linkId) => {
          graph.removeLink(linkId);
        });
      }
    });

    node.inputs = nextInputs.map((input, index) => ({
      name: input.name,
      type: input.type,
      linkId:
        node.inputs[index]?.type === input.type ? node.inputs[index]?.linkId : undefined,
    }));
    node.outputs = nextOutputs.map((output, index) => ({
      name: output.name,
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
      if (graphNode.size) {
        node.size = graphNode.size;
      }
      syncNodePorts(node, graphNode.inputs ?? [], baseNode?.outputs ?? []);
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
      canvasView.destroy();
    },
  };
};

