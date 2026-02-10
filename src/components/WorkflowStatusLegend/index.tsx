import { WorkflowStatus } from "../../types/workflow";
import { WORKFLOW_STATUS_COLORS } from "../../utils/constants";

const STATUS_LABELS: Array<{ status: WorkflowStatus; label: string }> = [
  { status: WorkflowStatus.PENDING, label: "待执行" },
  { status: WorkflowStatus.PROGRESSING, label: "执行中" },
  { status: WorkflowStatus.DONE, label: "完成" },
  { status: WorkflowStatus.ERROR, label: "错误" },
  { status: WorkflowStatus.PAUSED, label: "暂停" },
  { status: WorkflowStatus.WAITING, label: "等待输入【可点击输入】" },
];

export function WorkflowStatusLegend() {
  return (
    <div className="absolute bottom-5 right-5 flex items-center gap-3 rounded-[10px] border border-[#2a2a2a] bg-[rgba(15,17,21,0.72)] px-3 py-2 text-xs text-[#c8d0db] backdrop-blur-[6px]">
      {STATUS_LABELS.map((item) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap" key={item.status}>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: WORKFLOW_STATUS_COLORS[item.status] }}
          />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-solid bg-transparent box-border"
          style={{ borderColor: WORKFLOW_STATUS_COLORS[WorkflowStatus.DONE] }}
        />
        <span>点击可查看节点输出</span>
      </div>
    </div>
  );
}

