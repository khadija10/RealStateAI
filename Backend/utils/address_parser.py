import re
from typing import Optional, Dict

CP_REGEX = re.compile(r"\b(\d{5})\b")

def parse_address(address: str) -> Dict[str, Optional[str]]:
    if not address or not address.strip():
        return {"code_postal": None, "commune": None, "raw": address}

    raw = address.strip()

    cp_match = CP_REGEX.search(raw)
    code_postal = cp_match.group(1) if cp_match else None

    commune = None
    if "," in raw:
        tail = raw.split(",")[-1].strip()
        tail = CP_REGEX.sub("", tail).strip()
        commune = tail if tail else None
    else:
        if code_postal:
            parts = raw.split(code_postal)
            if len(parts) >= 2:
                tail = parts[-1].strip(" -")
                commune = tail if tail else None

    if commune:
        commune = commune.replace("  ", " ").strip().title()

    return {"code_postal": code_postal, "commune": commune, "raw": raw}