"use client";

import { useState } from "react";
import { AgentRole } from "@/services/Agents/types";

export type LayoutMode = "split" | "review";
export type RightTab = "overview" | "final" | "evidence" | "agents";
export type DiffTargetRole = AgentRole | "FINAL";

export function useReviewUI() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("split");
  const [rightTab, setRightTab] = useState<RightTab>("overview");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffWrap, setDiffWrap] = useState(true);
  const [diffSplit, setDiffSplit] = useState(false);
  const [diffShowOnly, setDiffShowOnly] = useState(true);
  const [diffTargetRole, setDiffTargetRole] = useState<DiffTargetRole>("FINAL");
  const [showAgentDetails, setShowAgentDetails] = useState(false);

  return {
    layoutMode,
    setLayoutMode,
    rightTab,
    setRightTab,
    isSettingsOpen,
    setIsSettingsOpen,
    isKbOpen,
    setIsKbOpen,
    isDiffOpen,
    setIsDiffOpen,
    diffWrap,
    setDiffWrap,
    diffSplit,
    setDiffSplit,
    diffShowOnly,
    setDiffShowOnly,
    diffTargetRole,
    setDiffTargetRole,
    showAgentDetails,
    setShowAgentDetails,
  };
}

export type ReviewUIContextType = ReturnType<typeof useReviewUI>;
