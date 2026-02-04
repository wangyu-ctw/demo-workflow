import "../NodeConfigModal/style.css";
import "./style.css";

type WorkflowOutputModalProps = {
  isOpen: boolean;
  nodeName: string;
  outputType: string;
  value: unknown;
  onClose: () => void;
};

const toImageSrc = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }
  if (value.startsWith("data:")) {
    return value;
  }
  return `data:image/png;base64,${value}`;
};

export function WorkflowOutputModal({
  isOpen,
  nodeName,
  outputType,
  value,
  onClose,
}: WorkflowOutputModalProps) {
  if (!isOpen) {
    return null;
  }

  const shouldShowImage = outputType === "image";
  const shouldShowText = outputType === "prompt" || outputType === "number";

  return (
    <div className="modal-overlay">
      <div className="modal-card workflow-output-modal">
        <div className="modal-header">
          <div>
            <h3>{nodeName || "输出结果"}</h3>
            <p className="workflow-output-type">输出类型: {outputType}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {shouldShowImage ? (
            <div className="workflow-output-image">
              <img src={toImageSrc(value)} alt="output" />
            </div>
          ) : null}
          {shouldShowText ? (
            <pre className="workflow-output-text">{String(value ?? "")}</pre>
          ) : null}
          {!shouldShowImage && !shouldShowText ? (
            <pre className="workflow-output-text">{String(value ?? "")}</pre>
          ) : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

