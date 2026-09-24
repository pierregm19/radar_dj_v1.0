import { useState } from "react";
import BibliotecaView from "./components/BibliotecaView";
import DuplicadosView from "./components/DuplicadosView";
import HistorialView from "./components/HistorialView";
import AhoraSonandoView from "./components/AhoraSonandoView";
import { ActiveSetProvider } from "./lib/activeSet";
import { ScanProvider } from "./lib/scan";
import { RekordboxProvider } from "./lib/rekordbox";

// Las 4 secciones definidas en el diseño: Biblioteca, Ahora sonando,
// Historial y Duplicados. Cada una se implementa en su propio archivo
// dentro de src/components/ a medida que avancemos.
type Section = "biblioteca" | "ahora-sonando" | "historial" | "duplicados";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "biblioteca", label: "Biblioteca" },
  { id: "ahora-sonando", label: "Ahora sonando" },
  { id: "historial", label: "Historial" },
  { id: "duplicados", label: "Duplicados" },
];

export default function App() {
  const [active, setActive] = useState<Section>("biblioteca");

  return (
    <ActiveSetProvider>
      <ScanProvider>
        <RekordboxProvider>
          <div className="h-screen flex flex-col">
            <nav className="flex gap-1 p-2 border-b border-white/10">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    active === s.id
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <main className="flex-1 overflow-y-auto p-4">
              {active === "biblioteca" && <BibliotecaView />}
              {active === "duplicados" && <DuplicadosView />}
              {active === "historial" && <HistorialView />}
              {active === "ahora-sonando" && <AhoraSonandoView />}
            </main>
          </div>
        </RekordboxProvider>
      </ScanProvider>
    </ActiveSetProvider>
  );
}
