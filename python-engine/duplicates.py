"""
Deteccion de duplicados.

Nota honesta sobre el metodo: esto agrupa por titulo+artista
normalizado (sin mayusculas, sin signos), no por huella digital de
audio. Es rapido y no requiere librerias externas, pero significa que
dos versiones con tags distintos (ej. typos, "feat." escrito distinto)
no se agrupan. Si mas adelante hace falta mas precision, se puede
sumar `pyacoustid`/chromaprint para comparar el audio real - lo dejo
como posible mejora futura, no incluido en esta primera version.
"""

import os
import re
import sqlite3
from collections import defaultdict

from scanner import init_db


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9 ]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def find_duplicates(db_path: str) -> list[dict]:
    conn = init_db(db_path)
    rows = conn.execute(
        "SELECT path, drive, title, artist, duration, size FROM tracks"
    ).fetchall()
    conn.close()

    groups: dict[tuple[str, str], list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        path, drive, title, artist, duration, size = row
        key = (_normalize(title), _normalize(artist))
        groups[key].append(row)

    result = []
    for (norm_title, norm_artist), items in groups.items():
        if len(items) < 2 or not norm_title:
            continue

        sizes = {r[5] for r in items}
        # Si dos archivos tienen exactamente el mismo tamano, es
        # practicamente seguro que es el mismo archivo copiado.
        # Si no, solo sabemos que comparten titulo/artista.
        similarity = "identico" if len(sizes) < len(items) else "similar"

        tracks = [
            {
                "path": r[0],
                "drive": r[1],
                "filename": os.path.basename(r[0]),
                "format": os.path.splitext(r[0])[1].lstrip(".").upper(),
                "duration": r[4],
                "size": r[5],
            }
            for r in items
        ]
        # Sugerencia de cual conservar: el archivo mas grande suele
        # ser la mejor calidad (mp3 320 vs 128, o wav vs mp3).
        tracks.sort(key=lambda t: t["size"] or 0, reverse=True)

        result.append(
            {
                "title": items[0][2],
                "artist": items[0][3],
                "similarity": similarity,
                "tracks": tracks,
            }
        )

    return result
