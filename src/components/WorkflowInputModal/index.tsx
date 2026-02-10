import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InputForm } from "../../types/workflow";
import type { WorkflowInputModalProps } from "./useWorkflowInputModal";
const modalOverlayClass =
  "fixed inset-0 z-10 flex items-center justify-center bg-[rgba(8,10,15,0.72)]";
const modalCardClass =
  "flex max-h-[88vh] w-[min(560px,92vw)] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#333333] shadow-[0_24px_60px_rgba(0,0,0,0.45)]";
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
const formFieldClass = "flex flex-col gap-2 text-xs text-[#9aa4b2]";
const formEmptyClass = "text-xs text-[#707a88]";
const formErrorClass = "mt-1.5 text-xs text-[#ff5a5a]";
const fieldLabelClass = "flex items-center gap-1.5";
const fieldTipClass = "text-xs text-[#9aa4b2]";
const requiredStarClass = "text-[#ff5a5a] not-italic";
const imageInputClass = "flex flex-col gap-2";
const imageListClass = "flex flex-col gap-2";
const imageItemClass = "flex items-center gap-2";
const linkButtonClass =
  "cursor-pointer bg-transparent p-0 text-xs text-[#6aa9ff] underline";
const checkboxGroupClass = "flex flex-col gap-1.5";
const checkboxItemClass = "flex items-center gap-1.5 text-xs text-[#c8d0db]";
const formSectionClass = "flex flex-col gap-3";

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
    <div className={imageInputClass}>
      <input
        className={inputClass}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        aria-required={required}
      />
      {values.length > 0 ? (
        <div className={imageListClass}>
          {values.map((item, index) => (
            <div key={`${item}-${index}`} className={imageItemClass}>
              <button
                type="button"
                className={linkButtonClass}
                onClick={() => window.open(item, "_blank")}
              >
                {fileNames[index] || `图片 ${index + 1}`}
              </button>
              <button
                type="button"
                className={ghostButtonClass}
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
      const renderError = errors[key] ? <span className={formErrorClass}>{errors[key]}</span> : null;

      switch (inputType) {
        case "images": {
          const listValues = Array.isArray(values[key]) ? values[key] : [];
          const listNames = (fileNames[getFieldFileKey(formIndex, input.name)] ??
            []) as string[];
          return (
            <div className={formFieldClass} key={key}>
              <div className={fieldLabelClass}>
                <span>{label}</span>
                {input.required ? <em className={requiredStarClass}>*</em> : null}
                {input.max ? <span className={fieldTipClass}>最多 {input.max} 张</span> : null}
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
            <div className={formFieldClass} key={key}>
              <label className={fieldLabelClass} htmlFor={getFieldDomId(formIndex, input.name)}>
                {label}
                {input.required ? <em className={requiredStarClass}>*</em> : null}
              </label>
              <textarea
                id={getFieldDomId(formIndex, input.name)}
                className={inputClass}
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
            <div className={formFieldClass} key={key}>
              <label className={fieldLabelClass} htmlFor={getFieldDomId(formIndex, input.name)}>
                {label}
                {input.required ? <em className={requiredStarClass}>*</em> : null}
              </label>
              <input
                id={getFieldDomId(formIndex, input.name)}
                className={inputClass}
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
              <div className={formFieldClass} key={key}>
                <div className={fieldLabelClass}>
                  <span>{label}</span>
                  {input.required ? <em className={requiredStarClass}>*</em> : null}
                </div>
                <div className={formEmptyClass}>暂无选项</div>
                {renderError}
              </div>
            );
          }
          if (selectionMax === 1) {
            return (
              <div className={formFieldClass} key={key}>
                <label className={fieldLabelClass} htmlFor={getFieldDomId(formIndex, input.name)}>
                  {label}
                  {input.required ? <em className={requiredStarClass}>*</em> : null}
                </label>
                <select
                  id={getFieldDomId(formIndex, input.name)}
                  className={inputClass}
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
            <div className={formFieldClass} key={key}>
              <div className={fieldLabelClass}>
                <span>{label}</span>
                {input.required ? <em className={requiredStarClass}>*</em> : null}
                {selectionMax ? (
                  <span className={fieldTipClass}>最多 {selectionMax} 项</span>
                ) : null}
              </div>
              <div className={checkboxGroupClass}>
                {selectionOptions.map((option) => {
                  const checked = Array.isArray(values[key])
                    ? values[key].includes(option.value)
                    : false;
                  const optionId = `${getFieldDomId(formIndex, input.name)}-${option.value}`;
                  return (
                    <div key={option.value} className={checkboxItemClass}>
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
            <div className={formFieldClass} key={key}>
              <label className={fieldLabelClass} htmlFor={getFieldDomId(formIndex, input.name)}>
                {label}
                {input.required ? <em className={requiredStarClass}>*</em> : null}
              </label>
              <input
                id={getFieldDomId(formIndex, input.name)}
                className={inputClass}
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
    <div className={modalOverlayClass}>
      <div className={modalCardClass}>
        <div className={modalHeaderClass}>
          <div>
            <h3 className="text-base font-semibold">{nodeName || "节点输入"}</h3>
          </div>
          <button type="button" className={modalCloseClass} onClick={onClose}>
            ✕
          </button>
        </div>
        <form className={modalBodyClass} onSubmit={handleSubmit}>
          {fields.length === 0 ? (
            <div className={formEmptyClass}>暂无输入字段</div>
          ) : (
            fields.map((form, formIndex) => (
              <section key={`form-${formIndex}`} className={formSectionClass}>
                {form.length === 0 ? (
                  <div className={formEmptyClass}>暂无输入字段</div>
                ) : (
                  form.map(({ input, key }) =>
                    renderField({ input, key, formIndex })
                  )
                )}
              </section>
            ))
          )}
          <div className={modalActionsClass}>
            <button type="button" className={ghostButtonClass} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={primaryButtonClass}>
              提交
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

