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
const getInputLabel = (input: InputForm[number]) => input.label?.trim() || input.name;

const getSelectionOptions = (input: InputForm[number]) => input.options ?? [];

type UploadImagesProps = {
  values?: string[];
  fileNames?: string[];
  required?: boolean;
  max?: number;
  onChange: (payload: { values: string[]; fileNames: string[] }) => void;
};

function UploadImages({ values = [], fileNames = [], required, max, onChange }: UploadImagesProps) {
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) {
        return;
      }
      const remaining = max ? Math.max(0, max - values.length) : files.length;
      const nextFiles = files.slice(0, remaining);
      const readFile = (file: File) =>
        new Promise<{ value: string; name: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({ value: typeof reader.result === "string" ? reader.result : "", name: file.name });
          };
          reader.readAsDataURL(file);
        });
      const results = await Promise.all(nextFiles.map(readFile));
      const nextValues = [...values, ...results.map((item) => item.value)];
      const nextNames = [...fileNames, ...results.map((item) => item.name)];
      onChange({ values: nextValues, fileNames: nextNames });
      event.target.value = "";
    },
    [fileNames, max, onChange, values]
  );

  return (
    <div className="workflow-image-input">
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        aria-required={required}
      />
      {values.length > 0 ? (
        <div className="workflow-image-list">
          {values.map((item, index) => (
            <div key={`${item}-${index}`} className="workflow-image-item">
              <button
                type="button"
                className="link-button"
                onClick={() => window.open(item, "_blank")}
              >
                {fileNames[index] || `图片 ${index + 1}`}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  const nextValues = values.filter((_, i) => i !== index);
                  const nextNames = fileNames.filter((_, i) => i !== index);
                  onChange({ values: nextValues, fileNames: nextNames });
                }}
              >
                删除
              </button>
            </div>
          ))}
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
  const [fileNames, setFileNames] = useState<Record<string, string | string[]>>({});

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
      const label = getInputLabel(input);
      const inputType = input.type;
      const selectionOptions = inputType === "select" ? getSelectionOptions(input) : [];
      const selectionMax = inputType === "select" ? input.max : undefined;
      const renderError = errors[key] ? <span className="form-error">{errors[key]}</span> : null;

      switch (inputType) {
        case "images": {
          const listValues = Array.isArray(values[key]) ? values[key] : [];
          const listNames = (fileNames[getFieldFileKey(formIndex, input.name)] ??
            []) as string[];
          return (
            <div className="form-field" key={key}>
              <div className="workflow-field-label">
                <span>{label}</span>
                {input.required ? <em className="required-star">*</em> : null}
                {input.max ? <span className="workflow-field-tip">最多 {input.max} 张</span> : null}
              </div>
              <UploadImages
                values={listValues}
                fileNames={listNames}
                required={input.required}
                max={input.max}
                onChange={(payload) => {
                  setValues((prev) => ({ ...prev, [key]: payload.values }));
                  setFileNames((prev) => ({
                    ...prev,
                    [getFieldFileKey(formIndex, input.name)]: payload.fileNames,
                  }));
                  setErrors((prev) => ({ ...prev, [key]: "" }));
                }}
              />
              {renderError}
            </div>
          );
        }
        case "object":
          return (
            <div className="form-field" key={key}>
              <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                {label}
                {input.required ? <em className="required-star">*</em> : null}
              </label>
              <textarea
                id={getFieldDomId(formIndex, input.name)}
                rows={6}
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
              {renderError}
            </div>
          );
        case "number":
          return (
            <div className="form-field" key={key}>
              <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                {label}
                {input.required ? <em className="required-star">*</em> : null}
              </label>
              <input
                id={getFieldDomId(formIndex, input.name)}
                type="number"
                min={(input as any).min}
                max={(input as any).max}
                step="any"
                value={values[key] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
              {renderError}
            </div>
          );
        case "select": {
          if (selectionOptions.length === 0) {
            return (
              <div className="form-field" key={key}>
                <div className="workflow-field-label">
                  <span>{label}</span>
                  {input.required ? <em className="required-star">*</em> : null}
                </div>
                <div className="form-empty">暂无选项</div>
                {renderError}
              </div>
            );
          }
          if (selectionMax === 1) {
            return (
              <div className="form-field" key={key}>
                <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                  {label}
                  {input.required ? <em className="required-star">*</em> : null}
                </label>
                <select
                  id={getFieldDomId(formIndex, input.name)}
                  value={(values[key] as string | undefined) ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                >
                  <option value="">请选择</option>
                  {selectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {renderError}
              </div>
            );
          }
          return (
            <div className="form-field" key={key}>
              <div className="workflow-field-label">
                <span>{label}</span>
                {input.required ? <em className="required-star">*</em> : null}
                {selectionMax ? (
                  <span className="workflow-field-tip">最多 {selectionMax} 项</span>
                ) : null}
              </div>
              <div className="workflow-checkbox-group">
                {selectionOptions.map((option) => {
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
                            if (selectionMax && next.length >= selectionMax) {
                              setErrors((prev) => ({
                                ...prev,
                                [key]: `最多选择 ${selectionMax} 项`,
                              }));
                              return;
                            }
                            next.push(option.value);
                          } else {
                            const idx = next.indexOf(option.value);
                            if (idx >= 0) {
                              next.splice(idx, 1);
                            }
                          }
                          setErrors((prev) => ({ ...prev, [key]: "" }));
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
        }
        default:
          return (
            <div className="form-field" key={key}>
              <label className="workflow-field-label" htmlFor={getFieldDomId(formIndex, input.name)}>
                {label}
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
        const inputType = input.type;
        const value = nextValues[key];

        if (inputType === "object") {
          if (value === undefined || value === null || String(value).trim() === "") {
            if (input.required) {
              nextErrors[key] = "必填";
            }
            return;
          }
          try {
            nextValues[key] = typeof value === "string" ? JSON.parse(value) : value;
          } catch (error) {
            nextErrors[key] = "JSON 格式错误";
          }
          return;
        }

        if (inputType === "images") {
          const listValue = Array.isArray(value) ? value : value ? [value] : [];
          if (input.max && listValue.length > input.max) {
            nextErrors[key] = `最多上传 ${input.max} 张`;
            return;
          }
          if (input.required && listValue.length === 0) {
            nextErrors[key] = "必填";
          }
          nextValues[key] = listValue;
          return;
        }

        if (inputType === "select") {
          const selectionMax = input.max;
          if (selectionMax === 1) {
            if (
              input.required &&
              (value === undefined || value === null || String(value).trim() === "")
            ) {
              nextErrors[key] = "必填";
            }
            return;
          }
          const listValue = Array.isArray(value) ? value : [];
          if (selectionMax && listValue.length > selectionMax) {
            nextErrors[key] = `最多选择 ${selectionMax} 项`;
            return;
          }
          if (input.required && listValue.length === 0) {
            nextErrors[key] = "必填";
          }
          return;
        }

        if (!input.required) {
          return;
        }
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

