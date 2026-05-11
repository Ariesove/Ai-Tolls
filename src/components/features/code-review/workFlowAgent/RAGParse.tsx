"use client";

import React from "react";
import { Database } from "lucide-react";
import { StepCard, StepStatus } from "./BaseAgent";

interface RAGParseProps {
  status: StepStatus;
  meta?: string;
  onOpenKb?: () => void;
}

export default function RAGParse({ status, meta, onOpenKb }: RAGParseProps) {
  return (
    <div className="flex flex-col gap-2">
      <StepCard
        title="RAG 解析"
        subtitle="上传 / 切片入库"
        status={status}
        meta={meta}
        icon={<Database className="h-3.5 w-3.5" />}
        onClick={onOpenKb}
      />
    </div>
  );
}
