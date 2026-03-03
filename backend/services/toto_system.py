from itertools import combinations
from math import comb

# Number of 6-combination combos for each system bet size
SYSTEM_COUNTS = {7: 7, 8: 28, 9: 84, 10: 210, 11: 462, 12: 924}


def expand_system_bet(numbers: list[str], system_n: int) -> list[tuple[str, ...]]:
    """
    Return all C(system_n, 6) six-number combinations from the given numbers.

    Example:
        expand_system_bet(["1","2","3","4","5","6","7"], 7)
        → 7 tuples of 6 numbers each
    """
    return list(combinations(numbers, 6))


def get_system_n(bet_type: str) -> int | None:
    """
    Parse 'System7' → 7, 'System12' → 12.
    Returns None for 'Standard' or unrecognised values.
    """
    if bet_type and bet_type.lower().startswith("system"):
        try:
            n = int(bet_type[6:])
            if n in SYSTEM_COUNTS:
                return n
        except ValueError:
            pass
    return None


def expected_combo_count(system_n: int) -> int:
    """Return the expected number of combinations for a given system size."""
    return comb(system_n, 6)
