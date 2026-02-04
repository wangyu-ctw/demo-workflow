import { useEffect, useMemo, useState } from "react";
import type { NodeProperty } from "../../stores/nodeStore";
import { NodePropertyType } from "../../stores/nodeStore";
import "./style.css";

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
    <div className="modal-overlay">
      <div className="modal-card property-modal">
        <div className="modal-header">
          <div>
            <h3>{nodeTitle}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="property-subtitle">{property.label}</p>
          {property.type === NodePropertyType.textarea ? (
            <textarea
              className="property-textarea"
              value={String(draftValue ?? "")}
              onChange={(event) => setDraftValue(event.target.value)}
            />
          ) : null}
          {property.type === NodePropertyType.inputNumber ? (
            <input
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
            <select value={String(draftValue ?? "")} onChange={(e) => setDraftValue(e.target.value)}>
              {(property.options ?? []).map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.name}
                </option>
              ))}
            </select>
          ) : null}
          {property.type === NodePropertyType.switch ? (
            <label className="property-switch">
              <input
                type="checkbox"
                checked={Boolean(draftValue)}
                onChange={(event) => setDraftValue(event.target.checked)}
              />
              <span>启用</span>
            </label>
          ) : null}
          {property.type === NodePropertyType.checkGroup ? (
            <div className="property-check-group">
              {checkboxOptions.length === 0 ? (
                <div className="form-empty">暂无选项</div>
              ) : (
                checkboxOptions.map((option) => {
                  const values = Array.isArray(draftValue) ? draftValue.map(String) : [];
                  const checked = values.includes(option.value);
                  return (
                    <label className="property-check-item" key={option.value}>
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
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

