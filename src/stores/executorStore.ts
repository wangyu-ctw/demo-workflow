import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ExecutorSnapshot = {
  id: number;
  name: string;
};

type ExecutorStore = {
  executors: ExecutorSnapshot[];
  setExecutors: (executors: ExecutorSnapshot[]) => void;
};

export const useExecutorStore = create<ExecutorStore>()(
  devtools(
    (set) => ({
      executors: [
        { id: 1, name: "生成图片" },
        { id: 2, name: "生成提示词" },
        { id: 3, name: "直接返回输入数据" },
      ],
      setExecutors: (executors) => set({ executors }, false, "executor/setExecutors"),
    }),
    { name: "ExecutorStore" }
  )
);

