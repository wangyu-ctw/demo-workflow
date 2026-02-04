import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { InputForm } from "../../types/workflow";
import type { WorkflowInputModalProps } from "./useWorkflowInputModal";
import "../NodeConfigModal/style.css";
import "./style.css";

const getFieldKey = (formIndex: number, inputName: string) => `${formIndex}:${inputName}`;

export function WorkflowInputModal({
  isOpen,
  nodeId,
  nodeName,
  inputForms,
  formValue,
  onClose,
  onSubmit,
}: WorkflowInputModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields = useMemo(
    () =>
      inputForms.map((form, formIndex) =>
        form.map((input) => ({
          formIndex,
          input,
          key: getFieldKey(formIndex, input.name),
        }))
      ),
    [inputForms]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setValues((formValue ?? {}) as Record<string, string>);
    setErrors({});
  }, [isOpen, nodeId, inputForms, formValue]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    fields.forEach((form) => {
      form.forEach(({ input, key }) => {
        if (!input.required) {
          return;
        }
        const value = values[key]?.trim();
        if (!value) {
          nextErrors[key] = "必填";
        }
      });
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onSubmit?.({ nodeId, values });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card workflow-input-modal">
        <div className="modal-header">
          <div>
            <h3>{nodeName || "节点输入"}</h3>
            <p className="workflow-node-id">节点 ID: {nodeId}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          {fields.length === 0 ? (
            <div className="form-empty">暂无输入字段</div>
          ) : (
            fields.map((form, formIndex) => (
              <section className="form-section compact" key={`form-${formIndex}`}>
                <header>输入组 {formIndex + 1}</header>
                {form.length === 0 ? (
                  <div className="form-empty">暂无输入字段</div>
                ) : (
                  form.map(({ input, key }) => (
                    <label className="form-field" key={key}>
                      <span className="workflow-field-label">
                        {input.name}
                        {input.required ? <em className="required-star">*</em> : null}
                      </span>
                      {input.options && input.options.length > 0 ? (
                        <select
                          value={values[key] ?? ""}
                          onChange={(event) =>
                            setValues((prev) => ({ ...prev, [key]: event.target.value }))
                          }
                        >
                          <option value="">请选择</option>
                          {input.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={values[key] ?? ""}
                          onChange={(event) =>
                            setValues((prev) => ({ ...prev, [key]: event.target.value }))
                          }
                        />
                      )}
                      {errors[key] ? <span className="form-error">{errors[key]}</span> : null}
                    </label>
                  ))
                )}
              </section>
            ))
          )}
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button">
              提交
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

