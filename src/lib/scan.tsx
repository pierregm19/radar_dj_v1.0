import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { scanFolder } from "./engine";
import type { ScanProgress } from "./engine";

interface ScanContextValue {
  scanning: ScanProgress | null;
  scanError: string | null;
  libraryVersion: number; // sube cada vez que hay datos nuevos para refrescar
  addFolder: (folderPath: string, driveLabel: string) => Promise<void>;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scanning, setScanning] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const refreshTimer = useRef<number | null>(null);

  // Vive aqui (no dentro de BibliotecaView) para que el progreso no se
  // pierda si el usuario cambia de pestaña mientras escanea.
  const addFolder = useCallback(async (folderPath: string, driveLabel: string) => {
    setScanning({ current: 0, total: 0, filename: "" });
    setScanError(null);

    // Refresca la biblioteca cada pocos segundos mientras dura el
    // escaneo, para ver las canciones ya analizadas sin esperar al final.
    refreshTimer.current = window.setInterval(() => {
      setLibraryVersion((v) => v + 1);
    }, 4000);

    try {
      await scanFolder(folderPath, driveLabel, (p) => setScanning(p));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      if (refreshTimer.current) window.clearInterval(refreshTimer.current);
      setScanning(null);
      setLibraryVersion((v) => v + 1);
    }
  }, []);

  return (
    <ScanContext.Provider value={{ scanning, scanError, libraryVersion, addFolder }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan debe usarse dentro de ScanProvider");
  return ctx;
}
