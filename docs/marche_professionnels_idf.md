# Marché adressable : les professionnels de la transaction en Île-de-France

**Établi le 3 octobre 2026**, en réponse au retour du jury de la soutenance blanche :

> « Votre SAM est compté en ventes, alors que vous faites payer des professionnels : c'est le nombre d'agents et de mandataires qu'il faut chiffrer. »

---

## 1. Résultat

| | France (1ᵉʳ janvier 2026) | Île-de-France (estimation) |
|---|---:|---:|
| Structures titulaires d'une carte avec la mention transaction (agences, indépendants) | 41 471 | **7 500 à 11 700** |
| Agents commerciaux habilités (mandataires) | 84 470 | **15 200 à 23 700** |
| Salariés habilités (négociateurs) | 58 541 | **10 500 à 16 500** |
| **Professionnels de la transaction** | **184 482** | **33 000 à 52 000** |

**À retenir :** environ **40 000 professionnels de la transaction exercent en Île-de-France**, dans une fourchette de 33 000 à 52 000. Parmi eux, environ 20 000 mandataires et environ 10 000 agences ou indépendants.

---

## 2. Méthode

**Chiffres nationaux.** Ils viennent du fichier des professionnels de l'immobilier tenu par les CCI au 1ᵉʳ janvier 2026, cité par le Journal de l'Agence :

- 43 886 cartes professionnelles, dont 41 471 avec la mention transaction ;
- 143 011 collaborateurs habilités : 84 470 agents commerciaux et 58 541 salariés.

Un titulaire de carte (le dirigeant) et chacun de ses collaborateurs habilités peuvent être un utilisateur payant : le tarif est par utilisateur.

**Part de l'Île-de-France.** Le fichier des CCI ne publie pas de répartition par région. On l'encadre par deux indicateurs :

| Indicateur | Part de l'Île-de-France | Rôle |
|---|---:|---|
| Population (INSEE) | environ 18 % | borne basse : la région concentre plus de professionnels que d'habitants |
| Entreprises actives du code NAF 68.31Z (agences immobilières), répertoire SIRENE | **28,1 %** (39 307 sur 139 902) | borne haute : Paris compte de nombreuses sociétés domiciliées, en particulier dans le 8ᵉ arrondissement |

**Détail du comptage SIRENE pour l'Île-de-France.** Entreprises actives du code 68.31Z, interrogées le 3 octobre 2026 par l'API Recherche d'entreprises (`recherche-entreprises.api.gouv.fr`) :

| Paris | Seine-et-Marne | Yvelines | Essonne | Hauts-de-Seine | Seine-Saint-Denis | Val-de-Marne | Val-d'Oise | **Total** |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 17 710 | 2 456 | 3 679 | 2 467 | 5 657 | 2 127 | 2 856 | 2 355 | **39 307** |

- Paris est compté arrondissement par arrondissement, car l'API plafonne une réponse à 10 000 résultats.
- Les mandataires indépendants se déclarent en majorité sous ce même code.

**Recoupement.** Le baromètre 2025 de La Maison des Mandataires compte 47 000 conseillers dans les réseaux de mandataires. C'est moins que les 84 470 agents commerciaux du fichier des CCI, car les agences traditionnelles emploient aussi des agents commerciaux.

---

## 3. Du marché au chiffre d'affaires (illustration)

| | Hypothèse | Utilisateurs | Chiffre d'affaires annuel HT |
|---|---|---:|---:|
| SAM | 40 000 professionnels × 468 € HT par an (offre Pro annuelle, 39 € HT par mois) | 40 000 | 18,7 M€ |
| SOM, année 1 | 0,5 % du SAM | 200 | 94 k€ |
| SOM, année 3 | 2 % du SAM | 800 | 374 k€ |

Ces parts de marché sont des **hypothèses de travail**. Elles sont à valider par la bêta gratuite proposée aux professionnels.

---

## 4. Limites

- La part de l'Île-de-France est encadrée par deux indicateurs, et non mesurée. Le chiffre exact demanderait une extraction du fichier des CCI par département.
- Un professionnel peut avoir plusieurs habilitations (par exemple chez deux agences) : le total national peut compter certaines personnes deux fois.
- Les sources secondaires trouvées en ligne donnent, pour l'Île-de-France, entre 6 000 et 20 000 agences, sans méthode. Elles ne sont pas retenues.

## Sources

- Fichier des professionnels de l'immobilier (CCI), chiffres au 1ᵉʳ janvier 2026 : [Journal de l'Agence, « 5 chiffres clés sur le paysage des professionnels de l'immobilier en 2026 »](https://www.journaldelagence.com/1410307-5-chiffres-cles-sur-les-professionnels-de-limmobilier-en-2026)
- Baromètre 2025 des réseaux de mandataires (La Maison des Mandataires) : [Immo Matin, 6 mai 2026](https://www.immomatin.com/franchise/reseau-mandataires/transaction-les-reseaux-de-mandataires-gagnent-encore-des-parts-de-marche.html)
- Répertoire SIRENE, code NAF 68.31Z : [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr) · [nomenclature INSEE 68.31](https://www.insee.fr/fr/metadonnees/nafr2/classe/68.31)
