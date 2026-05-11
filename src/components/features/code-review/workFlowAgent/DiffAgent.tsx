"use client";

import React from "react";
import { Diff } from "lucide-react";
import { StepCard, StepStatus } from "./BaseAgent";

interface DiffAgentProps {
  status: StepStatus;
}

export default function DiffAgent({ status }: DiffAgentProps) {
  return (
    <div className="flex flex-1 gap-2">
      <StepCard
        title="Diff"
        subtitle="改动对比"
        status={status}
        icon={<Diff className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
