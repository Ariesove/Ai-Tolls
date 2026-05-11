"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { StepCard, StepStatus } from "./BaseAgent";

interface ArchitectAgentProps {
  status: StepStatus;
}

export default function ArchitectAgent({ status }: ArchitectAgentProps) {
  return (
    <StepCard
      title="Architect"
      subtitle="架构 / 性能"
      status={status}
      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
    />
  );
}
