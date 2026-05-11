"use client";

import React from "react";
import { Search } from "lucide-react";
import { StepCard, StepStatus } from "./BaseAgent";

interface RAGSearchProps {
  status: StepStatus;
  meta?: string;
}

export default function RAGSearch({ status, meta }: RAGSearchProps) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <StepCard
        title="RAG 检索"
        subtitle="构建上下文"
        status={status}
        meta={meta}
        icon={<Search className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
