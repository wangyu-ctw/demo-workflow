import { WorkflowStatus } from "../../types/workflow";
import { WORKFLOW_STATUS_COLORS } from "../../utils/constants";
import "./style.css";

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
    <div className="workflow-status-legend">
      {STATUS_LABELS.map((item) => (
        <div className="workflow-status-legend__item" key={item.status}>
          <span
            className="workflow-status-legend__dot"
            style={{ backgroundColor: WORKFLOW_STATUS_COLORS[item.status] }}
          />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="workflow-status-legend__item">
        <span
          className="workflow-status-legend__dot workflow-status-legend__dot--hollow"
          style={{ borderColor: WORKFLOW_STATUS_COLORS[WorkflowStatus.DONE] }}
        />
        <span>点击可查看节点输出</span>
      </div>
    </div>
  );
}

