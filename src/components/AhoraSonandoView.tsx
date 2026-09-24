import { useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { useRekordbox } from "../lib/rekordbox";
import { useActiveSet } from "../lib/activeSet";
import CompatBadge from "./CompatBadge";

export default function AhoraSonandoView() {
  const { nowPlaying, status, error, start } = useRekordbox();
  const { activeSet, logPlayed } = useActiveSet();
  const lastLoggedPath = useRef<string | null>(null);

  // start() no hace nada si ya estaba corriendo (ver rekordbox.tsx),
  // asi que es seguro llamarlo cada vez que se entra a esta pantalla.
  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!nowPlaying) return;
    if (activeSet && nowPlaying.track.path !== lastLoggedPath.current) {
      lastLoggedPath.current = nowPlaying.track.path;
      logPlayed(nowPlaying.track.path);
    }
  }, [nowPlaying, activeSet, logPlayed]);

  function handleDragStart(e: React.DragEvent, path: string) {
    e.preventDefault();
    try {
      startDrag({ item: [path], icon: "" });
    } catch (err) {
      console.error("Error al iniciar el arrastre:", err);
    }
  }

  if (error) {
    const isPortBusy = error.includes("10048") || error.toLowerCase().includes("already in use");
    return (
      <div className="max-w-2xl mx-auto text-sm text-white/60">
        <p className="text-red-400 mb-2">No se pudo conectar con Rekordbox.</p>
        <p>{error}</p>
        {isPortBusy ? (
          <p className="mt-3 text-white/40">
            El puerto ya está en uso — probablemente quedó un proceso anterior sin cerrar. Cierra
            Radar_DJ por completo (revisa el Administrador de tareas por si quedó algo abierto) y
            vuelve a abrirlo.
          </p>
        ) : (
          <p className="mt-3 text-white/40">
            Revisa que rkbx_link esté corriendo con el módulo OSC activado, y que el puerto
            coincida con el configurado en el motor.
          </p>
        )}
      </div>
    );
  }

  if (!nowPlaying) {
    return <p className="text-sm text-white/40 text-center py-8">{status}</p>;
  }

  const { track, suggestions } = nowPlaying;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/50">Sonando ahora</p>
        {activeSet && <span className="text-xs text-white/40">Set: {activeSet.venue}</span>}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-base font-medium">{track.title}</p>
          <p className="text-sm text-white/50">
            {track.artist} · {Math.round(track.bpm)} bpm
          </p>
        </div>
        <span className="text-sm font-medium px-3 py-1.5 rounded-md bg-white text-black">
          {track.camelot}
        </span>
      </div>

      <p className="text-xs text-white/40 mb-2">Siguiente sugerido</p>
      <div className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <div key={s.path} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/5">
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, s.path)}
              className="cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={16} className="text-white/30" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{s.title}</p>
              <p className="text-xs text-white/50 truncate">
                {s.artist} · {Math.round(s.bpm)} bpm
              </p>
            </div>
            <CompatBadge camelot={s.camelot} level={s.level} />
          </div>
        ))}
        {suggestions.length === 0 && (
          <p className="text-xs text-white/30 text-center py-4">
            No hay suficientes canciones indexadas para sugerir.
          </p>
        )}
      </div>
    </div>
  );
}
