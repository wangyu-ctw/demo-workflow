import { FiEdit2, FiTrash2 } from "react-icons/fi";
import "./style.css";

type NodeToolbarProps = {
  position: { x: number; y: number };
  node: { id: string; nodeId?: number; title?: string; executionId: string };
  onDelete?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
};

const TOOLBAR_HEIGHT = 40;
const TOOLBAR_GAP = 8;

export function NodeToolbar({ position, node, onDelete, onEdit, disabled }: NodeToolbarProps) {
  return (
    <div
      className="node-toolbar"
      style={{
        left: position.x,
        top: position.y - TOOLBAR_HEIGHT - TOOLBAR_GAP,
      }}
    >
      <div className="node-toolbar-actions">
        <button type="button" aria-label="编辑" onClick={onEdit} disabled={disabled}>
          <FiEdit2 />
        </button>
        <button type="button" aria-label="删除" onClick={onDelete} disabled={disabled}>
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
}

