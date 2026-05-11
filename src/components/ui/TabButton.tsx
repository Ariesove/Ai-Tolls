"use client";

import React from "react";

const TabButton: React.FC<{
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  meta?: string;
  onClick: () => void;
}> = ({ active, label, icon, meta, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        "transition-colors",
        active
          ? "border-indigo-500/40 bg-indigo-500/10 text-zinc-100"
          : "border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
      ].join(" ")}
    >
      {icon ? <span className="text-zinc-300">{icon}</span> : null}
      <span className="font-medium">{label}</span>
      {meta ? (
        <span
          className={[
            "ml-1 rounded-full border px-1.5 py-0.5 text-[10px] tabular-nums",
            active
              ? "border-indigo-500/30 text-indigo-200"
              : "border-zinc-800 text-zinc-500",
          ].join(" ")}
        >
          {meta}
        </span>
      ) : null}
      {active ? (
        <span className="pointer-events-none absolute inset-x-2 -bottom-[7px] h-[2px] rounded-full bg-gradient-to-r from-indigo-400/0 via-indigo-400/70 to-cyan-400/0" />
      ) : null}
    </button>
  );
};

export default TabButton;
