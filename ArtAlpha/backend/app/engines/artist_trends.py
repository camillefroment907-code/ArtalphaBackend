"""Artist tier classification for Balthus."""
from typing import Optional

BLUE_CHIP_ARTISTS = {
    "pablo picasso", "andy warhol", "jean-michel basquiat",
    "gerhard richter", "jasper johns", "cy twombly",
    "jeff koons", "damien hirst", "yves klein",
    "pierre soulages", "zao wou-ki", "joan miró",
    "marc chagall", "fernand léger", "alexander calder",
    "henry moore", "francis bacon", "lucian freud",
    "david hockney", "jean dubuffet", "niki de saint phalle",
    "bernard buffet", "renoir", "monet", "degas", "cézanne",
    "matisse", "klimt", "schiele", "kandinsky",
}

TRENDING_ARTISTS = {
    "yoshitomo nara", "banksy", "kaws", "daniel arsham",
    "matthew wong", "amoako boafo", "flora yukhnovich",
    "peter doig", "cecily brown", "george condo",
    "jonas wood", "henry taylor", "salman toor",
    "lynette yiadom-boakye", "avery singer",
}


def classify_artist(artist_name: Optional[str]) -> dict:
    if not artist_name:
        return {"tier": "unknown", "badge": None, "trending": False}
    name = artist_name.lower().strip()
    # Check partial matches too (e.g., "Pablo Picasso (1881-1973)")
    for blue in BLUE_CHIP_ARTISTS:
        if blue in name or name in blue:
            return {"tier": "blue_chip", "badge": "Blue Chip", "trending": False}
    for trend in TRENDING_ARTISTS:
        if trend in name or name in trend:
            return {"tier": "trending", "badge": "Trending", "trending": True}
    return {"tier": "established", "badge": None, "trending": False}
