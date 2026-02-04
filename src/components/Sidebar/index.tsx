import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { FiArrowRightCircle, FiDownload, FiEdit3, FiPlus } from "react-icons/fi";
import { FaShareNodes } from "react-icons/fa6";
import type { GraphConfig } from "../../stores/graphStore";
import { useGraphStore } from "../../stores/graphStore";
import type { NodeSnapshot } from "../../stores/nodeStore";
import { useNodeStore } from "../../stores/nodeStore";
import {
  exportGraphConfig,
  getGraphNameFromFile,
  readGraphConfigFile,
} from "../../utils/graphConfig";
import "./style.css";

type SidebarProps = {
  onAddNode: (nodeId: number) => void;
  onOpenCreateNode: () => void;
  onImportGraph: (graph: GraphConfig, name: string) => void;
  disabled?: boolean;
};

export function Sidebar({ onAddNode, onOpenCreateNode, onImportGraph, disabled }: SidebarProps) {
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
    let name = graphName.trim();
    if (!name) {
      const text = window.prompt("请输入json文件名", "export");
      if (!text) {
        return;
      }
      name = text.trim();
      if (!name) {
        return;
      }
    }
    exportGraphConfig({ nodes: graphNodes, links: graphLinks, name }, name);
  };

  return (
    <aside className="sidebar">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <nav className="sidebar-nav">
        <div className="nav-item-group">
          <button
            className={`nav-item ${isEditOpen ? "is-open" : ""}`}
            type="button"
            onClick={() => setIsEditOpen((prev) => !prev)}
            disabled={disabled}
          >
            <FiEdit3 />
            <span className="nav-label">编辑</span>
          </button>
          {isEditOpen ? (
            <div className="nav-submenu">
              <button
                className="nav-submenu-item"
                type="button"
                onClick={handleImportClick}
                disabled={disabled}
              >
                <FiArrowRightCircle className="nav-submenu-icon" />
                导入
              </button>
              <button
                className="nav-submenu-item"
                type="button"
                onClick={handleExportClick}
                disabled={disabled}
              >
                <FiDownload className="nav-submenu-icon" />
                导出
              </button>
            </div>
          ) : null}
        </div>
        <div className="nav-item-group">
          <button
            className={`nav-item ${isLibraryOpen ? "is-open" : ""}`}
            type="button"
            onClick={() => setIsLibraryOpen((prev) => !prev)}
            disabled={disabled}
          >
            <FaShareNodes />
            <span className="nav-label">节点库</span>
          </button>
          {isLibraryOpen ? (
            <div className="nav-submenu">
              <button
                className="nav-submenu-item"
                type="button"
                onClick={onOpenCreateNode}
                disabled={disabled}
              >
                <FiPlus className="nav-submenu-icon" />
                新增节点
              </button>
              <div className="nav-divider"></div>
              {nodeLibrary.length === 0 ? (
                <div className="nav-empty">暂无内容</div>
              ) : (
                nodeLibrary.map((node) => (
                  <button
                    className="nav-submenu-item"
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
    </aside>
  );
}

