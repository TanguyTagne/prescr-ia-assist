

## Analyse des modèles IA actuels

Voici la configuration actuelle dans `analyze-prescription/index.ts` :

| Usage | Modèle actuel | Vitesse | Puissance |
|-------|--------------|---------|-----------|
| **OCR** (images d'ordonnances) | `google/gemini-2.5-pro` | Lent mais précis | Très élevée |
| **Extraction texte** + **Enrichissement clinique** | `google/gemini-2.5-flash` | Rapide | Moyenne-haute |

Le goulot d'étranglement de vitesse vient principalement de **Gemini 2.5 Flash** pour l'analyse texte, et de **Gemini 2.5 Pro** pour l'OCR (ce dernier étant naturellement plus lent car plus puissant).

## Proposition d'upgrade

Passer aux modèles de dernière génération disponibles :

| Usage | Modèle proposé | Avantage |
|-------|----------------|----------|
| **OCR** (images) | `google/gemini-3.1-pro-preview` | Dernière génération, meilleur raisonnement |
| **Extraction texte** | `google/gemini-3-flash-preview` | Plus rapide que 2.5 Flash, qualité supérieure |

### Changements concrets

**1 seul fichier à modifier** : `supabase/functions/analyze-prescription/index.ts`

- Ligne 571 : `OCR_MODEL = "google/gemini-2.5-pro"` → `"google/gemini-3.1-pro-preview"`
- Ligne 572 : `TEXT_MODEL = "google/gemini-2.5-flash"` → `"google/gemini-3-flash-preview"`

### Impact
- **Coût** : Légèrement plus élevé en tokens (modèles preview de nouvelle génération)
- **Vitesse** : Flash 3.0 devrait être plus rapide que Flash 2.5 ; Pro 3.1 comparable ou légèrement plus rapide que Pro 2.5
- **Qualité** : Meilleur raisonnement clinique et meilleure extraction OCR

