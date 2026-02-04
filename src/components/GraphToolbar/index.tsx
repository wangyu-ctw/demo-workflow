import { FaPlay, FaPause, FaStop } from "react-icons/fa";
import {GrRevert} from "react-icons/gr";
import { useGraphStore } from "../../stores/graphStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import "./style.css";

export function GraphToolbar() {
  const graphName = useGraphStore((state) => state.name);
  const onReset = useGraphStore((state) => state.onReset);
  const workflowStatus = useWorkflowStore((state) => state.workflowStatus);
  const onRun = useWorkflowStore((state) => state.onRun);
  const onPause = useWorkflowStore((state) => state.onPause);
  const onStop = useWorkflowStore((state) => state.onStop);

  return (
    <div className="graph-toolbar">
      <span className="graph-toolbar-name">{graphName || "未命名"}.json</span>
      <div className="graph-toolbar-actions">
        {workflowStatus === "progressing" ? (
          <button type="button" aria-label="暂停" onClick={onPause}>
            <FaPause />
          </button>
        ) : (
          <button type="button" aria-label="运行" onClick={onRun}>
            <FaPlay />
          </button>
        )}
        <button type="button" aria-label="停止" onClick={onStop}>
          <FaStop />
        </button>
        <button type="button" aria-label="重置" onClick={onReset}>
          <GrRevert />
        </button>
      </div>
    </div>
  );
}

