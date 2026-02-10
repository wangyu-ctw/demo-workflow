import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { FaTrashCan } from "react-icons/fa6";
import { IoMdAddCircleOutline } from "react-icons/io";
import type { NodeProperty, NodePort, NodeSnapshot } from "../../stores/nodeStore";
import {
  createNodeDefinition as createNodeDefinitionInDb,
  updateNodeDefinition as updateNodeDefinitionInDb,
} from "../../services/api";
import { NodePropertyType, useNodeStore } from "../../stores/nodeStore";
import { useExecutorStore } from "../../stores/executorStore";

type NodeConfigModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingNodeId?: number | null;
  onSave?: (node: NodeSnapshot) => void;
};

type FormProperty = Omit<NodeProperty<unknown>, "default" | "options"> & {
  default: string;
  options: { name: string; value: string }[];
};

const toFormDefaultValue = (prop: NodeProperty<unknown>) => {
  if (prop.type === NodePropertyType.switch) {
    return prop.default ? "true" : "false";
  }
  if (prop.type === NodePropertyType.checkGroup && Array.isArray(prop.default)) {
    return prop.default.join(", ");
  }
  if (prop.default === undefined || prop.default === null) {
    return "";
  }
  return String(prop.default);
};

const toFormProperties = (properties: NodeProperty<unknown>[] = []): FormProperty[] =>
  properties.map((prop) => ({
    label: prop.label,
    name: prop.name,
    type: prop.type,
    default: toFormDefaultValue(prop),
    options: (prop.options ?? []).map((option) => ({
      name: option.name,
      value: option.value === undefined || option.value === null ? "" : String(option.value),
    })),
    max: prop.max,
    min: prop.min,
  }));

const normalizePort = (port: NodePort): NodePort => ({
  ...port,
  name: port.name ?? "",
  label: port.label ?? port.name ?? "",
});

const modalOverlayClass =
  "fixed inset-0 z-10 flex items-center justify-center bg-[rgba(8,10,15,0.72)]";
const modalCardClass =
  "flex max-h-[88vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#333333] shadow-[0_24px_60px_rgba(0,0,0,0.45)]";
const modalHeaderClass =
  "flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4";
const modalCloseClass = "cursor-pointer bg-transparent text-base text-[#9aa4b2]";
const modalBodyClass = "flex flex-col gap-4 overflow-y-scroll px-5 pb-5 pt-4";
const formFieldClass = "flex flex-col gap-2 text-xs text-[#9aa4b2]";
const formFieldCompactClass = "flex flex-col gap-1.5 text-[11px] text-[#9aa4b2]";
const inputClass =
  "w-full rounded-[10px] border border-[#1e2533] bg-[#0f131c] px-2.5 py-2 text-xs text-[#e6e9ef]";
const formRowClass =
  "grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] items-center gap-2.5";
const formRowWithActionClass = "flex gap-2.5";
const formSectionClass =
  "flex flex-col gap-3 rounded-xl border border-[rgb(118,118,118)] p-3";
const formSectionCompactClass =
  "flex flex-col gap-2.5 rounded-xl border border-[#1a2130] bg-[#0f131c] p-2.5";
const formEmptyClass = "text-xs text-[#707a88]";
const formCardClass =
  "flex flex-col gap-3 rounded-xl border border-[rgb(118,118,118)] p-3";
const miniButtonGhostClass =
  "min-h-8 cursor-pointer rounded-lg border border-[#2a3246] bg-transparent px-2.5 py-1.5 text-xs text-[#9aa4b2]";
const miniButtonWithIconClass =
  "min-h-8 cursor-pointer rounded-lg border border-[rgb(118,118,118)] bg-transparent px-2.5 py-1.5 text-xs text-[#d4dbe6]";
const miniIconButtonClass =
  "inline-flex h-5 w-5 flex-none items-center justify-center self-end border-0 bg-transparent p-0 text-[#ff5a5a]";
const paramDeleteButtonClass =
  "w-full justify-center text-[#ff5a5a]";
const modalActionsClass = "mt-1 flex justify-end gap-2.5 px-5 pb-4";
const ghostButtonClass =
  "rounded-[10px] border border-[#2a3246] bg-transparent px-3.5 py-2 text-xs text-[#c8d0db]";
const primaryButtonClass =
  "rounded-[10px] bg-[#3b68ff] px-3.5 py-2 text-xs text-[#f3f6ff]";
const requireCheckboxClass = "flex items-center gap-2 self-end pb-1 text-xs text-[#9aa4b2]";

export function NodeConfigModal({
  isOpen,
  onClose,
  editingNodeId,
  onSave,
}: NodeConfigModalProps) {
  const nodeLibrary = useNodeStore((state) => Object.values(state.nodes));
  const addNodeDefinition = useNodeStore((state) => state.addNodeDefinition);
  const updateNodeDefinition = useNodeStore((state) => state.updateNodeDefinition);
  const editingNode = useNodeStore((state) =>
    editingNodeId ? state.nodes[editingNodeId] ?? null : null
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(nodeLibrary.map((node) => node.category).filter(Boolean))),
    [nodeLibrary]
  );

  const executors = useExecutorStore((state) => state.executors);
  const defaultExecutorId = executors[0]?.id !== undefined ? String(executors[0].id) : "";

  const [nodeName, setNodeName] = useState("");
  const [nodeCategory, setNodeCategory] = useState(categoryOptions[0] ?? "custom");
  const shouldShowCustomCategory = !categoryOptions.includes(nodeCategory);
  const [inputs, setInputs] = useState<NodePort[]>([]);
  const [outputs, setOutputs] = useState<NodePort[]>([]);
  const [properties, setProperties] = useState<FormProperty[]>([]);
  const [executionId, setExecutionId] = useState(defaultExecutorId);

  const resetCreateForm = () => {
    setNodeName("");
    setNodeCategory(categoryOptions[0] ?? "custom");
    setInputs([]);
    setOutputs([]);
    setProperties([]);
    setExecutionId(defaultExecutorId);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (editingNode) {
      setNodeName(editingNode.title ?? "");
      setNodeCategory(editingNode.category ?? categoryOptions[0] ?? "custom");
      setInputs((editingNode.inputs ?? []).map(normalizePort));
      setOutputs((editingNode.outputs ?? []).map(normalizePort));
      setProperties(toFormProperties(editingNode.properties));
      const executorIds = executors.map((item) => String(item.id));
      setExecutionId(
        executorIds.includes(editingNode.executionId) ? editingNode.executionId : defaultExecutorId
      );
      return;
    }
    resetCreateForm();
  }, [isOpen, editingNode, categoryOptions.length, executors.length, defaultExecutorId]);

  if (!isOpen) {
    return null;
  }

  const handleCreateNodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedProperties: NodeProperty<unknown>[] = properties.map((prop) => {
      let defaultValue: unknown = prop.default;
      if (prop.type === NodePropertyType.inputNumber) {
        const parsed = Number(prop.default);
        defaultValue = Number.isNaN(parsed) ? 0 : parsed;
      }
      if (prop.type === NodePropertyType.switch) {
        defaultValue = prop.default === "true";
      }
      if (prop.type === NodePropertyType.checkGroup) {
        defaultValue = prop.default
          ? prop.default
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [];
      }
      return {
        label: prop.label,
        name: prop.name,
        type: prop.type,
        default: defaultValue,
        options: prop.options?.map((option) => ({
          name: option.name,
          value: option.value,
        })),
        max: prop.max,
        min: prop.min,
      };
    });

    const normalizedInputs = inputs.map((input) => ({
      ...input,
      label: input.label?.trim() || input.name,
      name: input.name.trim(),
    }));
    const normalizedOutputs = outputs.map((output) => ({
      ...output,
      label: output.label?.trim() || output.name,
      name: output.name.trim(),
    }));

    const payload: Omit<NodeSnapshot, "id"> = {
      category: nodeCategory,
      executionId,
      title: nodeName.trim() || nodeCategory,
      inputs: normalizedInputs.length ? normalizedInputs : undefined,
      outputs: normalizedOutputs.length ? normalizedOutputs : undefined,
      properties: normalizedProperties.length ? normalizedProperties : undefined,
    };

    if (editingNodeId) {
      const updated = await updateNodeDefinitionInDb(editingNodeId, payload);
      if (updated) {
        updateNodeDefinition(editingNodeId, payload);
        onSave?.(updated);
      }
    } else {
      const created = await createNodeDefinitionInDb(payload);
      addNodeDefinition(created);
      onSave?.(created);
    }

    onClose();
  };

  return (
    <div className={modalOverlayClass}>
      <div className={modalCardClass}>
        <div className={modalHeaderClass}>
          <h3 className="text-base font-semibold">{editingNodeId ? "编辑节点" : "新增节点"}</h3>
          <button type="button" className={modalCloseClass} onClick={onClose}>
            ✕
          </button>
        </div>
        <form className={modalBodyClass} onSubmit={handleCreateNodeSubmit}>
          <label className={formFieldClass}>
            <span>节点名称</span>
            <input
              className={inputClass}
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
            />
          </label>
          <label className={formFieldClass}>
            <span>目录（目前没啥用但强烈建议使用）</span>
            <select
              className={inputClass}
              value={nodeCategory}
              onChange={(e) => setNodeCategory(e.target.value)}
            >
              {categoryOptions.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
              {shouldShowCustomCategory ? (
                <option value={nodeCategory}>{nodeCategory}</option>
              ) : null}
            </select>
          </label>

          <section className={formSectionClass}>
            <header className="flex items-center justify-between text-[13px] text-[#c8d0db]">
              <span>输入</span>
            </header>
            {inputs.length === 0 ? (
              <div className={formEmptyClass}>暂无输入</div>
            ) : (
              inputs.map((input, index) => {
                const shouldShowOptions = input.type === "select";
                return (
                  <div className={formCardClass} key={`input-${index}`}>
                    <div className={formRowWithActionClass}>
                      <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                        <span>标签</span>
                        <input
                          className={inputClass}
                          value={input.label ?? ""}
                          onChange={(e) =>
                            setInputs((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, label: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                      <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                        <span>名称</span>
                        <input
                          className={inputClass}
                          value={input.name}
                          onChange={(e) =>
                            setInputs((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, name: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                      <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                        <span>类型</span>
                        <select
                          className={inputClass}
                          value={input.type}
                          onChange={(e) =>
                            setInputs((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? { ...item, type: e.target.value as NodePort["type"] }
                                  : item
                              )
                            )
                          }
                        >
                          <option value="object">object</option>
                          <option value="images">images</option>
                          <option value="string">string</option>
                          <option value="select">select</option>
                          <option value="number">number</option>
                        </select>
                      </div>
                      <div className={requireCheckboxClass}>
                        <input
                          type="checkbox"
                          checked={Boolean(input.required)}
                          onChange={(e) =>
                            setInputs((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, required: e.target.checked } : item
                              )
                            )
                          }
                        />
                        <span>必填</span>
                      </div>
                      <button
                        type="button"
                        className={`${miniButtonGhostClass} ${miniIconButtonClass}`}
                        onClick={() => setInputs((prev) => prev.filter((_, idx) => idx !== index))}
                      >
                        <FaTrashCan aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {input.type === "number" ? (
                      <div className={formRowClass}>
                        <div className={formFieldCompactClass}>
                          <span>最小值</span>
                          <input
                            className={inputClass}
                            type="number"
                            value={input.min ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextValue = raw === "" ? undefined : Number(raw);
                              if (raw !== "" && Number.isNaN(nextValue)) {
                                return;
                              }
                              setInputs((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, min: nextValue } : item
                                )
                              );
                            }}
                          />
                        </div>
                        <div className={formFieldCompactClass}>
                          <span>最大值</span>
                          <input
                            className={inputClass}
                            type="number"
                            value={input.max ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextValue = raw === "" ? undefined : Number(raw);
                              if (raw !== "" && Number.isNaN(nextValue)) {
                                return;
                              }
                              setInputs((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, max: nextValue } : item
                                )
                              );
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                    {input.type === "images" ? (
                      <div className={formRowClass}>
                        <div className={formFieldCompactClass}>
                          <span>最多数量</span>
                          <input
                            className={inputClass}
                            type="number"
                            value={input.max ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextValue = raw === "" ? undefined : Number(raw);
                              if (raw !== "" && Number.isNaN(nextValue)) {
                                return;
                              }
                              setInputs((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, max: nextValue } : item
                                )
                              );
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                    {shouldShowOptions ? (
                      <div className={formSectionCompactClass}>
                        <header className="flex items-center justify-between text-[13px] text-[#c8d0db]">
                          <span>选项</span>
                        </header>
                        {(input.options ?? []).length === 0 ? (
                          <div className={formEmptyClass}>暂无选项</div>
                        ) : (
                          (input.options ?? []).map((option, optionIndex) => (
                            <div
                              className={formRowWithActionClass}
                              key={`input-option-${index}-${optionIndex}`}
                            >
                              <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                                <span>标签</span>
                                <input
                                  className={inputClass}
                                  value={option.label}
                                  onChange={(e) =>
                                    setInputs((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((opt, optIdx) =>
                                                optIdx === optionIndex
                                                  ? { ...opt, label: e.target.value }
                                                  : opt
                                              ),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                                <span>值</span>
                                <input
                                  className={inputClass}
                                  value={option.value}
                                  onChange={(e) =>
                                    setInputs((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index
                                          ? {
                                              ...item,
                                              options: (item.options ?? []).map((opt, optIdx) =>
                                                optIdx === optionIndex
                                                  ? { ...opt, value: e.target.value }
                                                  : opt
                                              ),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                className={`${miniButtonGhostClass} ${miniIconButtonClass}`}
                                onClick={() =>
                                  setInputs((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? {
                                            ...item,
                                            options: (item.options ?? []).filter(
                                              (_opt, optIdx) => optIdx !== optionIndex
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              >
                                <FaTrashCan aria-hidden="true" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                        <button
                          type="button"
                          className={miniButtonWithIconClass}
                          onClick={() =>
                            setInputs((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? {
                                      ...item,
                                      options: [...(item.options ?? []), { label: "", value: "" }],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          <p className="flex items-center gap-2">
                            <IoMdAddCircleOutline aria-hidden="true" className="h-3.5 w-3.5" />
                            添加选项
                          </p>
                        </button>
                      </div>
                    ) : null}
                    {input.type === "select" ? (
                      <div className={formRowClass}>
                        <div className={formFieldCompactClass}>
                          <span>最多选择</span>
                          <input
                            className={inputClass}
                            type="number"
                            value={input.max ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextValue = raw === "" ? undefined : Number(raw);
                              if (raw !== "" && Number.isNaN(nextValue)) {
                                return;
                              }
                              setInputs((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, max: nextValue } : item
                                )
                              );
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            <button
              type="button"
              className={miniButtonWithIconClass}
              onClick={() =>
                setInputs((prev) => [
                  ...prev,
                  { label: "", name: "", type: "string", required: false },
                ])
              }
            >
              <p className="flex items-center gap-2">
                <IoMdAddCircleOutline aria-hidden="true" className="h-3.5 w-3.5" />
                添加输入
              </p>
            </button>
          </section>

          <section className={formSectionClass}>
            <header className="flex items-center justify-between text-[13px] text-[#c8d0db]">
              <span>输出</span>
            </header>
            {outputs.length === 0 ? (
              <div className={formEmptyClass}>暂无输出</div>
            ) : (
              outputs.map((output, index) => (
                <div className={formRowWithActionClass} key={`output-${index}`}>
                  <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                    <span>标签</span>
                    <input
                      className={inputClass}
                      value={output.label ?? ""}
                      onChange={(e) =>
                        setOutputs((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, label: e.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                    <span>名称</span>
                    <input
                      className={inputClass}
                      value={output.name}
                      onChange={(e) =>
                        setOutputs((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                    <span>类型</span>
                    <select
                      className={inputClass}
                      value={output.type}
                      onChange={(e) =>
                        setOutputs((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, type: e.target.value as NodePort["type"] }
                              : item
                          )
                        )
                      }
                    >
                      <option value="object">object</option>
                      <option value="images">images</option>
                      <option value="string">string</option>
                      <option value="number">number</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className={`${miniButtonGhostClass} ${miniIconButtonClass}`}
                    onClick={() => setOutputs((prev) => prev.filter((_, idx) => idx !== index))}
                  >
                    <FaTrashCan aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              className={miniButtonWithIconClass}
              onClick={() =>
                setOutputs((prev) => [...prev, { label: "", name: "", type: "string" }])
              }
            >
              <p className="flex items-center gap-2">
                <IoMdAddCircleOutline aria-hidden="true" className="h-3.5 w-3.5" />
                添加输出
              </p>
            </button>
          </section>

          <section className={formSectionClass}>
            <header className="flex items-center justify-between text-[13px] text-[#c8d0db]">
              <span>参数</span>
            </header>
            {properties.length === 0 ? (
              <div className={formEmptyClass}>暂无参数</div>
            ) : (
              properties.map((prop, index) => (
                <div className={formCardClass} key={`prop-${index}`}>
                  <div className={formRowClass}>
                    <div className={formFieldCompactClass}>
                      <span>标签</span>
                      <input
                        className={inputClass}
                        value={prop.label}
                        onChange={(e) =>
                          setProperties((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, label: e.target.value } : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className={formFieldCompactClass}>
                      <span>名称</span>
                      <input
                        className={inputClass}
                        value={prop.name}
                        onChange={(e) =>
                          setProperties((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, name: e.target.value } : item
                            )
                          )
                        }
                      />
                    </div>
                    <div className={formFieldCompactClass}>
                      <span>类型</span>
                      <select
                        className={inputClass}
                        value={prop.type}
                        onChange={(e) =>
                          setProperties((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? { ...item, type: e.target.value as NodePropertyType }
                                : item
                            )
                          )
                        }
                      >
                        <option value={NodePropertyType.textarea}>textarea</option>
                        <option value={NodePropertyType.inputNumber}>inputNumber</option>
                        <option value={NodePropertyType.checkGroup}>checkGroup</option>
                        <option value={NodePropertyType.select}>select</option>
                        <option value={NodePropertyType.switch}>switch</option>
                      </select>
                    </div>
                  </div>
                  <div className={formRowClass}>
                    {prop.type === NodePropertyType.switch ? (
                      <div className={formFieldCompactClass}>
                        <span>默认值</span>
                        <select
                          className={inputClass}
                          value={prop.default}
                          onChange={(e) =>
                            setProperties((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, default: e.target.value } : item
                              )
                            )
                          }
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      </div>
                    ) : (
                      <div className={formFieldCompactClass}>
                        <span>
                          {prop.type === NodePropertyType.checkGroup
                            ? "默认值（逗号分隔）"
                            : "默认值"}
                        </span>
                        <input
                          className={inputClass}
                          type={prop.type === NodePropertyType.inputNumber ? "number" : "text"}
                          value={String(prop.default ?? "")}
                          onChange={(e) =>
                            setProperties((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, default: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                    )}
                    {prop.type === NodePropertyType.inputNumber ? (
                      <>
                        <div className={formFieldCompactClass}>
                          <span>最小值</span>
                          <input
                            className={inputClass}
                            type="number"
                            value={prop.min ?? ""}
                            onChange={(e) =>
                              setProperties((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? {
                                        ...item,
                                        min: e.target.value ? Number(e.target.value) : undefined,
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <div className={formFieldCompactClass}>
                          <span>最大值</span>
                          <input
                            className={inputClass}
                            type="number"
                            value={prop.max ?? ""}
                            onChange={(e) =>
                              setProperties((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? {
                                        ...item,
                                        max: e.target.value ? Number(e.target.value) : undefined,
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  {prop.type === NodePropertyType.select ||
                  prop.type === NodePropertyType.checkGroup ? (
                    <div className={formSectionCompactClass}>
                      <header className="flex items-center justify-between text-[13px] text-[#c8d0db]">
                        <span>选项</span>
                      </header>
                      {(prop.options ?? []).length === 0 ? (
                        <div className={formEmptyClass}>暂无选项</div>
                      ) : (
                        (prop.options ?? []).map((option, optionIndex) => (
                          <div
                            className={formRowWithActionClass}
                            key={`prop-option-${index}-${optionIndex}`}
                          >
                            <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                              <span>名称</span>
                              <input
                                className={inputClass}
                                value={option.name}
                                onChange={(e) =>
                                  setProperties((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? {
                                            ...item,
                                            options: (item.options ?? []).map((opt, optIdx) =>
                                              optIdx === optionIndex
                                                ? { ...opt, name: e.target.value }
                                                : opt
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </div>
                            <div className={`${formFieldCompactClass} flex-1 min-w-0`}>
                              <span>值</span>
                              <input
                                className={inputClass}
                                value={option.value}
                                onChange={(e) =>
                                  setProperties((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index
                                        ? {
                                            ...item,
                                            options: (item.options ?? []).map((opt, optIdx) =>
                                              optIdx === optionIndex
                                                ? { ...opt, value: e.target.value }
                                                : opt
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className={`${miniButtonGhostClass} ${miniIconButtonClass}`}
                              onClick={() =>
                                setProperties((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? {
                                          ...item,
                                          options: (item.options ?? []).filter(
                                            (_opt, optIdx) => optIdx !== optionIndex
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                            >
                              <FaTrashCan aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        className={miniButtonWithIconClass}
                        onClick={() =>
                          setProperties((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? {
                                    ...item,
                                    options: [...(item.options ?? []), { name: "", value: "" }],
                                  }
                                : item
                            )
                          )
                        }
                      >
                        <p className="flex items-center gap-2">
                          <IoMdAddCircleOutline aria-hidden="true" className="h-3.5 w-3.5" />
                          添加选项
                        </p>
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={`${miniButtonGhostClass} ${paramDeleteButtonClass}`}
                    onClick={() => setProperties((prev) => prev.filter((_, idx) => idx !== index))}
                  >
                    <p className="flex items-center justify-center gap-2">
                      <FaTrashCan aria-hidden="true" className="h-3.5 w-3.5" />
                      删除
                    </p>
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              className={miniButtonWithIconClass}
              onClick={() =>
                setProperties((prev) => [
                  ...prev,
                  {
                    label: "",
                    name: "",
                    type: NodePropertyType.textarea,
                    default: "",
                    options: [],
                  },
                ])
              }
            >
              <p className="flex items-center gap-2">
                <IoMdAddCircleOutline aria-hidden="true" className="h-3.5 w-3.5" />
                添加参数
              </p>
            </button>
          </section>

          <label className={formFieldClass}>
            <span>执行器ID</span>
            <select
              className={inputClass}
              value={executionId}
              onChange={(e) => setExecutionId(e.target.value)}
              disabled={executors.length === 0}
            >
              {executors.length === 0 ? (
                <option value="">暂无执行器</option>
              ) : (
                executors.map((executor) => (
                  <option key={executor.id} value={String(executor.id)}>
                    {executor.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className={modalActionsClass}>
            <button type="button" className={ghostButtonClass} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={primaryButtonClass}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

