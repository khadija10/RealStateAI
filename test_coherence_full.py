"""Tests de cohérence avancés — 5 axes."""
import requests, json
from pathlib import Path

BASE = "http://localhost:8000/api"

def estimer(address=None, postal_code=None, area_m2=65, rooms=3,
            property_type="apartment", dpe_classe=None, annee_construction=None,
            commune=None, a_terrain=False, surface_terrain=None):
    payload = {"area_m2": area_m2, "rooms": rooms, "property_type": property_type}
    if address:      payload["address"] = address
    if postal_code:  payload["postal_code"] = postal_code
    if commune:      payload["commune"] = commune
    if dpe_classe:   payload["dpe_classe"] = dpe_classe
    if annee_construction: payload["annee_construction"] = annee_construction
    r = requests.post(f"{BASE}/predictions/estimate", json=payload, timeout=15)
    if r.status_code == 200:
        d = r.json()
        return {
            "pm2": d.get("price_per_m2", 0),
            "total": d.get("estimated_price", 0),
            "low": d.get("price_range", {}).get("low", 0),
            "high": d.get("price_range", {}).get("high", 0),
            "model": d.get("model", "?"),
            "ok": True,
        }
    return {"ok": False, "error": r.json().get("detail", r.text)[:80]}

def row(label, res, ref=None, note=""):
    if not res["ok"]:
        print(f"  {label:<42} ❌  {res['error']}")
        return
    delta = ""
    if ref:
        pct = (res["pm2"] - ref) / ref * 100
        delta = f"  ({pct:+.1f}%)"
    flag = note if note else ""
    print(f"  {label:<42} {res['pm2']:>9,.0f}€/m²  {res['total']:>12,.0f}€{delta}  {flag}")

def section(title):
    print(f"\n{'═'*75}")
    print(f"  {title}")
    print(f"{'═'*75}")

# ─────────────────────────────────────────────────────────────────────────────
section("1 — SENSIBILITÉ INFRA-COMMUNALE (même CP, rues différentes)")
# Paris 8e : avenue Montaigne (ultra-prestige) vs rue de la Bienfaisance (standard)
print()
r1 = estimer("22 avenue Montaigne", "75008")
r2 = estimer("12 rue de la Bienfaisance", "75008")
r3 = estimer("35 rue du Rocher", "75008")
row("Paris 8e — av. Montaigne (prestige)", r1)
row("Paris 8e — rue de la Bienfaisance", r2, r1["pm2"] if r1["ok"] else None)
row("Paris 8e — rue du Rocher (standard)", r3, r1["pm2"] if r1["ok"] else None)

# Paris 18e : place du Tertre vs bd Barbès
r4 = estimer("3 place du Tertre", "75018")
r5 = estimer("10 boulevard Barbès", "75018")
print()
row("Paris 18e — pl. du Tertre (Montmartre)", r4)
row("Paris 18e — bd Barbès (populaire)", r5, r4["pm2"] if r4["ok"] else None)

# ─────────────────────────────────────────────────────────────────────────────
section("2 — NOMBRE DE PIÈCES À SURFACE FIXE (65m², même adresse)")
print("  → plus de pièces = pièces plus petites = décote attendue")
print()
addr, cp = "21 rue du Faubourg Saint-Antoine", "75011"
ref_3p = None
for rooms, label in [(1,"1P (studio)"), (2,"2P"), (3,"3P (ref)"), (4,"4P"), (5,"5P")]:
    res = estimer(addr, cp, area_m2=65, rooms=rooms)
    if rooms == 3 and res["ok"]: ref_3p = res["pm2"]
    row(f"  65m² {label}", res, ref_3p if rooms != 3 else None)

# ─────────────────────────────────────────────────────────────────────────────
section("3 — ZONES FRONTIÈRES (même boulevard, deux communes)")
print()
# Levallois-Perret vs Clichy — bd Bineau / bd Victor Hugo (séparé par la limite communale)
r_lev = estimer("50 rue Anatole France", "92300")   # Levallois-Perret
r_cli = estimer("50 rue Martre",         "92110")   # Clichy

row("Levallois-Perret 92 (premium)", r_lev)
row("Clichy 92 (abordable)", r_cli, r_lev["pm2"] if r_lev["ok"] else None)
print()

# Vincennes vs Paris 12e — séparés par le bois
r_vin = estimer("1 avenue de Paris",        "94300")  # Vincennes
r_p12 = estimer("15 avenue du Trône",       "75012")  # Paris 12e
row("Vincennes 94", r_vin)
row("Paris 12e (porte de Vincennes)", r_p12, r_vin["pm2"] if r_vin["ok"] else None)
print()

# Montreuil vs Paris 20e
r_mon = estimer("5 rue de Paris",           "93100")  # Montreuil
r_p20 = estimer("5 rue de Bagnolet",        "75020")  # Paris 20e
row("Montreuil 93", r_mon)
row("Paris 20e (porte de Montreuil)", r_p20, r_mon["pm2"] if r_mon["ok"] else None)

# ─────────────────────────────────────────────────────────────────────────────
section("4 — BENCHMARK NOTAIRES-INSEE T1 2025 (65m² 3P appartement)")
print()
# Prix médians officiels Notaires-INSEE IDF T1 2025 (arrondis)
NOTAIRES = {
    "Paris 7e":       14_700,
    "Paris 11e":      10_800,
    "Paris 18e":       9_900,
    "Paris 19e":       8_400,
    "Neuilly 92":     10_500,
    "Boulogne 92":     8_900,
    "Vincennes 94":    8_200,
    "Montreuil 93":    5_800,
    "Versailles 78":   6_500,
    "Evry 91":         2_900,
}
ADDRESSES = {
    "Paris 7e":       ("12 rue de Varenne",                   "75007"),
    "Paris 11e":      ("21 rue du Faubourg Saint-Antoine",    "75011"),
    "Paris 18e":      ("5 rue Lepic",                         "75018"),
    "Paris 19e":      ("10 avenue Jean Jaurès",               "75019"),
    "Neuilly 92":     ("15 boulevard du Commandant Rolland",  "92200"),
    "Boulogne 92":    ("20 rue du Château",                   "92100"),
    "Vincennes 94":   ("3 avenue de Paris",                   "94300"),
    "Montreuil 93":   ("5 rue de Paris",                      "93100"),
    "Versailles 78":  ("8 rue de la Paroisse",                "78000"),
    "Evry 91":        ("5 rue des Aunettes",                  "91000"),
}
print(f"  {'Zone':<28} {'Modèle':>10} {'Notaires':>10} {'Écart':>8}  Verdict")
print(f"  {'─'*68}")
errors = []
for zone, notaires_pm2 in NOTAIRES.items():
    addr, cp = ADDRESSES[zone]
    res = estimer(addr, cp, area_m2=65, rooms=3)
    if not res["ok"]:
        print(f"  {zone:<28} ❌  {res['error']}")
        continue
    pm2 = res["pm2"]
    ecart_pct = (pm2 - notaires_pm2) / notaires_pm2 * 100
    verdict = "✅" if abs(ecart_pct) <= 20 else "⚠️ " if abs(ecart_pct) <= 35 else "❌"
    errors.append(abs(ecart_pct))
    print(f"  {zone:<28} {pm2:>9,.0f}€ {notaires_pm2:>9,.0f}€ {ecart_pct:>+7.1f}%  {verdict}")
if errors:
    print(f"\n  MAPE vs Notaires-INSEE : {sum(errors)/len(errors):.1f}%  |  max écart : {max(errors):.1f}%")

# ─────────────────────────────────────────────────────────────────────────────
section("5 — VÉRIFICATION SUR TRANSACTIONS DVF 2025 RÉELLES")
print("  Contrôle de vraisemblance, pas une mesure de précision : le modèle de production a appris ces ventes.")
print()
try:
    import duckdb, numpy as np
    gold_path = "data/processed/gold_transactions"
    # Filtrer d'abord, puis tirer : « USING SAMPLE » tirait 10 lignes dans toute la
    # table avant les filtres, et il n'en restait presque aucune. Graine fixe :
    # le même tirage à chaque exécution.
    con = duckdb.connect()
    con.execute("SELECT setseed(0.42)")
    df = con.execute(f"""
        SELECT adresse_numero, adresse_nom_voie, code_postal, surface_bati, nb_pieces,
               code_type_local, prix_m2, valeur_fonciere AS prix_total
        FROM read_parquet('{gold_path}/**/*.parquet', hive_partitioning=true)
        WHERE annee = 2025
          AND surface_bati BETWEEN 40 AND 90
          AND nb_pieces BETWEEN 2 AND 4
          AND code_postal LIKE '75%'
          AND prix_m2 BETWEEN 6000 AND 18000
          AND adresse_numero IS NOT NULL
        ORDER BY random()
        LIMIT 30
    """).df()

    print(f"  {'Adresse DVF':<38} {'Réel':>10} {'Modèle':>10} {'Erreur':>8}")
    print(f"  {'─'*70}")
    errs = []
    for _, tx in df.iterrows():
        num  = str(tx.get("adresse_numero", "")).strip().removesuffix(".0")
        voie = str(tx.get("adresse_nom_voie", "")).strip()
        addr = f"{num} {voie}".strip() if num and num != "nan" else voie
        cp   = str(tx.get("code_postal", "")).strip()
        surf = float(tx["surface_bati"])
        piec = int(tx["nb_pieces"])
        reel = float(tx["prix_m2"])
        ptype = "apartment" if tx.get("code_type_local","2") in ["2","Appartement"] else "house"

        if not addr or not cp:
            continue
        res = estimer(addr, cp, area_m2=surf, rooms=piec, property_type=ptype)
        if not res["ok"]:
            continue
        ecart = (res["pm2"] - reel) / reel * 100   # signé : négatif si le modèle est sous le prix réel
        err = abs(ecart)
        errs.append(err)
        verdict = "✅" if err <= 15 else "⚠️ " if err <= 30 else "❌"
        short = addr[:36]
        print(f"  {short:<38} {reel:>9,.0f}€ {res['pm2']:>9,.0f}€ {ecart:>+7.1f}%  {verdict}")
    if errs:
        print(f"\n  MAPE sur {len(errs)} transactions 2025 : {sum(errs)/len(errs):.1f}%")
except Exception as e:
    print(f"  ❌ Accès gold parquet : {e}")

print()
