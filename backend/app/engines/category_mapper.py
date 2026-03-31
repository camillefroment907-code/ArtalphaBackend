"""Maps raw auction categories to Balthus standard categories."""

BALTHUS_CATEGORIES = [
    "Peintures", "Sculptures", "Art Contemporain", "Photographie",
    "Estampes & Multiples", "Dessins", "Art Asiatique",
    "Bijoux & Montres", "Mobilier", "Livres & Manuscrits",
    "Céramiques & Porcelaines", "Art Ancien", "Autres",
]

CATEGORY_MAPPING = {
    "tableau": "Peintures", "tableaux": "Peintures", "peinture": "Peintures",
    "painting": "Peintures", "oil": "Peintures", "huile": "Peintures",
    "watercolor": "Peintures", "aquarelle": "Peintures",
    "art moderne": "Peintures", "modern art": "Peintures",
    "old masters": "Art Ancien", "tableaux anciens": "Art Ancien",
    "maîtres anciens": "Art Ancien", "art ancien": "Art Ancien",
    "sculpture": "Sculptures", "sculptures": "Sculptures",
    "bronze": "Sculptures", "marbre": "Sculptures",
    "photographie": "Photographie", "photography": "Photographie",
    "estampe": "Estampes & Multiples", "estampes": "Estampes & Multiples",
    "print": "Estampes & Multiples", "prints": "Estampes & Multiples",
    "lithographie": "Estampes & Multiples", "gravure": "Estampes & Multiples",
    "dessin": "Dessins", "dessins": "Dessins", "drawing": "Dessins",
    "contemporain": "Art Contemporain", "contemporary": "Art Contemporain",
    "asie": "Art Asiatique", "asian": "Art Asiatique", "chine": "Art Asiatique",
    "japon": "Art Asiatique", "china": "Art Asiatique",
    "bijou": "Bijoux & Montres", "bijoux": "Bijoux & Montres",
    "jewelry": "Bijoux & Montres", "montre": "Bijoux & Montres",
    "montres": "Bijoux & Montres", "watches": "Bijoux & Montres", "diamant": "Bijoux & Montres",
    "mobilier": "Mobilier", "furniture": "Mobilier",
    "meuble": "Mobilier", "meubles": "Mobilier",
    "livre": "Livres & Manuscrits", "livres": "Livres & Manuscrits",
    "book": "Livres & Manuscrits", "manuscrit": "Livres & Manuscrits",
    "vase": "Céramiques & Porcelaines", "céramique": "Céramiques & Porcelaines",
    "porcelaine": "Céramiques & Porcelaines", "ceramic": "Céramiques & Porcelaines",
}


def map_category(raw: str) -> str:
    if not raw:
        return "Autres"
    lower = raw.lower().strip()
    if lower in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[lower]
    for key, val in CATEGORY_MAPPING.items():
        if key in lower:
            return val
    return "Autres"


def infer_category_from_lot(title: str, medium: str = "", description: str = "") -> str:
    text = " ".join(filter(None, [title, medium, description])).lower()
    if any(w in text for w in ["photo", "photograph", "tirage"]):
        return "Photographie"
    if any(w in text for w in ["lithograph", "lithographie", "gravure", "estampe", "print"]):
        return "Estampes & Multiples"
    if any(w in text for w in ["bronze", "sculpture", "statue", "buste", "marbre"]):
        return "Sculptures"
    if any(w in text for w in ["dessin", "drawing", "crayon", "pencil", "pastel"]):
        return "Dessins"
    if any(w in text for w in ["huile", "oil", "toile", "canvas", "watercolor", "aquarelle"]):
        return "Peintures"
    if any(w in text for w in ["bijou", "jewelry", "bague", "collier", "montre", "watch", "diamant"]):
        return "Bijoux & Montres"
    if any(w in text for w in ["livre", "book", "manuscrit", "volume"]):
        return "Livres & Manuscrits"
    if any(w in text for w in ["vase", "céramique", "porcelaine", "ceramic"]):
        return "Céramiques & Porcelaines"
    if any(w in text for w in ["meuble", "furniture", "armoire", "commode"]):
        return "Mobilier"
    if any(w in text for w in ["chine", "japon", "china", "japan", "asie", "asian", "tang", "ming", "qing", "thangka"]):
        return "Art Asiatique"
    if any(w in text for w in ["xviie", "xviiie", "xixe", "ancien", "antique", "old master"]):
        return "Art Ancien"
    return "Peintures"  # Default for art lots
