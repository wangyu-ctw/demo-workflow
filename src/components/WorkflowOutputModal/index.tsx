const modalOverlayClass =
  "fixed inset-0 z-10 flex items-center justify-center bg-[rgba(8,10,15,0.72)]";
const modalCardClass =
  "flex max-h-[88vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#333333] shadow-[0_24px_60px_rgba(0,0,0,0.45)]";
const modalHeaderClass =
  "flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4";
const modalCloseClass = "cursor-pointer bg-transparent text-base text-[#9aa4b2]";
const modalBodyClass = "flex flex-col gap-4 overflow-y-scroll px-5 pb-5 pt-4";
const modalActionsClass = "mt-1 flex justify-end gap-2.5 px-5 pb-4";
const primaryButtonClass =
  "rounded-[10px] bg-[#3b68ff] px-3.5 py-2 text-xs text-[#f3f6ff]";
const outputTextClass =
  "max-h-[600px] break-all rounded-[10px] border border-[#1e2533] bg-[#0f131c] p-3 text-xs text-[#e6e9ef] overflow-y-scroll";
const outputImageListClass = "flex flex-col gap-3";
const outputImageClass =
  "max-h-[60vh] max-w-full rounded-[10px] border border-[#1e2533]";

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
    <div className={modalOverlayClass}>
      <div className={modalCardClass}>
        <div className={modalHeaderClass}>
          <div>
            <h3 className="text-base font-semibold">{nodeName || "输出结果"}</h3>
          </div>
          <button type="button" className={modalCloseClass} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={modalBodyClass}>
          {shouldShowImages ? (
            <div className={outputImageListClass}>
              {images.length === 0 ? (
                <p className={outputTextClass}>{toTextValue(value)}</p>
              ) : (
                images.map((item, index) => (
                  <img
                    key={index}
                    className={outputImageClass}
                    src={toImageSrc(item)}
                    alt={`output-${index + 1}`}
                  />
                ))
              )}
            </div>
          ) : null}
          {shouldShowText ? (
            <p className={outputTextClass}>{toTextValue(value)}</p>
          ) : null}
          {shouldShowObject ? (
            <pre className={outputTextClass}>{toTextValue(value)}</pre>
          ) : null}
          {!shouldShowImages && !shouldShowText && !shouldShowObject ? (
            <pre className={outputTextClass}>{toTextValue(value)}</pre>
          ) : null}
        </div>
        <div className={modalActionsClass}>
          <button type="button" className={primaryButtonClass} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

