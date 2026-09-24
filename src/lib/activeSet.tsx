import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { startSet as engineStartSet, endSet as engineEndSet, logPlayed as engineLogPlayed } from "./engine";

interface ActiveSet {
  id: number;
  venue: string;
}

interface ActiveSetContextValue {
  activeSet: ActiveSet | null;
  start: (venue: string) => Promise<void>;
  end: () => Promise<void>;
  logPlayed: (trackPath: string) => void;
}

const ActiveSetContext = createContext<ActiveSetContextValue | null>(null);

export function ActiveSetProvider({ children }: { children: ReactNode }) {
  const [activeSet, setActiveSet] = useState<ActiveSet | null>(null);

  const start = useCallback(async (venue: string) => {
    const { set_id } = await engineStartSet(venue);
    setActiveSet({ id: set_id, venue });
  }, []);

  const end = useCallback(async () => {
    if (!activeSet) return;
    await engineEndSet(activeSet.id);
    setActiveSet(null);
  }, [activeSet]);

  // Se llama al arrastrar una cancion. No bloquea la UI si falla:
  // registrar el historial nunca debe interrumpir el mezclado en vivo.
  const logPlayed = useCallback(
    (trackPath: string) => {
      if (!activeSet) return;
      engineLogPlayed(activeSet.id, trackPath).catch(() => {});
    },
    [activeSet]
  );

  return (
    <ActiveSetContext.Provider value={{ activeSet, start, end, logPlayed }}>
      {children}
    </ActiveSetContext.Provider>
  );
}

export function useActiveSet() {
  const ctx = useContext(ActiveSetContext);
  if (!ctx) throw new Error("useActiveSet debe usarse dentro de ActiveSetProvider");
  return ctx;
}
