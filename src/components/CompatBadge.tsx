import { CircleCheck, TriangleAlert, CircleX } from "lucide-react";
import type { Suggestion } from "../lib/engine";

type Level = Suggestion["level"];

const STYLES: Record<Level, { bg: string; text: string; Icon: typeof CircleCheck }> = {
  match: { bg: "bg-emerald-600", text: "text-white", Icon: CircleCheck },
  bpm: { bg: "bg-amber-600", text: "text-white", Icon: TriangleAlert },
  none: { bg: "bg-red-600", text: "text-white", Icon: CircleX },
};

interface Props {
  camelot: string | null;
  level?: Level; // si no hay nivel (no hay track de referencia seleccionado), se muestra neutro
}

export default function CompatBadge({ camelot, level }: Props) {
  if (!camelot) {
    return <span className="text-xs text-white/30 px-2">sin analizar</span>;
  }

  if (!level) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white/70">
        {camelot}
      </span>
    );
  }

  const { bg, text, Icon } = STYLES[level];
  return (
    <span className="flex items-center gap-2">
      <Icon size={16} className={bg.replace("bg-", "text-")} aria-hidden />
      <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${bg} ${text}`}>{camelot}</span>
    </span>
  );
}
