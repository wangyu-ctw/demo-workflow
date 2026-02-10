import { FaPlay, FaPause, FaStop } from "react-icons/fa";
import { useGraphStore } from "../../stores/graphStore";
import { useWorkflowStore } from "../../stores/workflowStore";

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
    <div className="pointer-events-auto fixed right-5 top-5 z-[12] flex h-10 items-center justify-between gap-3 rounded-[10px] border border-[#2a3246] bg-[rgba(15,19,28,0.92)] px-2 text-[#e6e9ef]">
      <span className="overflow-hidden text-ellipsis whitespace-nowrap border-r border-[rgb(118,118,118)] pr-4 text-sm text-[#b6b6b6]">
        {graphName || "未命名"}.json
      </span>
      <div className="inline-flex items-center gap-3">
        <div className="relative inline-flex h-5 w-[86px] items-center">
          <label className="inline-flex h-5 w-full cursor-pointer items-center">
            <input
              className="peer absolute h-0 w-0 opacity-0"
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
            <span className="relative flex h-5 w-full items-center justify-center rounded-full border border-[#e84a8a] bg-[#e84a8a] text-center text-xs leading-5 text-white transition-colors duration-200 after:absolute after:left-[1px] after:top-1/2 after:h-[14px] after:w-[14px] after:-translate-y-1/2 after:rounded-full after:bg-white after:transition-transform after:duration-200 peer-checked:border-[#2d9cdb] peer-checked:bg-[#2d9cdb] peer-checked:after:translate-x-[68px] peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
              {editing ? "编辑模式" : "执行模式"}
            </span>
          </label>
        </div>
        {!editing ? (
          <>
            {workflowStatus === "progressing" ? (
              <button
                type="button"
                aria-label="暂停"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-inherit hover:bg-[#1a2030]"
                onClick={onPause}
              >
                <FaPause />
              </button>
            ) : (
              <button
                type="button"
                aria-label="运行"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-inherit hover:bg-[#1a2030]"
                onClick={onRun}
              >
                <FaPlay />
              </button>
            )}
            <button
              type="button"
              aria-label="停止"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-inherit hover:bg-[#1a2030]"
              onClick={onStop}
            >
              <FaStop />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

