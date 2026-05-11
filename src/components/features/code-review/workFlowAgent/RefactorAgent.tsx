"use client";

import React from "react";
import { GitMerge } from "lucide-react";
import { StepCard, StepStatus } from "./BaseAgent";

interface RefactorAgentProps {
  status: StepStatus;
}

export default function RefactorAgent({ status }: RefactorAgentProps) {
  return (
    <div className="flex flex-1 gap-2">
      <StepCard
        title="最终整合"
        subtitle="统一输出"
        status={status}
        icon={<GitMerge className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
