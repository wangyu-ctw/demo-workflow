import { FaPlay, FaPause, FaStop } from "react-icons/fa";
import { useGraphStore } from "../../stores/graphStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import "./style.css";

export function GraphToolbar() {
  const graphName = useGraphStore((state) => state.name);
  const editing = useGraphStore((state) => state.editing);
  const setEditing = useGraphStore((state) => state.setEditing);
  const onReset = useGraphStore((state) => state.onReset);
  const workflowStatus = useWorkflowStore((state) => state.workflowStatus);
  const onRun = useWorkflowStore((state) => state.onRun);
  const onPause = useWorkflowStore((state) => state.onPause);
  const onStop = useWorkflowStore((state) => state.onStop);
  const canToggleMode = workflowStatus === "stopped";

  return (
    <div className="graph-toolbar">
      <span className="graph-toolbar-name">{graphName || "未命名"}.json</span>
      <div className="graph-toolbar-actions">
        <div className="graph-toolbar-mode">
          <label className="graph-toolbar-switch">
            <input
              type="checkbox"
              checked={editing}
              disabled={!canToggleMode}
              onChange={(event) => {
                const nextEditing = event.target.checked;
                setEditing(nextEditing);
                if (nextEditing) {
                  onReset();
                } else {
                  void onRun();
                }
              }}
            />
            <span className="graph-toolbar-switch-track">
              {editing ? "编辑模式" : "执行模式"}
            </span>
          </label>
        </div>
        {!editing ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  );
}

