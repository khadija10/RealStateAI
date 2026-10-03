import requests

BASE = "http://localhost:8000/api"
ADRESSE = "21 rue du Faubourg Saint-Antoine"
CP = "75011"

scenarios = [
    # Axe 1 — Surface (sans DPE)
    {"label": "Appart 30m² 1P",    "area_m2": 30,  "rooms": 1, "property_type": "apartment", "dpe_classe": None, "annee_construction": None},
    {"label": "Appart 50m² 2P",    "area_m2": 50,  "rooms": 2, "property_type": "apartment", "dpe_classe": None, "annee_construction": None},
    {"label": "Appart 80m² 3P",    "area_m2": 80,  "rooms": 3, "property_type": "apartment", "dpe_classe": None, "annee_construction": None},
    {"label": "Appart 120m² 5P",   "area_m2": 120, "rooms": 5, "property_type": "apartment", "dpe_classe": None, "annee_construction": None},
    # Axe 2 — DPE A→G (65m² 3P)
    {"label": "65m² DPE A 2020",   "area_m2": 65,  "rooms": 3, "property_type": "apartment", "dpe_classe": "A", "annee_construction": 2020},
    {"label": "65m² DPE B 2005",   "area_m2": 65,  "rooms": 3, "property_type": "apartment", "dpe_classe": "B", "annee_construction": 2005},
    {"label": "65m² DPE C 1995",   "area_m2": 65,  "rooms": 3, "property_type": "apartment", "dpe_classe": "C", "annee_construction": 1995},
    {"label": "65m² DPE D 1985",   "area_m2": 65,  "rooms": 3, "property_type": "apartment", "dpe_classe": "D", "annee_construction": 1985},
    {"label": "65m² DPE F 1965",   "area_m2": 65,  "rooms": 3, "property_type": "apartment", "dpe_classe": "F", "annee_construction": 1965},
    {"label": "65m² DPE G 1955",   "area_m2": 65,  "rooms": 3, "property_type": "apartment", "dpe_classe": "G", "annee_construction": 1955},
    # Axe 3 — Type de bien
    {"label": "Maison 100m² 4P",   "area_m2": 100, "rooms": 4, "property_type": "house",     "dpe_classe": None, "annee_construction": None},
]

print(f"Adresse : {ADRESSE} {CP}\n")
print(f"{'Scénario':<26} {'Prix/m²':>10} {'Prix total':>13} {'Basse':>12} {'Haute':>12}  Méthode")
print("─" * 90)

ref_dpe = None
for s in scenarios:
    payload = {
        "address": ADRESSE,
        "postal_code": CP,
        "area_m2": s["area_m2"],
        "rooms": s["rooms"],
        "property_type": s["property_type"],
    }
    if s["dpe_classe"]:
        payload["dpe_classe"] = s["dpe_classe"]
    if s["annee_construction"]:
        payload["annee_construction"] = s["annee_construction"]

    try:
        r = requests.post(f"{BASE}/predictions/estimate", json=payload, timeout=15)
        if r.status_code == 200:
            d = r.json()
            pm2   = d.get("price_per_m2", 0)
            total = d.get("estimated_price", 0)
            pr    = d.get("price_range", {})
            low   = pr.get("low", 0)
            high  = pr.get("high", 0)
            meth  = d.get("model", "?")

            delta = ""
            if s["label"] == "65m² DPE A 2020":
                ref_dpe = pm2
            elif ref_dpe and s.get("dpe_classe"):
                pct = (pm2 - ref_dpe) / ref_dpe * 100
                delta = f"  ({pct:+.1f}% vs A)"

            print(f"{s['label']:<26} {pm2:>9,.0f}€ {total:>12,.0f}€ {low:>11,.0f}€ {high:>11,.0f}€  {meth}{delta}")
        else:
            try:
                err = r.json()
                detail = err.get("detail", str(r.text))[:70]
            except Exception:
                detail = r.text[:70]
            print(f"{s['label']:<26} ❌ {r.status_code} — {detail}")
    except Exception as e:
        print(f"{s['label']:<26} ❌ {e}")
