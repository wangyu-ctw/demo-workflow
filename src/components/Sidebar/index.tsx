import { useState } from "react";
import { FiArrowRightCircle, FiDownload, FiEdit3, FiGrid, FiPlus } from "react-icons/fi";
import type { NodeSnapshot } from "../../stores/nodeStore";
import { useNodeStore } from "../../stores/nodeStore";
import "./style.css";

type SidebarProps = {
  onAddNode: (nodeId: number) => void;
  onOpenCreateNode: () => void;
};

export function Sidebar({ onAddNode, onOpenCreateNode }: SidebarProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const nodeLibrary = useNodeStore((state) => Object.values(state.nodes));

  const renderNodeLabel = (node: NodeSnapshot) => node.title ?? node.executionId;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="nav-item-group">
          <button
            className={`nav-item ${isEditOpen ? "is-open" : ""}`}
            type="button"
            onClick={() => setIsEditOpen((prev) => !prev)}
          >
            <FiEdit3 />
            <span className="nav-label">编辑</span>
          </button>
          {isEditOpen ? (
            <div className="nav-submenu">
              <button className="nav-submenu-item" type="button">
                <FiArrowRightCircle className="nav-submenu-icon" />
                导入
              </button>
              <button className="nav-submenu-item" type="button">
                <FiDownload className="nav-submenu-icon" />
                导出
              </button>
              <button className="nav-submenu-item" type="button" onClick={onOpenCreateNode}>
                <FiPlus className="nav-submenu-icon" />
                新增节点
              </button>
            </div>
          ) : null}
        </div>
        <div className="nav-item-group">
          <button
            className={`nav-item ${isLibraryOpen ? "is-open" : ""}`}
            type="button"
            onClick={() => setIsLibraryOpen((prev) => !prev)}
          >
            <FiGrid />
            <span className="nav-label">节点库</span>
          </button>
          {isLibraryOpen ? (
            <div className="nav-submenu">
              {nodeLibrary.length === 0 ? (
                <div className="nav-empty">暂无内容</div>
              ) : (
                nodeLibrary.map((node) => (
                  <button
                    className="nav-submenu-item"
                    key={node.id}
                    type="button"
                    onClick={() => onAddNode(node.id)}
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

