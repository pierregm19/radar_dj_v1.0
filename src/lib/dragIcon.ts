import { resolveResource } from "@tauri-apps/api/path";

// El icono va empaquetado con la app (ver tauri.conf.json -> bundle.resources).
// Se resuelve una sola vez y se guarda en cache porque no cambia en toda la sesion.
let cached: string | null = null;

export async function getDragIconPath(): Promise<string> {
  if (!cached) {
    cached = await resolveResource("icons/headphones-drag.png");
  }
  return cached;
}
