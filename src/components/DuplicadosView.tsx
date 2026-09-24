import { useEffect, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";
import { listDuplicates, removeTracks } from "../lib/engine";
import type { DuplicateGroup } from "../lib/engine";

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DuplicadosView() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [keepChoice, setKeepChoice] = useState<Record<string, string>>({}); // titulo+artista -> path a conservar
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { groups } = await listDuplicates();
    setGroups(groups);
    // por defecto se sugiere conservar el archivo mas grande (viene primero, ver duplicates.py)
    const defaults: Record<string, string> = {};
    for (const g of groups) defaults[g.title + g.artist] = g.tracks[0].path;
    setKeepChoice(defaults);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDeleteGroup(group: DuplicateGroup) {
    const keepPath = keepChoice[group.title + group.artist];
    const toDelete = group.tracks.filter((t) => t.path !== keepPath).map((t) => t.path);
    if (toDelete.length === 0) return;

    const confirmed = await ask(
      `Se van a borrar ${toDelete.length} archivo(s) de "${group.title}" de forma permanente. ¿Continuar?`,
      { title: "Confirmar eliminación", kind: "warning" }
    );
    if (!confirmed) return;

    await removeTracks(toDelete);
    load();
  }

  function allPendingDeletions(): string[] {
    const paths: string[] = [];
    for (const g of groups) {
      const keepPath = keepChoice[g.title + g.artist];
      for (const t of g.tracks) {
        if (t.path !== keepPath) paths.push(t.path);
      }
    }
    return paths;
  }

  async function handleDeleteAll() {
    const toDelete = allPendingDeletions();
    if (toDelete.length === 0) return;

    const confirmed = await ask(
      `Se van a borrar ${toDelete.length} archivo(s) de ${groups.length} grupo(s) de forma permanente, respetando lo que marcaste como "conservar" en cada uno. ¿Continuar?`,
      { title: "Confirmar eliminación masiva", kind: "warning" }
    );
    if (!confirmed) return;

    await removeTracks(toDelete);
    load();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="font-medium">Duplicados</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">{groups.length} grupos encontrados</span>
          <button onClick={load} className="text-white/50 hover:text-white/80">
            <RefreshCw size={15} aria-hidden />
          </button>
        </div>
      </div>

      {!loading && groups.length > 0 && (
        <button
          onClick={handleDeleteAll}
          className="flex items-center gap-2 mb-4 text-sm px-3 py-2 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30"
        >
          <Trash2 size={15} aria-hidden />
          Eliminar todos los duplicados ({allPendingDeletions().length} archivos)
        </button>
      )}

      {loading && <p className="text-sm text-white/40 text-center py-8">Buscando duplicados...</p>}

      {!loading && groups.length === 0 && (
        <p className="text-sm text-white/40 text-center py-8">No se encontraron duplicados.</p>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const key = g.title + g.artist;
          return (
            <div key={key} className="border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{g.title}</p>
                <span
                  className={`text-xs px-2 py-1 rounded-md ${
                    g.similarity === "identico" ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
                  }`}
                >
                  {g.similarity === "identico" ? "archivo idéntico" : "mismo título y artista"}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {g.tracks.map((t) => (
                  <label
                    key={t.path}
                    className="flex items-center gap-3 py-1.5 border-t border-white/5 first:border-t-0 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={key}
                      checked={keepChoice[key] === t.path}
                      onChange={() => setKeepChoice((prev) => ({ ...prev, [key]: t.path }))}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{t.filename}</p>
                      <p className="text-xs text-white/50">
                        {t.drive} · {t.format} · {formatSize(t.size)}
                      </p>
                    </div>
                    <span className="text-xs text-white/40">
                      {keepChoice[key] === t.path ? "conservar" : "eliminar"}
                    </span>
                  </label>
                ))}
              </div>

              <button
                onClick={() => handleDeleteGroup(g)}
                className="flex items-center gap-2 mt-3 text-xs px-3 py-1.5 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30"
              >
                <Trash2 size={14} aria-hidden />
                Eliminar no seleccionados
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
