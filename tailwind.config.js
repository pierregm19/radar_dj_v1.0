/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Colores del semaforo de compatibilidad (rueda Camelot).
        // No usar directamente para texto ni fondo a la vez: mantener
        // buen contraste (ver /src/components/CompatBadge.tsx).
        compat: {
          match: "#1D9E75",   // compatible
          bpm: "#BA7517",     // solo bpm similar
          none: "#E24B4A",    // no combina
        },
      },
    },
  },
  plugins: [],
};
