import { Command } from "@tauri-apps/plugin-shell";

// Puente hacia python-engine/main.py, empaquetado como sidecar.
// Cada linea de stdout es un JSON independiente: {"type": "progress"|"result"|"error", ...}

export interface Track {
  path: string;
  drive: string;
  title: string;
  artist: string;
  bpm: number;
  camelot: string | null;
  duration: number;
}

export interface Suggestion extends Omit<Track, "drive" | "duration"> {
  level: "match" | "bpm" | "none";
  reason: string;
}

export interface ScanProgress {
  current: number;
  total: number;
  filename: string;
}

export interface DuplicateTrack {
  path: string;
  drive: string;
  filename: string;
  format: string;
  duration: number;
  size: number;
}

export interface DuplicateGroup {
  title: string;
  artist: string;
  similarity: "identico" | "similar";
  tracks: DuplicateTrack[];
}

export interface HistorySetTrack {
  title: string;
  artist: string;
  bpm: number;
  played_at: string;
}

export interface HistorySet {
  id: number;
  venue: string;
  started_at: string;
  ended_at: string | null;
  tracks: HistorySetTrack[];
}

// Ruta fija de la base local. En un paso posterior esto se resuelve
// con appDataDir() de @tauri-apps/api en vez de dejarlo fijo aqui.
const DB_PATH = "radar_dj-library.db";

async function runEngine<T>(
  command: string,
  params: Record<string, unknown>,
  onProgress?: (p: ScanProgress) => void
): Promise<T> {
  const cmd = Command.sidecar("radar_dj-engine", [command, JSON.stringify(params)]);

  return new Promise((resolve, reject) => {
    cmd.stdout.on("data", (line: string) => {
      if (!line.trim()) return;
      const msg = JSON.parse(line);
      if (msg.type === "progress" && onProgress) {
        onProgress(msg as ScanProgress);
      } else if (msg.type === "result") {
        resolve(msg.data as T);
      } else if (msg.type === "error") {
        reject(new Error(msg.message));
      }
    });
    cmd.on("error", (err) => reject(err));
    cmd.spawn().catch(reject);
  });
}

export function scanFolder(folderPath: string, driveLabel: string, onProgress?: (p: ScanProgress) => void) {
  return runEngine<{ processed: number }>(
    "scan_folder",
    { folder_path: folderPath, drive_label: driveLabel, db_path: DB_PATH },
    onProgress
  );
}

export function getLibrary(drive?: string) {
  return runEngine<{ tracks: Track[] }>("get_library", { db_path: DB_PATH, drive: drive ?? null });
}

export function searchLibrary(query: string) {
  return runEngine<{ tracks: Track[] }>("search", { db_path: DB_PATH, query });
}

export function suggestionsFor(trackPath: string) {
  return runEngine<{ suggestions: Suggestion[] }>("suggestions_for", {
    db_path: DB_PATH,
    track_path: trackPath,
  });
}

export function listDuplicates() {
  return runEngine<{ groups: DuplicateGroup[] }>("list_duplicates", { db_path: DB_PATH });
}

export function removeTracks(paths: string[]) {
  return runEngine<{ removed: string[] }>("remove_tracks", { db_path: DB_PATH, paths });
}

export function startSet(venue: string) {
  return runEngine<{ set_id: number }>("start_set", { db_path: DB_PATH, venue });
}

export function endSet(setId: number) {
  return runEngine<{ ok: boolean }>("end_set", { db_path: DB_PATH, set_id: setId });
}

export function logPlayed(setId: number, trackPath: string) {
  return runEngine<{ ok: boolean }>("log_played", { db_path: DB_PATH, set_id: setId, track_path: trackPath });
}

export function getHistory() {
  return runEngine<{ sets: HistorySet[] }>("get_history", { db_path: DB_PATH });
}

export interface NowPlaying {
  track: Omit<Track, "drive" | "duration">;
  suggestions: Suggestion[];
}

// A diferencia de las funciones de arriba, esto no resuelve una vez:
// queda corriendo hasta que se llame child.kill(). Se usa desde
// AhoraSonandoView, que lo apaga al desmontarse (cambiar de sección
// o cerrar la app).
export async function startRekordboxListener(
  onUpdate: (data: NowPlaying) => void,
  onStatus?: (message: string) => void,
  onError?: (message: string) => void
) {
  const cmd = Command.sidecar("radar_dj-engine", [
    "listen_rekordbox",
    JSON.stringify({ db_path: DB_PATH }),
  ]);

  cmd.stdout.on("data", (line: string) => {
    if (!line.trim()) return;
    const msg = JSON.parse(line);
    if (msg.type === "now_playing") onUpdate(msg.data as NowPlaying);
    else if (msg.type === "status" && onStatus) onStatus(msg.data.message);
    else if (msg.type === "error" && onError) onError(msg.message);
  });

  return cmd.spawn(); // Child: llamar .kill() para detenerlo
}
