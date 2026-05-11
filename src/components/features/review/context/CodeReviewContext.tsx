"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useReviewUI, ReviewUIContextType } from "./useReviewUI";
import { useReviewHistory, ReviewHistoryContextType } from "./useReviewHistory";
import { useReviewCore, ReviewCoreContextType } from "./useReviewCore";

interface CodeReviewContextType {
  ui: ReviewUIContextType;
  history: ReviewHistoryContextType;
  core: ReviewCoreContextType;
  actions: {
    restoreSnapshot: (id: string) => void;
    openSnapshotDiff: (id: string) => void;
  };
}

const CodeReviewContext = createContext<CodeReviewContextType | null>(null);

export const CodeReviewProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const ui = useReviewUI();
  const history = useReviewHistory();
  const core = useReviewCore();

  const restoreSnapshot = (id: string) => {
    const snap = history.history.find((h) => h.id === id);
    if (!snap) return;
    core.setCode(snap.code);
    core.setReviewedCode(snap.code);
    core.setCommandText(snap.commandText);
    core.setFinalCode(snap.finalCode);
    core.setAggregated(snap.aggregated as any);
    core.setResults([]);
    ui.setIsDiffOpen(false);
    ui.setShowAgentDetails(false);
    core.setLastApplied(null);
    ui.setLayoutMode("split");
    setTimeout(() => {
      core.editorRef.current?.focus();
    }, 0);
  };

  const openSnapshotDiff = (id: string) => {
    const snap = history.history.find((h) => h.id === id);
    if (!snap) return;
    core.setReviewedCode(snap.code);
    core.setFinalCode(snap.finalCode);
    ui.setDiffTargetRole("FINAL");
    ui.setIsDiffOpen(true);
  };

  return (
    <CodeReviewContext.Provider
      value={{
        ui,
        history,
        core,
        actions: { restoreSnapshot, openSnapshotDiff },
      }}
    >
      {children}
    </CodeReviewContext.Provider>
  );
};

export const useCodeReviewContext = () => {
  const context = useContext(CodeReviewContext);
  if (!context) {
    throw new Error(
      "useCodeReviewContext must be used within a CodeReviewProvider",
    );
  }
  return context;
};
