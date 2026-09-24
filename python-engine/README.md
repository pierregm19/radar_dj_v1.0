# Motor de análisis (Python)

Este motor calcula BPM, tonalidad y código Camelot de cada canción, y
mantiene la base SQLite local. Se empaqueta como un ejecutable
independiente para que el usuario final no necesite Python instalado.

## Empaquetar como ejecutable independiente

```
pip install -r requirements.txt
pyinstaller --onefile --name radar_dj-engine main.py
```

Esto genera `dist/radar_dj-engine.exe`.

## Ubicarlo como sidecar (importante)

Tauri exige que el binario del sidecar lleve el "target triple" de la
plataforma en el nombre. Hay que renombrarlo y moverlo a
`src-tauri/binaries/`:

```
# en Windows x64:
copy dist\radar_dj-engine.exe ..\src-tauri\binaries\radar_dj-engine-x86_64-pc-windows-msvc.exe
```

Esto coincide con lo declarado en `tauri.conf.json` (`bundle.externalBin`)
y en `capabilities/default.json` (el permiso que le da acceso a
ejecutarlo). Sin este paso, `npm run tauri dev` no va a encontrar el
sidecar.

## Protocolo (main.py)

Se invoca como `radar_dj-engine <comando> <json_parametros>` y
devuelve una o varias líneas JSON por stdout (una por progreso, una
final de resultado). Ver `main.py` para el detalle de cada comando:
`scan_folder`, `get_library`, `search`, `suggestions_for`.

## Siguiente paso

Conectar `src/lib/engine.ts` (ya creado) a la pantalla de Biblioteca
real, reemplazando el placeholder de `App.tsx`.
