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

const toTextValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
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

  const shouldShowImages = outputType === "images";
  const shouldShowText = outputType === "string" || outputType === "number";
  const shouldShowObject = outputType === "object";
  const images = shouldShowImages
    ? Array.isArray(value)
      ? value
      : value
      ? [value]
      : []
    : [];

  return (
    <div className="modal-overlay">
      <div className="modal-card workflow-output-modal">
        <div className="modal-header">
          <div>
            <h3>{nodeName || "输出结果"}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {shouldShowImages ? (
            <div className="workflow-output-image-list">
              {images.length === 0 ? (
                <p className="workflow-output-text">{toTextValue(value)}</p>
              ) : (
                images.map((item, index) => (
                  <img key={index} src={toImageSrc(item)} alt={`output-${index + 1}`} />
                ))
              )}
            </div>
          ) : null}
          {shouldShowText ? (
            <p className="workflow-output-text">{toTextValue(value)}</p>
          ) : null}
          {shouldShowObject ? (
            <pre className="workflow-output-text">{toTextValue(value)}</pre>
          ) : null}
          {!shouldShowImages && !shouldShowText && !shouldShowObject ? (
            <pre className="workflow-output-text">{toTextValue(value)}</pre>
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

