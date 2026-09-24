import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Search, FolderPlus } from "lucide-react";
import { getLibrary, searchLibrary, suggestionsFor } from "../lib/engine";
import type { Track, Suggestion } from "../lib/engine";
import { useScan } from "../lib/scan";
import TrackRow from "./TrackRow";

export default function BibliotecaView() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [referencePath, setReferencePath] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const { scanning, scanError, libraryVersion, addFolder } = useScan();

  // Se recarga cada vez que libraryVersion sube: al terminar un escaneo,
  // y tambien cada pocos segundos mientras uno esta en curso (ver scan.tsx).
  useEffect(() => {
    if (query.trim()) {
      searchLibrary(query).then((r) => setTracks(r.tracks));
    } else {
      getLibrary().then((r) => setTracks(r.tracks));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryVersion]);

  // Cuando se elige un track de referencia, se pide el semaforo de
  // compatibilidad de toda la biblioteca contra ese track.
  useEffect(() => {
    if (!referencePath) {
      setSuggestions({});
      return;
    }
    suggestionsFor(referencePath).then((r) => {
      const map: Record<string, Suggestion> = {};
      for (const s of r.suggestions) map[s.path] = s;
      setSuggestions(map);
    });
  }, [referencePath]);

  async function handleAddFolder() {
    const folder = await open({ directory: true, multiple: false });
    if (!folder || Array.isArray(folder)) return;

    // El nombre del disco se usa solo para mostrarlo en la lista;
    // se toma del ultimo segmento de la ruta elegida.
    const driveLabel = folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;
    await addFolder(folder, driveLabel);
  }

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      const all = await getLibrary();
      setTracks(all.tracks);
      return;
    }
    const result = await searchLibrary(value);
    setTracks(result.tracks);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="font-medium">Mi biblioteca</p>
        <button
          onClick={handleAddFolder}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20"
        >
          <FolderPlus size={16} aria-hidden />
          Agregar carpeta
        </button>
      </div>

      {scanError && (
        <div className="mb-4 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
          Error al escanear: {scanError}
        </div>
      )}

      {scanning && (
        <div className="mb-4 text-xs text-white/60">
          <p className="mb-1 truncate">
            Analizando {scanning.filename} ({scanning.current}/{scanning.total || "?"})
          </p>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white/60"
              style={{
                width: scanning.total ? `${(scanning.current / scanning.total) * 100}%` : "10%",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 mb-4">
        <Search size={16} className="text-white/40" aria-hidden />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por título, artista o BPM..."
          className="bg-transparent flex-1 text-sm outline-none placeholder:text-white/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        {tracks.map((t) => (
          <TrackRow
            key={t.path}
            track={t}
            isReference={t.path === referencePath}
            level={suggestions[t.path]?.level}
            onSelectAsReference={() => setReferencePath(t.path === referencePath ? null : t.path)}
          />
        ))}
        {tracks.length === 0 && !scanning && (
          <p className="text-sm text-white/40 text-center py-8">
            Todavía no hay canciones indexadas. Agrega una carpeta para empezar.
          </p>
        )}
      </div>

      {tracks.length > 0 && (
        <p className="text-xs text-white/30 mt-4 text-center">
          Haz clic en una canción para ver sus compatibles · arrastra el ícono hacia Rekordbox
        </p>
      )}
    </div>
  );
}
