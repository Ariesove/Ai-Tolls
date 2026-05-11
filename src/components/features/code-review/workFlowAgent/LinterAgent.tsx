"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { StepCard, StepStatus } from "./BaseAgent";

interface LinterAgentProps {
  status: StepStatus;
}

export default function LinterAgent({ status }: LinterAgentProps) {
  return (
    <StepCard
      title="Linter"
      subtitle="规范 / 类型"
      status={status}
      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
    />
  );
}
