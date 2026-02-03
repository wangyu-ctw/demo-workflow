import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { FaTrashCan } from "react-icons/fa6";
import { IoMdAddCircleOutline } from "react-icons/io";
import type { NodeProperty, NodePort, NodeSnapshot } from "../../stores/nodeStore";
import { NodePropertyType, useNodeStore } from "../../stores/nodeStore";
import "./style.css";

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

  const [nodeName, setNodeName] = useState("");
  const [nodeCategory, setNodeCategory] = useState(categoryOptions[0] ?? "custom");
  const shouldShowCustomCategory = !categoryOptions.includes(nodeCategory);
  const [nodeWidth, setNodeWidth] = useState(180);
  const [nodeHeight, setNodeHeight] = useState(80);
  const [inputs, setInputs] = useState<NodePort[]>([]);
  const [outputs, setOutputs] = useState<NodePort[]>([]);
  const [properties, setProperties] = useState<FormProperty[]>([]);
  const [executionId, setExecutionId] = useState("exec/custom");

  const resetCreateForm = () => {
    setNodeName("");
    setNodeCategory(categoryOptions[0] ?? "custom");
    setNodeWidth(180);
    setNodeHeight(80);
    setInputs([]);
    setOutputs([]);
    setProperties([]);
    setExecutionId("exec/custom");
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (editingNode) {
      setNodeName(editingNode.title ?? "");
      setNodeCategory(editingNode.category ?? categoryOptions[0] ?? "custom");
      setNodeWidth(editingNode.size?.[0] ?? 180);
      setNodeHeight(editingNode.size?.[1] ?? 80);
      setInputs(editingNode.inputs ?? []);
      setOutputs(editingNode.outputs ?? []);
      setProperties(toFormProperties(editingNode.properties));
      setExecutionId(editingNode.executionId);
      return;
    }
    resetCreateForm();
  }, [isOpen, editingNode, categoryOptions.length]);

  if (!isOpen) {
    return null;
  }

  const handleCreateNodeSubmit = (event: FormEvent<HTMLFormElement>) => {
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

    const payload: Omit<NodeSnapshot, "id"> = {
      category: nodeCategory,
      executionId,
      title: nodeName.trim() || nodeCategory,
      size: [nodeWidth, nodeHeight],
      inputs: inputs.length ? inputs : undefined,
      outputs: outputs.length ? outputs : undefined,
      properties: normalizedProperties.length ? normalizedProperties : undefined,
    };

    if (editingNodeId) {
      const updated = updateNodeDefinition(editingNodeId, payload);
      if (updated) {
        onSave?.(updated);
      }
    } else {
      const created = addNodeDefinition(payload);
      onSave?.(created);
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingNodeId ? "编辑节点" : "新增节点"}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={handleCreateNodeSubmit}>
          <label className="form-field">
            <span>节点名称</span>
            <input value={nodeName} onChange={(e) => setNodeName(e.target.value)} />
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>宽度</span>
              <input
                type="number"
                value={nodeWidth}
                onChange={(e) => setNodeWidth(Number(e.target.value))}
              />
            </label>
            <label className="form-field">
              <span>高度</span>
              <input
                type="number"
                value={nodeHeight}
                onChange={(e) => setNodeHeight(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="form-field">
            <span>类型</span>
            <select value={nodeCategory} onChange={(e) => setNodeCategory(e.target.value)}>
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

          <section className="form-section">
            <header>
              <span>输入</span>
            </header>
            {inputs.length === 0 ? (
              <div className="form-empty">暂无输入</div>
            ) : (
              inputs.map((input, index) => (
                <div className="form-row form-row-with-action" key={`input-${index}`}>
                  <input
                    placeholder="名称"
                    value={input.name}
                    onChange={(e) =>
                      setInputs((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, name: e.target.value } : item
                        )
                      )
                    }
                  />
                  <select
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
                    <option value="image">image</option>
                    <option value="prompt">prompt</option>
                    <option value="number">number</option>
                  </select>
                  <button
                    type="button"
                    className="mini-button ghost mini-icon-button"
                    onClick={() => setInputs((prev) => prev.filter((_, idx) => idx !== index))}
                  >
                    <FaTrashCan aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              className="mini-button with-icon"
              onClick={() => setInputs((prev) => [...prev, { name: "", type: "prompt" }])}
            >
              <p>
                <IoMdAddCircleOutline aria-hidden="true" />
                添加输入
              </p>
            </button>
          </section>

          <section className="form-section">
            <header>
              <span>输出</span>
            </header>
            {outputs.length === 0 ? (
              <div className="form-empty">暂无输出</div>
            ) : (
              outputs.map((output, index) => (
                <div className="form-row form-row-with-action" key={`output-${index}`}>
                  <input
                    placeholder="名称"
                    value={output.name}
                    onChange={(e) =>
                      setOutputs((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, name: e.target.value } : item
                        )
                      )
                    }
                  />
                  <select
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
                    <option value="image">image</option>
                    <option value="prompt">prompt</option>
                    <option value="number">number</option>
                  </select>
                  <button
                    type="button"
                    className="mini-button ghost mini-icon-button"
                    onClick={() => setOutputs((prev) => prev.filter((_, idx) => idx !== index))}
                  >
                    <FaTrashCan aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              className="mini-button with-icon"
              onClick={() => setOutputs((prev) => [...prev, { name: "", type: "prompt" }])}
            >
              <p>
                <IoMdAddCircleOutline aria-hidden="true" />
                添加输出
              </p>
            </button>
          </section>

          <section className="form-section">
            <header>
              <span>参数</span>
            </header>
            {properties.length === 0 ? (
              <div className="form-empty">暂无参数</div>
            ) : (
              properties.map((prop, index) => (
                <div className="form-card" key={`prop-${index}`}>
                  <div className="form-row">
                    <input
                      placeholder="标签"
                      value={prop.label}
                      onChange={(e) =>
                        setProperties((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, label: e.target.value } : item
                          )
                        )
                      }
                    />
                    <input
                      placeholder="名称"
                      value={prop.name}
                      onChange={(e) =>
                        setProperties((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                    />
                    <select
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
                  <div className="form-row">
                    {prop.type === NodePropertyType.switch ? (
                      <select
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
                    ) : (
                      <input
                        placeholder={
                          prop.type === NodePropertyType.checkGroup ? "默认值（逗号分隔）" : "默认值"
                        }
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
                    )}
                    {prop.type === NodePropertyType.inputNumber ? (
                      <>
                        <input
                          placeholder="最小值"
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
                        <input
                          placeholder="最大值"
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
                      </>
                    ) : null}
                  </div>
                  {prop.type === NodePropertyType.select ||
                  prop.type === NodePropertyType.checkGroup ? (
                    <div className="form-section compact">
                      <header>
                        <span>选项</span>
                      </header>
                      {(prop.options ?? []).length === 0 ? (
                        <div className="form-empty">暂无选项</div>
                      ) : (
                        (prop.options ?? []).map((option, optionIndex) => (
                          <div
                            className="form-row form-row-with-action"
                            key={`prop-option-${index}-${optionIndex}`}
                          >
                            <input
                              placeholder="名称"
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
                            <input
                              placeholder="值"
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
                            <button
                              type="button"
                              className="mini-button ghost mini-icon-button option-delete-button"
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
                              <FaTrashCan aria-hidden="true" />
                            </button>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        className="mini-button with-icon"
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
                        <p>
                          <IoMdAddCircleOutline aria-hidden="true" />
                          添加选项
                        </p>
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mini-button with-icon ghost param-delete-button"
                    onClick={() => setProperties((prev) => prev.filter((_, idx) => idx !== index))}
                  >
                    <p>
                      <FaTrashCan aria-hidden="true" />
                      删除
                    </p>
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              className="mini-button with-icon"
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
              <p>
                <IoMdAddCircleOutline aria-hidden="true" />
                添加参数
              </p>
            </button>
          </section>

          <label className="form-field">
            <span>执行器ID</span>
            <input
              value={executionId}
              onChange={(e) => setExecutionId(e.target.value)}
              placeholder="exec/your-action"
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

