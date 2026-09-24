"""
Punto de entrada del motor, empaquetado como sidecar (radar_dj-engine.exe).

Se invoca como: radar_dj-engine <comando> <json_de_parametros>
Cada linea que imprime a stdout es un JSON independiente, para que
Tauri pueda leerlas conforme llegan (streaming de progreso durante
un barrido, en vez de esperar a que termine todo).

Comandos soportados:
  scan_folder     {"folder_path": "...", "drive_label": "Disco D", "db_path": "..."}
  get_library     {"db_path": "...", "drive": null}
  search          {"db_path": "...", "query": "bad bunny"}
  suggestions_for {"db_path": "...", "track_path": "..."}
"""

import sys
import os
import json
import sqlite3
from datetime import datetime

# En Windows, la salida del programa a veces usa una codificación vieja
# (no UTF-8) por defecto, lo que rompe con tildes, ñ, o simbolos raros
# en nombres de canciones. Forzamos UTF-8 explicitamente para evitar eso.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from scanner import scan_folder, init_db
from camelot import evaluate_compatibility
from duplicates import find_duplicates
from rekordbox_listener import listen_rekordbox


def _emit(payload: dict) -> None:
    """Imprime una linea JSON y vacia el buffer para que Tauri la reciba ya."""
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def _run_scan_folder(params: dict) -> None:
    def on_progress(current: int, total: int, filename: str) -> None:
        _emit({"type": "progress", "current": current, "total": total, "filename": filename})

    processed = scan_folder(
        folder_path=params["folder_path"],
        drive_label=params["drive_label"],
        db_path=params["db_path"],
        on_progress=on_progress,
    )
    _emit({"type": "result", "data": {"processed": processed}})


def _run_get_library(params: dict) -> None:
    conn = init_db(params["db_path"])
    if params.get("drive"):
        rows = conn.execute(
            "SELECT path, drive, title, artist, bpm, camelot, duration FROM tracks WHERE drive = ? ORDER BY title",
            (params["drive"],),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT path, drive, title, artist, bpm, camelot, duration FROM tracks ORDER BY title"
        ).fetchall()
    conn.close()

    tracks = [
        {"path": r[0], "drive": r[1], "title": r[2], "artist": r[3], "bpm": r[4], "camelot": r[5], "duration": r[6]}
        for r in rows
    ]
    _emit({"type": "result", "data": {"tracks": tracks}})


def _run_search(params: dict) -> None:
    conn = init_db(params["db_path"])
    query = f"%{params['query'].lower()}%"
    rows = conn.execute(
        """
        SELECT path, drive, title, artist, bpm, camelot, duration FROM tracks
        WHERE lower(title) LIKE ? OR lower(artist) LIKE ?
        ORDER BY title
        """,
        (query, query),
    ).fetchall()
    conn.close()

    tracks = [
        {"path": r[0], "drive": r[1], "title": r[2], "artist": r[3], "bpm": r[4], "camelot": r[5], "duration": r[6]}
        for r in rows
    ]
    _emit({"type": "result", "data": {"tracks": tracks}})


def _run_suggestions_for(params: dict) -> None:
    conn = init_db(params["db_path"])
    ref = conn.execute(
        "SELECT bpm, camelot FROM tracks WHERE path = ?", (params["track_path"],)
    ).fetchone()
    if ref is None:
        conn.close()
        _emit({"type": "error", "message": "track no encontrado en la biblioteca"})
        return

    ref_bpm, ref_camelot = ref
    rows = conn.execute(
        "SELECT path, title, artist, bpm, camelot FROM tracks WHERE path != ? AND camelot IS NOT NULL",
        (params["track_path"],),
    ).fetchall()
    conn.close()

    suggestions = []
    for path, title, artist, bpm, camelot in rows:
        result = evaluate_compatibility(ref_camelot, ref_bpm, camelot, bpm)
        suggestions.append(
            {
                "path": path, "title": title, "artist": artist, "bpm": bpm,
                "camelot": camelot, "level": result.level, "reason": result.reason,
            }
        )

    # verde primero, luego ambar, el resto al final
    order = {"match": 0, "bpm": 1, "none": 2}
    suggestions.sort(key=lambda s: order[s["level"]])
    _emit({"type": "result", "data": {"suggestions": suggestions}})


def _run_list_duplicates(params: dict) -> None:
    groups = find_duplicates(params["db_path"])
    _emit({"type": "result", "data": {"groups": groups}})


def _run_remove_tracks(params: dict) -> None:
    """Borra el archivo del disco y su fila en la base. El frontend confirma antes de llamar esto."""
    conn = init_db(params["db_path"])
    removed = []
    for path in params["paths"]:
        try:
            os.remove(path)
            conn.execute("DELETE FROM tracks WHERE path = ?", (path,))
            removed.append(path)
        except OSError as exc:
            _emit({"type": "error", "message": f"no se pudo borrar {path}: {exc}"})
    conn.commit()
    conn.close()
    _emit({"type": "result", "data": {"removed": removed}})


def _run_start_set(params: dict) -> None:
    conn = init_db(params["db_path"])
    cur = conn.execute(
        "INSERT INTO sets (venue, started_at, ended_at) VALUES (?, ?, NULL)",
        (params["venue"], datetime.now().isoformat()),
    )
    conn.commit()
    set_id = cur.lastrowid
    conn.close()
    _emit({"type": "result", "data": {"set_id": set_id}})


def _run_end_set(params: dict) -> None:
    conn = init_db(params["db_path"])
    conn.execute(
        "UPDATE sets SET ended_at = ? WHERE id = ?",
        (datetime.now().isoformat(), params["set_id"]),
    )
    conn.commit()
    conn.close()
    _emit({"type": "result", "data": {"ok": True}})


def _run_log_played(params: dict) -> None:
    conn = init_db(params["db_path"])
    conn.execute(
        "INSERT INTO set_tracks (set_id, track_path, played_at) VALUES (?, ?, ?)",
        (params["set_id"], params["track_path"], datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()
    _emit({"type": "result", "data": {"ok": True}})


def _run_get_history(params: dict) -> None:
    conn = init_db(params["db_path"])
    sets_rows = conn.execute(
        "SELECT id, venue, started_at, ended_at FROM sets ORDER BY started_at DESC"
    ).fetchall()

    sets = []
    for set_id, venue, started_at, ended_at in sets_rows:
        track_rows = conn.execute(
            """
            SELECT t.title, t.artist, t.bpm, st.played_at
            FROM set_tracks st JOIN tracks t ON t.path = st.track_path
            WHERE st.set_id = ?
            ORDER BY st.played_at ASC
            """,
            (set_id,),
        ).fetchall()
        sets.append(
            {
                "id": set_id,
                "venue": venue,
                "started_at": started_at,
                "ended_at": ended_at,
                "tracks": [
                    {"title": t, "artist": a, "bpm": b, "played_at": p}
                    for t, a, b, p in track_rows
                ],
            }
        )
    conn.close()
    _emit({"type": "result", "data": {"sets": sets}})


def _run_listen_rekordbox(params: dict) -> None:
    listen_rekordbox(params["db_path"], _emit)


COMMANDS = {
    "scan_folder": _run_scan_folder,
    "get_library": _run_get_library,
    "search": _run_search,
    "suggestions_for": _run_suggestions_for,
    "list_duplicates": _run_list_duplicates,
    "remove_tracks": _run_remove_tracks,
    "start_set": _run_start_set,
    "end_set": _run_end_set,
    "log_played": _run_log_played,
    "get_history": _run_get_history,
    "listen_rekordbox": _run_listen_rekordbox,
}


def main() -> None:
    if len(sys.argv) < 3:
        _emit({"type": "error", "message": "uso: radar_dj-engine <comando> <json_parametros>"})
        sys.exit(1)

    command, raw_params = sys.argv[1], sys.argv[2]
    handler = COMMANDS.get(command)
    if handler is None:
        _emit({"type": "error", "message": f"comando desconocido: {command}"})
        sys.exit(1)

    try:
        params = json.loads(raw_params)
        handler(params)
    except Exception as exc:
        _emit({"type": "error", "message": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    main()
