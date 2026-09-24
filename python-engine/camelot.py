"""
Conversion de tonalidad musical a codigo Camelot, y logica de
compatibilidad armonica (el "semaforo": compatible / solo bpm / no combina).
"""

from dataclasses import dataclass

# Mapeo tonalidad -> codigo Camelot. Cubre nombres con sostenidos (#)
# y sus equivalentes enarmonicos con bemoles (b), que es como suelen
# salir los nombres de librosa/essentia.
KEY_TO_CAMELOT = {
    "G# minor": "1A", "Ab minor": "1A", "B major": "1B",
    "D# minor": "2A", "Eb minor": "2A", "F# major": "2B", "Gb major": "2B",
    "A# minor": "3A", "Bb minor": "3A", "C# major": "3B", "Db major": "3B",
    "F minor": "4A", "Ab major": "4B",
    "C minor": "5A", "Eb major": "5B",
    "G minor": "6A", "Bb major": "6B",
    "D minor": "7A", "F major": "7B",
    "A minor": "8A", "C major": "8B",
    "E minor": "9A", "G major": "9B",
    "B minor": "10A", "D major": "10B",
    "F# minor": "11A", "Gb minor": "11A", "A major": "11B",
    "C# minor": "12A", "Db minor": "12A", "E major": "12B",
}


def key_to_camelot(key_name: str) -> str | None:
    """Convierte 'A minor' / 'C major' etc a codigo Camelot ('8A', '8B')."""
    return KEY_TO_CAMELOT.get(key_name.strip())


@dataclass
class CompatResult:
    level: str        # "match" | "bpm" | "none"
    reason: str        # explicacion corta para mostrar en la UI


def _camelot_parts(code: str) -> tuple[int, str]:
    number = int(code[:-1])
    letter = code[-1]
    return number, letter


def camelot_compatible(code_a: str, code_b: str) -> bool:
    """True si dos codigos Camelot mezclan bien armonicamente."""
    if code_a == code_b:
        return True
    num_a, let_a = _camelot_parts(code_a)
    num_b, let_b = _camelot_parts(code_b)
    if num_a == num_b and let_a != let_b:
        return True  # relativa mayor/menor
    if let_a == let_b and abs(num_a - num_b) in (1, 11):  # 11 = vuelta de la rueda (12 <-> 1)
        return True
    return False


def bpm_compatible(bpm_a: float, bpm_b: float, tolerance_pct: float = 6.0) -> bool:
    """True si el BPM de ambas canciones es lo bastante cercano para mezclar."""
    if bpm_a <= 0 or bpm_b <= 0:
        return False
    diff_pct = abs(bpm_a - bpm_b) / bpm_a * 100
    return diff_pct <= tolerance_pct


def evaluate_compatibility(
    camelot_a: str, bpm_a: float, camelot_b: str, bpm_b: float
) -> CompatResult:
    """Aplica el semaforo: verde (Camelot compatible), ambar (solo BPM), rojo (ninguno)."""
    camelot_ok = camelot_compatible(camelot_a, camelot_b)
    bpm_ok = bpm_compatible(bpm_a, bpm_b)

    if camelot_ok:
        return CompatResult(level="match", reason=f"{camelot_a} y {camelot_b} son compatibles")
    if bpm_ok:
        return CompatResult(level="bpm", reason="BPM similar, pero la tonalidad no combina")
    return CompatResult(level="none", reason="ni la tonalidad ni el BPM combinan")
