

# Réécriture des phrases conseils — mi-commercial / mi-technique

## Constat

Les phrases actuelles sont trop cliniques (ex: "les Oméga 3 EPA/DHA réduisent la production de médiateurs inflammatoires et protègent le cartilage"). Un pharmacien ne peut pas dire ça naturellement à un client. Le taux d'acceptation baisse quand le discours est trop médical.

## Objectif

Réécrire les 2 041 phrases pour qu'elles soient :
- **Naturelles** : comme si le pharmacien parlait au client
- **Persuasives** : orientées bénéfice ressenti (pas mécanisme d'action)
- **Crédibles** : un ancrage technique léger pour asseoir la légitimité
- **Courtes** : 15-25 mots, une seule phrase

**Avant** : "Les opioïdes peuvent entraîner une constipation sévère, l'Arnigel améliore la microcirculation locale et diminue la douleur musculaire des contractures."

**Après** : "Ce traitement peut provoquer des tensions musculaires, l'Arnigel soulage rapidement et vous aide à rester à l'aise au quotidien."

## Structure cible

`[Effet ressenti du traitement] + [ce que le produit apporte concrètement]`

Pas de jargon type "médiateurs inflammatoires", "neuromusculaire", "kératine unguéale". On garde des termes comme "flore intestinale", "vitamine D", "magnésium" qui sont compris par le grand public.

## Plan technique

1. **Extraire** les 2 041 phrases actuelles (id + phrase_conseil + produit + contexte pathologie)
2. **Réécrire par batch** via l'AI Gateway (Gemini), avec un prompt système strict :
   - Ton : pharmacien bienveillant qui conseille, pas qui prescrit
   - Interdit : "médiateurs", "pharmacocinétique", "unguéal", "adsorbe", etc.
   - Autorisé : "flore", "articulations", "circulation", "défenses", "énergie"
   - Format : max 25 mots, une phrase, tutoiement interdit
3. **Mettre à jour** en base via l'edge function `batch-update-phrases` existante
4. **Vérifier** un échantillon de 20 phrases post-update pour contrôle qualité

Estimation : ~10 appels batch AI + 1 migration update.

