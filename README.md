# Radar_DJ

App de escritorio para DJs: sugerencias de mezcla armónica vía rueda
Camelot, biblioteca local indexada desde múltiples discos, y
arrastre directo de canciones hacia Rekordbox.

## Estructura

```
radar_dj/
├── src/                  # Frontend React (interfaz)
├── src-tauri/            # Backend Rust/Tauri (ventana nativa, drag-and-drop)
└── python-engine/        # Motor de análisis de audio (BPM, tonalidad, Camelot)
```

## Por qué es una app portable e independiente

- Tauri compila todo a un único `.exe` nativo con su propia ventana:
  no es una página web ni depende de un navegador instalado.
- El motor Python se empaqueta aparte con PyInstaller
  (`python-engine/README.md`) y viaja embebido dentro del ejecutable
  final como "sidecar" — el usuario no necesita instalar Python.
- Para distribución 100% portable (sin instalador), en vez de generar
  el instalador NSIS, se toma directamente el binario compilado de
  `src-tauri/target/release/radar_dj.exe` junto al sidecar y se
  comprimen en una sola carpeta/zip. Se ejecuta con doble clic, sin
  instalación.

## Cómo correr en desarrollo

```
npm install
npm run tauri dev
```

Esto abre la ventana nativa de la app con recarga en caliente del
frontend.

## Cómo generar el ejecutable final

```
npm run tauri build
```

El `.exe` queda en `src-tauri/target/release/`.

## Integración con Rekordbox (Ahora sonando)

Esta parte depende de una herramienta externa, **rkbx_link**
(https://github.com/grufkork/rkbx_link), que lee la memoria de
Rekordbox y publica lo que está sonando vía OSC. No está incluida
en este proyecto — Pierre la instala aparte.

**Antes de usarla en un set real:**
1. Instalar rkbx_link y activar `osc.enabled = true` en su configuración
2. Confirmar el puerto OSC (`osc.port` en su config) contra `OSC_PORT`
   en `python-engine/rekordbox_listener.py`
3. Tocar una canción indexada en la biblioteca y verificar que
   aparezca en la pantalla "Ahora sonando". Si no aparece nada, las
   direcciones OSC exactas (`ADDRESSES` en ese mismo archivo) pueden
   necesitar ajuste según la versión de rkbx_link — está señalado en
   un comentario al inicio del archivo.

## Estado del proyecto

Las 4 secciones (Biblioteca, Ahora sonando, Duplicados, Historial)
están construidas y conectadas al motor. Como próximo paso natural:
probar el flujo completo en tu máquina siguiendo la guía de
compilación por GitHub Actions.
