"use client";

import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { ReviewSnapshot } from "@/components/features/code-review/ReviewHistoryPanel";
import { AggregatedReview } from "@/services/review/aggregate";

const HISTORY_KEY = "code_review_history_v1";

export function useReviewHistory() {
  const [history, setHistory] = useState<ReviewSnapshot[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const items = parsed
        .filter((x): x is ReviewSnapshot => Boolean(x && typeof x === "object"))
        .slice(0, 5);
      setHistory(items);
    } catch {
      setHistory([]);
    }
  }, []);

  const saveToHistory = useCallback((snap: Omit<ReviewSnapshot, "id" | "ts">) => {
    const newSnap: ReviewSnapshot = {
      ...snap,
      id: uuidv4(),
      ts: Date.now(),
    };
    setHistory((prev) => {
      const next = [newSnap, ...prev].slice(0, 5);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch { }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch { }
  }, []);

  return {
    history,
    setHistory,
    saveToHistory,
    clearHistory,
  };
}

export type ReviewHistoryContextType = ReturnType<typeof useReviewHistory>;
