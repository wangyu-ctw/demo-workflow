import { useEffect, useMemo, useState } from "react";
import type { NodeProperty } from "../../stores/nodeStore";
import { NodePropertyType } from "../../stores/nodeStore";
const modalOverlayClass =
  "fixed inset-0 z-10 flex items-center justify-center bg-[rgba(8,10,15,0.72)]";
const modalCardClass =
  "flex max-h-[88vh] w-[min(420px,92vw)] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#333333] shadow-[0_24px_60px_rgba(0,0,0,0.45)]";
const modalHeaderClass =
  "flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4";
const modalCloseClass = "cursor-pointer bg-transparent text-base text-[#9aa4b2]";
const modalBodyClass = "flex flex-col gap-4 overflow-y-scroll px-5 pb-5 pt-4";
const modalActionsClass = "mt-1 flex justify-end gap-2.5 px-5 pb-4";
const ghostButtonClass =
  "rounded-[10px] border border-[#2a3246] bg-transparent px-3.5 py-2 text-xs text-[#c8d0db]";
const primaryButtonClass =
  "rounded-[10px] bg-[#3b68ff] px-3.5 py-2 text-xs text-[#f3f6ff]";
const inputClass =
  "w-full rounded-[10px] border border-[#1e2533] bg-[#0f131c] px-2.5 py-2 text-xs text-[#e6e9ef]";
const formEmptyClass = "text-xs text-[#707a88]";

type PropertyEditModalProps = {
  isOpen: boolean;
  nodeTitle: string;
  property: NodeProperty<unknown> | null;
  value: unknown;
  onClose: () => void;
  onSave: (value: unknown) => void;
};

export function PropertyEditModal({
  isOpen,
  nodeTitle,
  property,
  value,
  onClose,
  onSave,
}: PropertyEditModalProps) {
  const [draftValue, setDraftValue] = useState<unknown>(value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraftValue(value);
  }, [isOpen, value]);

  const checkboxOptions = useMemo(
    () =>
      (property?.options ?? []).map((option) => ({
        label: option.name,
        value: String(option.value),
      })),
    [property?.options]
  );

  if (!isOpen || !property) {
    return null;
  }

  const clampNumber = (value: number) => {
    const min = property.min ?? Number.NEGATIVE_INFINITY;
    const max = property.max ?? Number.POSITIVE_INFINITY;
    return Math.min(Math.max(value, min), max);
  };

  const handleSave = () => {
    if (property.type === NodePropertyType.inputNumber && typeof draftValue === "number") {
      onSave(clampNumber(draftValue));
      return;
    }
    onSave(draftValue);
  };

  return (
    <div className={modalOverlayClass}>
      <div className={modalCardClass}>
        <div className={modalHeaderClass}>
          <div>
            <h3 className="text-base font-semibold">{nodeTitle}</h3>
          </div>
          <button type="button" className={modalCloseClass} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={modalBodyClass}>
          <p className="text-[#9aa4b2]">{property.label}</p>
          {property.type === NodePropertyType.textarea ? (
            <textarea
              className={`${inputClass} min-h-[140px] resize-y`}
              value={String(draftValue ?? "")}
              onChange={(event) => setDraftValue(event.target.value)}
            />
          ) : null}
          {property.type === NodePropertyType.inputNumber ? (
            <input
              className={inputClass}
              type="number"
              value={draftValue === undefined || draftValue === null ? "" : Number(draftValue)}
              min={property.min}
              max={property.max}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === "") {
                  setDraftValue(undefined);
                  return;
                }
                const nextValue = Number(raw);
                if (Number.isNaN(nextValue)) {
                  return;
                }
                setDraftValue(clampNumber(nextValue));
              }}
            />
          ) : null}
          {property.type === NodePropertyType.select ? (
            <select
              className={inputClass}
              value={String(draftValue ?? "")}
              onChange={(e) => setDraftValue(e.target.value)}
            >
              {(property.options ?? []).map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.name}
                </option>
              ))}
            </select>
          ) : null}
          {property.type === NodePropertyType.switch ? (
            <label className="inline-flex items-center gap-2 text-[13px] text-[#cbd2dd]">
              <input
                type="checkbox"
                checked={Boolean(draftValue)}
                onChange={(event) => setDraftValue(event.target.checked)}
              />
              <span>启用</span>
            </label>
          ) : null}
          {property.type === NodePropertyType.checkGroup ? (
            <div className="grid gap-2.5">
              {checkboxOptions.length === 0 ? (
                <div className={formEmptyClass}>暂无选项</div>
              ) : (
                checkboxOptions.map((option) => {
                  const values = Array.isArray(draftValue) ? draftValue.map(String) : [];
                  const checked = values.includes(option.value);
                  return (
                    <label
                      className="flex items-center gap-2 text-[13px] text-[#cbd2dd]"
                      key={option.value}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = new Set(values);
                          if (event.target.checked) {
                            next.add(option.value);
                          } else {
                            next.delete(option.value);
                          }
                          setDraftValue(Array.from(next));
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
        <div className={modalActionsClass}>
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            取消
          </button>
          <button type="button" className={primaryButtonClass} onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

