import requests

BASE = "http://localhost:8000/api"

# Même profil partout : 65m² 3P appartement sans DPE
# pour comparer le prix/m² pur entre zones
scenarios = [
    # Paris intra-muros — gradient arrondissements
    {"label": "Paris 7e (prestige)",     "address": "12 rue de Varenne",                 "postal_code": "75007"},
    {"label": "Paris 16e (résidentiel)", "address": "45 avenue Victor Hugo",              "postal_code": "75116"},
    {"label": "Paris 11e (populaire)",   "address": "21 rue du Fbg Saint-Antoine",        "postal_code": "75011"},
    {"label": "Paris 18e (Montmartre)",  "address": "5 rue Lepic",                        "postal_code": "75018"},
    {"label": "Paris 19e (périphérie)",  "address": "10 avenue Jean Jaurès",              "postal_code": "75019"},
    # Petite couronne — gradient 92/93/94
    {"label": "Neuilly-sur-Seine 92",    "address": "15 boulevard du Commandant Rolland", "postal_code": "92200"},
    {"label": "Boulogne 92",             "address": "20 rue du Château",                  "postal_code": "92100"},
    {"label": "Montreuil 93",            "address": "5 rue de Paris",                     "postal_code": "93100"},
    {"label": "Saint-Denis 93",          "address": "10 rue de la République",            "postal_code": "93200"},
    {"label": "Vincennes 94",            "address": "3 avenue de Paris",                  "postal_code": "94300"},
    # Grande couronne
    {"label": "Versailles 78",           "address": "8 rue de la Paroisse",               "postal_code": "78000"},
    {"label": "Fontainebleau 77",        "address": "12 rue Grande",                      "postal_code": "77300"},
    {"label": "Evry 91",                 "address": "5 rue des Aunettes",                 "postal_code": "91000"},
]

print(f"Profil : 65m² 3P appartement — comparaison inter-zones\n")
print(f"{'Adresse':<35} {'Prix/m²':>10} {'Prix total':>13} {'Méthode'}")
print("─" * 70)

prev_pm2 = None
for s in scenarios:
    payload = {
        "address": s["address"],
        "postal_code": s["postal_code"],
        "area_m2": 65,
        "rooms": 3,
        "property_type": "apartment",
    }
    try:
        r = requests.post(f"{BASE}/predictions/estimate", json=payload, timeout=15)
        if r.status_code == 200:
            d = r.json()
            pm2   = d.get("price_per_m2", 0)
            total = d.get("estimated_price", 0)
            meth  = d.get("model", "?")
            print(f"{s['label']:<35} {pm2:>9,.0f}€ {total:>12,.0f}€  {meth}")
        else:
            try:
                detail = r.json().get("detail", r.text)[:60]
            except Exception:
                detail = r.text[:60]
            print(f"{s['label']:<35} ❌ {r.status_code} — {detail}")
    except Exception as e:
        print(f"{s['label']:<35} ❌ {e}")
