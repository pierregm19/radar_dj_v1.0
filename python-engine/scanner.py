"""
Barrido e indexado de la biblioteca musical.

Recorre las carpetas que el usuario elige (Disco D, discos externos),
lee tags (mutagen), calcula BPM y tonalidad (librosa) y guarda todo en
una base SQLite local. En cada corrida posterior, solo reprocesa los
archivos nuevos o modificados (comparando ruta + tamaño + fecha de
modificacion), para que el reescaneo sea rapido.
"""

import os
import sys
import sqlite3
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
import numpy as np
import librosa
from mutagen import File as MutagenFile

from camelot import key_to_camelot

AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".aiff", ".aif", ".m4a"}

# Perfiles tonales de Krumhansl-Schmuckler para estimar la tonalidad
# a partir del croma promedio del audio.
_MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
_MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)
_PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tracks (
            path TEXT PRIMARY KEY,
            drive TEXT,
            title TEXT,
            artist TEXT,
            bpm REAL,
            key_name TEXT,
            camelot TEXT,
            duration REAL,
            mtime REAL,
            size INTEGER
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue TEXT,
            started_at TEXT,
            ended_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS set_tracks (
            set_id INTEGER,
            track_path TEXT,
            played_at TEXT,
            FOREIGN KEY (set_id) REFERENCES sets(id)
        )
        """
    )
    conn.commit()
    return conn


def _needs_reindex(conn: sqlite3.Connection, path: str, mtime: float, size: int) -> bool:
    row = conn.execute(
        "SELECT mtime, size, camelot FROM tracks WHERE path = ?", (path,)
    ).fetchone()
    if row is None:
        return True
    stored_mtime, stored_size, stored_camelot = row
    if stored_camelot is None:
        return True  # el intento anterior fallo o se corto: reintentar
    return stored_mtime != mtime or stored_size != size


def _read_tags(path: str) -> tuple[str, str]:
    """Devuelve (titulo, artista). Si no hay tags, usa el nombre de archivo."""
    try:
        audio = MutagenFile(path, easy=True)
        if audio and audio.tags:
            title = audio.tags.get("title", [None])[0]
            artist = audio.tags.get("artist", [None])[0]
            if title:
                return title, artist or "Desconocido"
    except Exception:
        pass
    return os.path.splitext(os.path.basename(path))[0], "Desconocido"


def _estimate_key(chroma_mean: np.ndarray) -> str:
    """Correlaciona el croma promedio contra los 24 perfiles (12 mayores + 12 menores)."""
    best_score = -np.inf
    best_key = "C major"
    for shift in range(12):
        major_corr = np.corrcoef(np.roll(_MAJOR_PROFILE, shift), chroma_mean)[0, 1]
        minor_corr = np.corrcoef(np.roll(_MINOR_PROFILE, shift), chroma_mean)[0, 1]
        if major_corr > best_score:
            best_score, best_key = major_corr, f"{_PITCH_NAMES[shift]} major"
        if minor_corr > best_score:
            best_score, best_key = minor_corr, f"{_PITCH_NAMES[shift]} minor"
    return best_key


def analyze_audio(path: str) -> tuple[float, str, float]:
    """Devuelve (bpm, tonalidad, duracion_segundos)."""
    y, sr = librosa.load(path, sr=22050, mono=True, duration=90)  # primeros 90s bastan
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    key_name = _estimate_key(chroma_mean)
    duration = librosa.get_duration(y=y, sr=sr)
    return float(tempo), key_name, float(duration)


def _analyze_with_timeout(path: str, timeout_sec: int = 45) -> tuple[float, str, float]:
    """
    Corre analyze_audio con un limite de tiempo. Si un archivo puntual
    esta dañado o tiene un formato raro que hace que librosa se quede
    trabado, esto evita que ESE archivo frene el barrido completo: se
    lo salta y sigue con el resto (el hilo colgado se abandona en
    segundo plano en vez de esperarlo, por eso wait=False).
    """
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(analyze_audio, path)
    try:
        result = future.result(timeout=timeout_sec)
        executor.shutdown(wait=False)
        return result
    except FutureTimeoutError:
        executor.shutdown(wait=False)
        raise TimeoutError(f"analisis tardo mas de {timeout_sec}s, se omite este archivo")


def scan_folder(folder_path: str, drive_label: str, db_path: str, on_progress=None) -> int:
    """
    Recorre folder_path recursivamente e indexa los archivos nuevos/modificados.
    on_progress(current, total, filename) se llama para reportar avance a la UI.
    Devuelve la cantidad de archivos procesados.
    """
    conn = init_db(db_path)

    audio_files = []
    for root, _, files in os.walk(folder_path):
        for fname in files:
            if os.path.splitext(fname)[1].lower() in AUDIO_EXTENSIONS:
                audio_files.append(os.path.join(root, fname))

    processed = 0
    for i, path in enumerate(audio_files):
        stat = os.stat(path)
        if not _needs_reindex(conn, path, stat.st_mtime, stat.st_size):
            continue

        title, artist = _read_tags(path)
        try:
            bpm, key_name, duration = _analyze_with_timeout(path)
            camelot = key_to_camelot(key_name)
        except Exception as exc:
            bpm, key_name, camelot, duration = 0.0, None, None, 0.0
            print(f"[analisis fallo] {os.path.basename(path)}: {exc}", file=sys.stderr, flush=True)

        conn.execute(
            """
            INSERT INTO tracks (path, drive, title, artist, bpm, key_name, camelot, duration, mtime, size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                drive=excluded.drive, title=excluded.title, artist=excluded.artist,
                bpm=excluded.bpm, key_name=excluded.key_name, camelot=excluded.camelot,
                duration=excluded.duration, mtime=excluded.mtime, size=excluded.size
            """,
            (path, drive_label, title, artist, bpm, key_name, camelot, duration, stat.st_mtime, stat.st_size),
        )
        conn.commit()
        processed += 1

        if on_progress:
            on_progress(i + 1, len(audio_files), os.path.basename(path))

    conn.close()
    return processed
