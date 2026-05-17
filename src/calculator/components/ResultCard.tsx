import { ReactNode } from "react";

interface ResultCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
}

export function ResultCard({ label, value, unit, icon }: ResultCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <div className="text-blue-400">{icon}</div>}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white font-mono">
          {typeof value === "number" ? value.toFixed(4) : value}
        </span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}
