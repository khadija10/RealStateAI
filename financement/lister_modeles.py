"""
Liste les modèles accessibles avec la clé configurée dans .env.

Utile quand un fournisseur renvoie « model not available in your subscription
tier » : plutôt que d'essayer des noms au hasard, on interroge l'endpoint
/v1/models, exposé par toutes les API compatibles OpenAI.

Usage :
    python lister_modeles.py
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

cle = os.getenv("LLM_API_KEY") or os.getenv("XAI_API_KEY")
base_url = os.getenv("LLM_BASE_URL", "https://api.mistral.ai/v1")
modele_configure = os.getenv("LLM_MODEL", "")

if not cle or cle.startswith("colle_ta_cle"):
    raise SystemExit("Clé introuvable. Vérifie LLM_API_KEY dans le fichier .env.")

client = OpenAI(api_key=cle, base_url=base_url)

print(f"\nFournisseur      : {base_url}")
print(f"Modèle configuré : {modele_configure}\n")

try:
    modeles = sorted(m.id for m in client.models.list().data)
except Exception as err:  # noqa: BLE001 - on veut afficher l'erreur telle quelle
    raise SystemExit(f"Impossible de lister les modèles : {err}")

print(f"{len(modeles)} modèles accessibles :\n")
for identifiant in modeles:
    marque = "  <-- configuré" if identifiant == modele_configure else ""
    print(f"  {identifiant}{marque}")

if modele_configure and modele_configure not in modeles:
    print(f"\nATTENTION : '{modele_configure}' ne figure pas dans la liste.")
    print("Corrige LLM_MODEL dans .env avec l'un des identifiants ci-dessus.")

print("\nPour ce projet, privilégie un modèle qui supporte le function calling.")
print("Un modèle trop petit ignore parfois les outils et invente les chiffres :")
print("l'option --trace de chat.py permet de le vérifier immédiatement.\n")
