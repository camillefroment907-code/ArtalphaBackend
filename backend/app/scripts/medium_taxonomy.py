"""
Sprint 2.5 — Medium taxonomy for CAGR segmentation.

Defines:
- DEPT_BLOCKLIST: auction department names that pollute the medium field
- CANONICAL_GROUPS: LIKE patterns for grouping raw mediums into 5 buckets

Order of CANONICAL_GROUPS matters — first match wins. More specific patterns first.
"""

DEPT_BLOCKLIST = {
    'Contemporary Art',
    'Impressionist & Modern Art',
    'Impressionist and Modern Art',
    '19th Century European Paintings',
    'Old Master Paintings',
    'Old Masters',
    'Modern & Contemporary Art',
    'Post-War & Contemporary Art',
    'Post-War and Contemporary Art',
    'European Paintings',
    'American Art',
    'Latin American Art',
    'Asian Art',
    'African & Oceanic Art',
    'Modern British Art',
    '20th Century Art',
    '21st Century Art',
    'Modern Art',
    'Decorative Arts',
    'Photography',  # ambiguous — dept vs medium; exact-match blocked, substring allowed
}

# (group_name, list_of_substrings) — first match wins
CANONICAL_GROUPS = [
    ('prints', [
        'lithograph',
        'silkscreen',
        'screenprint',
        'screen-print',
        'etching',
        'aquatint',
        'woodcut',
        'linocut',
        'giclée',
        'giclee',
        'pochoir',
        'multiple',
        'edition',
        'serigraph',
        'print',  # broad — keep last in group
    ]),
    ('works_on_paper', [
        'watercolor',
        'watercolour',
        'gouache',
        'pastel',
        'charcoal',
        'pencil',
        'graphite',
        'ink on paper',
        'drawing',
        'works on paper',
        'paper',  # broad — keep last in group
    ]),
    ('oil_on_canvas', [
        'oil on canvas',
        'oil on board',
        'oil on panel',
        'oil on linen',
        'oil on wood',
        'oil on photograph',
        'oil on color',
        'oil',  # broad — keep last in group
    ]),
    ('sculpture', [
        'bronze',
        'marble',
        'ceramic',
        'terracotta',
        'plaster',
        'resin',
        'steel',
        'sculpture',
        'cast',
    ]),
    ('photography', [
        'chromogenic',
        'gelatin silver',
        'c-print',
        'inkjet',
        'photographic',
        'photograph',
        'diasec',
        'lambda',
    ]),
]


def is_dept_name(medium_value: str) -> bool:
    """Return True if value is an auction dept name, not a real medium."""
    if not medium_value:
        return False
    return medium_value.strip() in DEPT_BLOCKLIST


def canonicalize_medium(medium_value: str):
    """
    Map a raw medium string to one of 5 canonical groups.
    Returns None if no match or is a dept name.
    """
    if not medium_value:
        return None
    if is_dept_name(medium_value):
        return None

    lower = medium_value.lower()
    for group_name, substrings in CANONICAL_GROUPS:
        for substr in substrings:
            if substr.lower() in lower:
                return group_name
    return None
