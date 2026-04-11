

# PDF Asclion — Pricing & Prévisions

## Pricing
- **0,15 €/ordonnance** analysée, sans abonnement, sans engagement
- Justification : chaque analyse génère en moyenne **+1,50 € sur le panier**

## Prévisions (base : 200 ordonnances/jour, produit complémentaire moyen ~10 €)

| Scénario | Taux de ventes acceptées | Ventes additionnelles/jour | CA additionnel/mois | Coût Asclion/mois | ROI |
|---|---|---|---|---|---|
| **Prudent** | 10 % | 20 ventes | ~4 400 € | 780 € | x5,6 |
| **Réaliste** | 15 % | 30 ventes | ~6 600 € | 780 € | x8,5 |
| **Optimiste** | 20 % | 40 ventes | ~8 800 € | 780 € | x11,3 |

## Structure du PDF (3 pages, A4, brandé Asclion)

**Page 1 — Couverture** : Logo Asclion, tagline, titre "Offre Commerciale"

**Page 2 — Pricing** : 0,15 €/ordo, sans engagement, tableau des fonctionnalités incluses, argument ROI (0,15 € → +1,50 € panier)

**Page 3 — Prévisions** : Tableau 3 scénarios (10/15/20 %), exemple chiffré 200 ordos/jour, synthèse ROI, call-to-action

## Technique
- Python ReportLab, palette Asclion (`#3D9B8F`, `#1A3A35`, `#F7FAF9`)
- QA visuelle via pdftoppm
- Output : `/mnt/documents/asclion_pricing.pdf`

