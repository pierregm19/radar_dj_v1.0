"""
Escucha en vivo lo que suena en Rekordbox, via OSC enviado por la
herramienta de terceros rkbx_link (no incluida aqui, la instala
Pierre aparte): https://github.com/grufkork/rkbx_link

AVISO IMPORTANTE - verificar antes de usar en vivo:
Las direcciones OSC en ADDRESSES de abajo son un punto de partida
razonable, pero rkbx_link permite configurar su formato de salida y
puede variar segun la version instalada. Antes de confiar en esto
durante un set real:

  1. Instalar rkbx_link y activar osc.enabled=true en su config
  2. Correr este comando y tocar una canción en Rekordbox
  3. Si no aparece nada, revisar el config de rkbx_link (osc.port y
     el formato de las direcciones) y ajustar OSC_PORT/ADDRESSES aqui
     - el resto del archivo no necesita tocarse.
"""

import re
from pythonosc import dispatcher, osc_server

from scanner import init_db
from camelot import evaluate_compatibility

OSC_PORT = 4460  # confirmado en el log de rkbx_link: "Sending ... -> 127.0.0.1:4460"

# Deck 1 por defecto: Pierre mezcla solo con Rekordbox en su laptop,
# sin CDJs fisicos. Si en el futuro usa mas decks, esto se puede
# extender a escuchar deck 1 y 2 y quedarse con el que está "on air".
ADDRESSES = {
    "title": "/deck/1/title",
    "artist": "/deck/1/artist",
    "bpm": "/deck/1/bpm",
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", text.lower().strip()))


def listen_rekordbox(db_path: str, emit) -> None:
    """
    Corre para siempre (server.serve_forever). Se invoca como proceso
    aparte (sidecar) desde Tauri, que lo mantiene vivo mientras la
    pantalla "Ahora sonando" esta abierta y lo mata al salir.
    """
    state = {"title": None, "artist": None, "bpm": None}
    last_matched_path = None

    def _handle_title_update():
        nonlocal last_matched_path
        if not state["title"]:
            return

        conn = init_db(db_path)
        norm_title = _normalize(state["title"]).replace(" ", "")
        row = conn.execute(
            "SELECT path, bpm, camelot FROM tracks WHERE replace(lower(title), ' ', '') LIKE ?",
            (f"%{norm_title}%",),
        ).fetchone()

        if row is None or row[0] == last_matched_path:
            conn.close()
            return
        last_matched_path = row[0]
        ref_path, ref_bpm, ref_camelot = row

        rows = conn.execute(
            "SELECT path, title, artist, bpm, camelot FROM tracks WHERE path != ? AND camelot IS NOT NULL",
            (ref_path,),
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
        order = {"match": 0, "bpm": 1, "none": 2}
        suggestions.sort(key=lambda s: order[s["level"]])

        emit(
            {
                "type": "now_playing",
                "data": {
                    "track": {
                        "path": ref_path,
                        "title": state["title"],
                        "artist": state["artist"] or "Desconocido",
                        "bpm": ref_bpm,
                        "camelot": ref_camelot,
                    },
                    "suggestions": suggestions[:20],
                },
            }
        )

    def _on_title(_addr, value):
        state["title"] = value
        _handle_title_update()

    def _on_artist(_addr, value):
        state["artist"] = value

    def _on_bpm(_addr, value):
        state["bpm"] = value

    disp = dispatcher.Dispatcher()
    disp.map(ADDRESSES["title"], _on_title)
    disp.map(ADDRESSES["artist"], _on_artist)
    disp.map(ADDRESSES["bpm"], _on_bpm)

    emit({"type": "status", "data": {"message": f"escuchando Rekordbox en el puerto {OSC_PORT}"}})

    # allow_reuse_address ayuda cuando quedo un proceso anterior sin
    # cerrar del todo (comun con ejecutables de PyInstaller) y el puerto
    # parece "ocupado" aunque ya no haya nadie escuchando de verdad.
    osc_server.BlockingOSCUDPServer.allow_reuse_address = True
    server = osc_server.BlockingOSCUDPServer(("127.0.0.1", OSC_PORT), disp)
    server.serve_forever()
