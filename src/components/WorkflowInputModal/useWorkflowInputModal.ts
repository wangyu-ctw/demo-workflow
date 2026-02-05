import { useCallback, useRef, useState } from "react";
import type { InputForm } from "../../types/workflow";

export type WorkflowInputValues = Record<string, any>;

export type WorkflowInputModalProps = {
  isOpen: boolean;
  nodeId: string;
  nodeName: string;
  inputForms: InputForm[];
  formValue?: WorkflowInputValues;
  onClose: () => void;
  onSubmit?: (payload: { nodeId: string; values: Record<string, any> }) => void;
};

type FillWorkflowInputsOptions = Omit<WorkflowInputModalProps, "isOpen" | "onClose" | "onSubmit"> & {
  formValue?: WorkflowInputValues;
};

type WorkflowInputModalState = {
  isOpen: boolean;
  nodeId: string;
  nodeName: string;
  inputForms: InputForm[];
  formValue?: WorkflowInputValues;
};

type Deferred<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const emptyState: WorkflowInputModalState = {
  isOpen: false,
  nodeId: "",
  nodeName: "",
  inputForms: [],
  formValue: undefined,
};

export function useWorkflowInputModal() {
  const [state, setState] = useState<WorkflowInputModalState>(emptyState);
  const pendingRef = useRef<Deferred<{ nodeId: string; values: Record<string, any> }> | null>(null);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    if (pendingRef.current) {
      pendingRef.current.reject(new Error("WorkflowInputModal closed"));
      pendingRef.current = null;
    }
  }, []);

  const fillWorkflowInputs = useCallback(
    (options: FillWorkflowInputsOptions) =>
      new Promise<{ nodeId: string; values: Record<string, any> }>((resolve, reject) => {
        pendingRef.current?.reject(new Error("WorkflowInputModal replaced"));
        pendingRef.current = { resolve, reject };
        setState({
          isOpen: true,
          nodeId: options.nodeId,
          nodeName: options.nodeName,
          inputForms: options.inputForms,
          formValue: options.formValue,
        });
      }),
    []
  );

  const handleSubmit = useCallback((payload: { nodeId: string; values: Record<string, any> }) => {
    if (pendingRef.current) {
      pendingRef.current.resolve(payload);
      pendingRef.current = null;
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const modalProps: WorkflowInputModalProps = {
    isOpen: state.isOpen,
    nodeId: state.nodeId,
    nodeName: state.nodeName,
    inputForms: state.inputForms,
    formValue: state.formValue,
    onClose: closeModal,
    onSubmit: handleSubmit,
  };

  return { modalProps, fillWorkflowInputs, closeModal };
}

