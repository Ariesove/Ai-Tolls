"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useReviewCore, ReviewCoreContextType } from "./useReviewCore";
import { useReviewUI, ReviewUIContextType } from "./useReviewUI";
import { useReviewHistory, ReviewHistoryContextType } from "./useReviewHistory";

interface CodeReviewContextType {
  core: ReviewCoreContextType;
  ui: ReviewUIContextType;
  history: ReviewHistoryContextType;
}

const CodeReviewContext = createContext<CodeReviewContextType | null>(null);

export const CodeReviewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const core = useReviewCore();
  const ui = useReviewUI();
  const history = useReviewHistory();

  const value = useMemo(
    () => ({
      core,
      ui,
      history,
    }),
    [core, ui, history]
  );

  return (
    <CodeReviewContext.Provider value={value}>
      {children}
    </CodeReviewContext.Provider>
  );
};

export const useCodeReviewContext = () => {
  const context = useContext(CodeReviewContext);
  if (!context) {
    throw new Error(
      "useCodeReviewContext must be used within a CodeReviewProvider"
    );
  }
  return context;
};

// 便利的快捷 Hooks
export const useReviewCoreContext = () => useCodeReviewContext().core;
export const useReviewUIContext = () => useCodeReviewContext().ui;
export const useReviewHistoryContext = () => useCodeReviewContext().history;
