import { useEffect, useState } from "react";
import { ChevronDown, Play, Square } from "lucide-react";
import { getHistory } from "../lib/engine";
import type { HistorySet } from "../lib/engine";
import { useActiveSet } from "../lib/activeSet";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "short" });
}

function formatTrackCount(tracks: HistorySet["tracks"]) {
  return `${tracks.length} track${tracks.length === 1 ? "" : "s"}`;
}

export default function HistorialView() {
  const [sets, setSets] = useState<HistorySet[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [venueInput, setVenueInput] = useState("");
  const { activeSet, start, end } = useActiveSet();

  async function load() {
    const { sets } = await getHistory();
    setSets(sets);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEnd() {
    await end();
    load();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="font-medium">Historial de sets</p>
        <span className="text-xs text-white/50">{sets.length} sets registrados</span>
      </div>

      <div className="border border-white/10 rounded-xl p-3 mb-5">
        {!activeSet ? (
          <div className="flex items-center gap-2">
            <input
              value={venueInput}
              onChange={(e) => setVenueInput(e.target.value)}
              placeholder="Nombre del lugar (ej. Club Barranco)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30 border-b border-white/10 pb-1"
            />
            <button
              onClick={() => venueInput.trim() && start(venueInput.trim())}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
            >
              <Play size={14} aria-hidden />
              Iniciar set
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm">
              Set en curso: <span className="font-medium">{activeSet.venue}</span>
            </p>
            <button
              onClick={handleEnd}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30"
            >
              <Square size={14} aria-hidden />
              Terminar set
            </button>
          </div>
        )}
        {activeSet && (
          <p className="text-xs text-white/40 mt-2">
            Cada canción que arrastres a Rekordbox desde Biblioteca se va a registrar aquí sola.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sets.map((s) => (
          <div key={s.id} className="border border-white/10 rounded-xl p-3">
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-medium">{s.venue}</p>
                <p className="text-xs text-white/50 mt-0.5">
                  {formatDate(s.started_at)} · {formatTrackCount(s.tracks)}
                </p>
              </div>
              <ChevronDown
                size={16}
                className={`text-white/40 transition-transform ${expanded === s.id ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {expanded === s.id && (
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1.5">
                {s.tracks.length === 0 && (
                  <p className="text-xs text-white/30">Sin canciones registradas en este set.</p>
                )}
                {s.tracks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span>
                      {i + 1}. {t.title} · {t.artist}
                    </span>
                    <span className="text-white/40">{Math.round(t.bpm)} bpm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sets.length === 0 && (
          <p className="text-sm text-white/40 text-center py-8">
            Todavía no hay sets registrados. Inicia uno arriba.
          </p>
        )}
      </div>
    </div>
  );
}
