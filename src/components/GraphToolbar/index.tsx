import { FaPlay } from "react-icons/fa";
import { useGraphStore } from "../../stores/graphStore";
import "./style.css";

type GraphToolbarProps = {
  onRun?: () => void;
};

export function GraphToolbar({ onRun }: GraphToolbarProps) {
  const graphName = useGraphStore((state) => state.name);

  return (
    <div className="graph-toolbar">
      <span className="graph-toolbar-name">{graphName || "未命名"}.json</span>
      <div className="graph-toolbar-actions">
        <button type="button" aria-label="运行" onClick={onRun}>
          <FaPlay />
        </button>
      </div>
    </div>
  );
}

