import { GripVertical } from "lucide-react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type { Track, Suggestion } from "../lib/engine";
import { useActiveSet } from "../lib/activeSet";
import CompatBadge from "./CompatBadge";

interface Props {
  track: Track;
  isReference: boolean;
  level?: Suggestion["level"];
  onSelectAsReference: () => void;
}

export default function TrackRow({ track, isReference, level, onSelectAsReference }: Props) {
  const { logPlayed } = useActiveSet();

  // Arrastre nativo del sistema operativo: esto es lo que hace que
  // soltar la fila sobre la ventana de Rekordbox funcione, porque
  // Rekordbox recibe una ruta de archivo real, no un elemento de una
  // pagina web. icon vacio por simplicidad (usa el del sistema);
  // resolver un icono propio via resolveResource fallaba en silencio.
  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      startDrag({ item: [track.path], icon: "" });
      logPlayed(track.path);
    } catch (err) {
      console.error("Error al iniciar el arrastre:", err);
    }
  };

  return (
    <div
      onClick={onSelectAsReference}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer ${
        isReference ? "bg-white/10 ring-1 ring-white/30" : "hover:bg-white/5"
      }`}
    >
      <div draggable onDragStart={handleDragStart} className="cursor-grab active:cursor-grabbing">
        <GripVertical size={16} className="text-white/30" aria-hidden />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{track.title}</p>
        <p className="text-xs text-white/50 truncate">
          {track.artist} · {Math.round(track.bpm)} bpm · {track.drive}
        </p>
      </div>

      <CompatBadge camelot={track.camelot} level={isReference ? undefined : level} />
    </div>
  );
}
