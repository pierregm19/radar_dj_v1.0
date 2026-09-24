import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { startRekordboxListener } from "./engine";
import type { NowPlaying } from "./engine";

interface RekordboxContextValue {
  nowPlaying: NowPlaying | null;
  status: string;
  error: string | null;
  start: () => void;
}

const RekordboxContext = createContext<RekordboxContextValue | null>(null);

export function RekordboxProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [status, setStatus] = useState("Conectando con Rekordbox...");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Vive aqui (no dentro de AhoraSonandoView) para que la conexion no
  // se corte al cambiar de pestaña. Solo se detiene cuando se cierra
  // la app entera, no antes.
  const start = useCallback(() => {
    if (startedRef.current) return; // ya esta corriendo, no duplicar
    startedRef.current = true;
    startRekordboxListener(
      (data) => {
        setNowPlaying(data);
        setError(null);
      },
      (msg) => setStatus(msg),
      (msg) => setError(msg)
    );
  }, []);

  return (
    <RekordboxContext.Provider value={{ nowPlaying, status, error, start }}>
      {children}
    </RekordboxContext.Provider>
  );
}

export function useRekordbox() {
  const ctx = useContext(RekordboxContext);
  if (!ctx) throw new Error("useRekordbox debe usarse dentro de RekordboxProvider");
  return ctx;
}
