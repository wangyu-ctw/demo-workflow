import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { FiArrowRightCircle, FiDownload, FiEdit3, FiPlus } from "react-icons/fi";
import { FaShareNodes } from "react-icons/fa6";
import type { GraphConfig } from "../../stores/graphStore";
import { useGraphStore } from "../../stores/graphStore";
import type { NodeSnapshot } from "../../stores/nodeStore";
import { useNodeStore } from "../../stores/nodeStore";
import { exportNodeDefinitionsAsJson } from "../../services/indexedDB";
import {
  exportGraphConfig,
  getGraphNameFromFile,
  readGraphConfigFile,
} from "../../utils/graphConfig";

type SidebarProps = {
  onAddNode: (nodeId: number) => void;
  onOpenCreateNode: () => void;
  onImportGraph: (graph: GraphConfig, name: string) => void;
  disabled?: boolean;
};

export function Sidebar({ onAddNode, onOpenCreateNode, onImportGraph, disabled }: SidebarProps) {
  const editGroupRef = useRef<HTMLDivElement>(null);
  const libraryGroupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const nodeLibrary = useNodeStore((state) => Object.values(state.nodes));
  const graphName = useGraphStore((state) => state.name);
  const graphNodes = useGraphStore((state) => state.nodes);
  const graphLinks = useGraphStore((state) => state.links);

  const renderNodeLabel = (node: NodeSnapshot) => node.title ?? node.executionId;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const graph = await readGraphConfigFile(file);
      const name = getGraphNameFromFile(file);
      console.log("graph", graph);
      onImportGraph(graph, name);
    } catch (error) {
      console.error("[Sidebar] Failed to import graph", error);
      window.alert("导入失败：JSON 内容不合法或结构不正确。");
    } finally {
      event.target.value = "";
    }
  };

  const handleExportClick = () => {
    exportGraphConfig({ nodes: graphNodes, links: graphLinks, name: graphName });
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (editGroupRef.current && !editGroupRef.current.contains(target)) {
        setIsEditOpen(false);
      }
      if (libraryGroupRef.current && !libraryGroupRef.current.contains(target)) {
        setIsLibraryOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <aside className="relative flex w-12 flex-col items-center gap-3 border-r border-[#2a2a2a] bg-[#0b0d12] px-2.5 py-4">
      <nav className="flex w-full flex-col items-center gap-3">
        <div className="relative flex w-full justify-center" ref={editGroupRef}>
          <button
            className={`group relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-[#333333] text-[#c8d0db] transition-all ${
              isEditOpen ? "border-[#283044] bg-[#1a2030] text-[#e6e9ef]" : "hover:border-[#283044] hover:bg-[#1a2030] hover:text-[#e6e9ef]"
            }`}
            type="button"
            onClick={() => setIsEditOpen((prev) => !prev)}
          >
            <FiEdit3 className="h-5 w-5" />
            <span className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 -translate-x-1.5 whitespace-nowrap rounded-lg bg-[#141a28] px-2.5 py-1.5 text-xs text-[#e6e9ef] opacity-0 shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              编辑
            </span>
          </button>
          {isEditOpen ? (
            <div className="absolute left-14 top-0 z-[2] min-w-[160px] rounded-xl border border-[#2a2a2a] bg-[#333333] p-2 text-center text-xs text-[#9aa4b2]">
              <button
                className="inline-flex w-full items-center gap-2 rounded-lg bg-transparent px-2 py-1.5 text-left text-inherit transition-colors hover:bg-[#1a2030] hover:text-[#e6e9ef] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={handleImportClick}
                disabled={disabled}
              >
                <FiArrowRightCircle className="h-3.5 w-3.5" />
                导入
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                className="inline-flex w-full items-center gap-2 rounded-lg bg-transparent px-2 py-1.5 text-left text-inherit transition-colors hover:bg-[#1a2030] hover:text-[#e6e9ef]"
                type="button"
                onClick={handleExportClick}
              >
                <FiDownload className="h-3.5 w-3.5" />
                导出
              </button>
            </div>
          ) : null}
        </div>
        <div className="relative flex w-full justify-center" ref={libraryGroupRef}>
          <button
            className={`group relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-[#333333] text-[#c8d0db] transition-all ${
              isLibraryOpen
                ? "border-[#283044] bg-[#1a2030] text-[#e6e9ef]"
                : "hover:border-[#283044] hover:bg-[#1a2030] hover:text-[#e6e9ef]"
            }`}
            type="button"
            onClick={() => setIsLibraryOpen((prev) => !prev)}
          >
            <FaShareNodes className="h-5 w-5" />
            <span className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 -translate-x-1.5 whitespace-nowrap rounded-lg bg-[#141a28] px-2.5 py-1.5 text-xs text-[#e6e9ef] opacity-0 shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              节点库
            </span>
          </button>
          {isLibraryOpen ? (
            <div className="absolute left-14 top-0 z-[2] min-w-[160px] rounded-xl border border-[#2a2a2a] bg-[#333333] p-2 text-center text-xs text-[#9aa4b2]">
              <button
                className="inline-flex w-full items-center gap-2 rounded-lg bg-transparent px-2 py-1.5 text-left text-inherit transition-colors hover:bg-[#1a2030] hover:text-[#e6e9ef] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={onOpenCreateNode}
                disabled={disabled}
              >
                <FiPlus className="h-3.5 w-3.5" />
                新增节点
              </button>
              <div className="my-2 h-px w-full bg-[rgb(118,118,118)]"></div>
              {nodeLibrary.length === 0 ? (
                <div className="py-1.5">暂无内容</div>
              ) : (
                nodeLibrary.map((node) => (
                  <button
                    className="inline-flex w-full items-center gap-2 rounded-lg bg-transparent px-2 py-1.5 text-left text-inherit transition-colors hover:bg-[#1a2030] hover:text-[#e6e9ef] disabled:cursor-not-allowed disabled:opacity-50"
                    key={node.id}
                    type="button"
                    onClick={() => onAddNode(node.id)}
                    disabled={disabled}
                  >
                    {renderNodeLabel(node)}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </nav>
      {import.meta.env.DEV ? (
        <div className="mt-auto flex w-full justify-center">
          <button
            className="group relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-[#333333] text-[#c8d0db] transition-all hover:border-[#283044] hover:bg-[#1a2030] hover:text-[#e6e9ef]"
            type="button"
            aria-label="导出节点库"
            onClick={() => {
              void exportNodeDefinitionsAsJson();
            }}
          >
            <FiDownload className="h-5 w-5" />
            <span className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 -translate-x-1.5 whitespace-nowrap rounded-lg bg-[#141a28] px-2.5 py-1.5 text-xs text-[#e6e9ef] opacity-0 shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              导出节点库
            </span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}

