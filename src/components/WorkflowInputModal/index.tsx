import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InputForm } from "../../types/workflow";
import type { WorkflowInputModalProps } from "./useWorkflowInputModal";
import "../NodeConfigModal/style.css";
import "./style.css";

const getFieldKey = (formIndex: number, inputName: string) => `${formIndex}:${inputName}`;
const getFieldFileKey = (formIndex: number, inputName: string) =>
  `${formIndex}:${inputName}:filename`;
const getFieldDomId = (formIndex: number, inputName: string) =>
  `workflow-input-${formIndex}-${inputName}`;

type UploadImageProps = {
  value?: string;
  fileName?: string;
  required?: boolean;
  onChange: (payload: { value: string; fileName: string } | null) => void;
};

function UploadImage({ value, fileName, required, onChange }: UploadImageProps) {
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          return;
        }
        onChange({ value: reader.result, fileName: file.name });
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },
    [onChange]
  );

  return (
    <div className="workflow-image-input">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        aria-required={required}
      />
      {value ? (
        <div className="workflow-image-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => window.open(value, "_blank")}
          >
            {fileName || "已上传图片"}
          </button>
          <button type="button" className="ghost-button" onClick={() => onChange(null)}>
            删除
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowInputModal({
  isOpen,
  nodeId,
  nodeName,
  inputForms,
  formValue,
  onClose,
  onSubmit,
}: WorkflowInputModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

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
    setValues((formValue ?? {}) as Record<string, any>);
    setFileNames({});
    setErrors({});
  }, [isOpen, nodeId, inputForms, formValue]);

  const renderField = useCallback(
    (payload: { input: InputForm[number]; key: string; formIndex: number }) => {
      const { input, key, formIndex } = payload;
      const renderError = errors[key] ? <span className="form-error">{errors[key]}</span> : null;

      switch (input.type) {
        case "boolean": {
          const switchId = `workflow-switch-${key}`;
          return (
            <div className="form-field" key={key}>
              <span className="workflow-field-label">
                {input.name}
                {input.required ? <em className="required-star">*</em> : null}
              </span>
              <div className="workflow-switch">
                <input
                  id={switchId}
                  type="checkbox"
                  checked={Boolean(values[key])}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [key]: event.target.checked }))
                  }
                />
                <label className="workflow-switch__track" htmlFor={switchId} />
              </div>
              {renderError}
            </div>
          );
        }
        case "image":
          return (
            <div className="form-field" key={key}>
              <div className="workflow-field-label">
                <span>{input.name}</span>
                {input.required ? <em className="required-star">*</em> : null}
              </div>
              <UploadImage
                value={values[key] as string | undefined}
                fileName={fileNames[getFieldFileKey(formIndex, input.name)]}
                required={input.required}
                onChange={(payload) => {
                  if (!payload) {
                    setValues((prev) => ({ ...prev, [key]: "" }));
                    setFileNames((prev) => ({
                      ...prev,
                      [getFieldFileKey(formIndex, input.name)]: "",
                    }));
                    return;
                  }
                  setValues((prev) => ({ ...prev, [key]: payload.value }));
                  setFileNames((prev) => ({
                    ...prev,
                    [getFieldFileKey(formIndex, input.name)]: payload.fileName,
                  }));
                }}
              />
              {renderError}
            </div>
          );
        case "number":
          return (
            <div className="form-field" key={key}>
              <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                {input.name}
                {input.required ? <em className="required-star">*</em> : null}
              </label>
              <input
                id={getFieldDomId(formIndex, input.name)}
                type="number"
                min={(input as any).min}
                max={(input as any).max}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
              {renderError}
            </div>
          );
        case "checkbox":
          return (
            <div className="form-field" key={key}>
              <div className="workflow-field-label">
                <span>{input.name}</span>
                {input.required ? <em className="required-star">*</em> : null}
              </div>
              <div className="workflow-checkbox-group">
                {(input.options ?? []).map((option) => {
                  const checked = Array.isArray(values[key])
                    ? values[key].includes(option.value)
                    : false;
                  const optionId = `${getFieldDomId(formIndex, input.name)}-${option.value}`;
                  return (
                    <div key={option.value} className="workflow-checkbox-item">
                      <input
                        id={optionId}
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = Array.isArray(values[key]) ? [...values[key]] : [];
                          if (event.target.checked) {
                            next.push(option.value);
                          } else {
                            const idx = next.indexOf(option.value);
                            if (idx >= 0) {
                              next.splice(idx, 1);
                            }
                          }
                          setValues((prev) => ({ ...prev, [key]: next }));
                        }}
                      />
                      <label htmlFor={optionId}>{option.label}</label>
                    </div>
                  );
                })}
              </div>
              {renderError}
            </div>
          );
        case "select":
          return (
            <div className="form-field" key={key}>
              <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                {input.name}
                {input.required ? <em className="required-star">*</em> : null}
              </label>
              <select
                id={getFieldDomId(formIndex, input.name)}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
              >
                <option value="">请选择</option>
                {(input.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {renderError}
            </div>
          );
        default:
          return (
            <div className="form-field" key={key}>
              <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                {input.name}
                {input.required ? <em className="required-star">*</em> : null}
              </label>
              <input
                id={getFieldDomId(formIndex, input.name)}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
              {renderError}
            </div>
          );
      }
    },
    [errors, fileNames, values]
  );

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValues = { ...values };
    const nextErrors: Record<string, string> = {};
    fields.forEach((form) => {
      form.forEach(({ input, key }) => {
        if (!input.required) {
          return;
        }
        if (input.type === "boolean" && nextValues[key] === undefined) {
          nextValues[key] = false;
        }
        const value = nextValues[key];
        const isEmptyArray = Array.isArray(value) && value.length === 0;
        if (isEmptyArray || value === undefined || value === null || String(value).trim() === "") {
          nextErrors[key] = "必填";
        }
      });
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setValues(nextValues);
    onSubmit?.({ nodeId, values: nextValues });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card workflow-input-modal">
        <div className="modal-header">
          <div>
            <h3>{nodeName || "节点输入"}</h3>
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
              <section key={`form-${formIndex}`} className="workflow-input-form-section">
                {form.length === 0 ? (
                  <div className="form-empty">暂无输入字段</div>
                ) : (
                  form.map(({ input, key }) =>
                    renderField({ input, key, formIndex })
                  )
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

