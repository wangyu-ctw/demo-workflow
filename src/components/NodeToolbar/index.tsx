import { FiEdit2, FiTrash2 } from "react-icons/fi";

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
      className="pointer-events-auto absolute flex h-10 items-center justify-between gap-3 rounded-[10px] border border-[#2a3246] bg-[rgba(15,19,28,0.92)] px-[5px] text-[#e6e9ef]"
      style={{
        left: position.x,
        top: position.y - TOOLBAR_HEIGHT - TOOLBAR_GAP,
      }}
    >
      <div className="inline-flex gap-2">
        <button
          type="button"
          aria-label="编辑"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-inherit hover:bg-[#1a2030] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onEdit}
          disabled={disabled}
        >
          <FiEdit2 />
        </button>
        <button
          type="button"
          aria-label="删除"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-inherit hover:bg-[#1a2030] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onDelete}
          disabled={disabled}
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
}

