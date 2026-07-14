# Le widget démo "?" est-il pertinent pour convertir ?

## Réponse courte
**Oui, à garder — mais en l'ajustant.** C'est ton meilleur outil de conversion "montre, ne dis pas". Le supprimer serait une erreur ; en revanche, dans sa forme actuelle il sous-performe.

## Pourquoi le garder

- **C'est ta démo instantanée.** Un visiteur pharmacien qui voit le copilote fonctionner en 10 secondes est infiniment plus convaincu que par un texte, même excellent. C'est exactement le principe "product-led landing".
- **Il alimente déjà le lead form** (`submit-demo-lead` + `track-demo-session`) — donc la conversion widget → lead est déjà instrumentée.
- **Le tour "?"** guide vers les 3 ordonnances de démo (Médecine générale, Soins infirmiers, Cardio) : sans lui, la majorité des visiteurs ne comprendrait pas quoi faire du widget flottant.

## Pourquoi il ne convertit pas assez aujourd'hui (hypothèses à valider)

1. **Trop discret** — en bas à droite, il ressemble à un chatbot de support (aveuglement banner).
2. **Le tour ne se déclenche qu'au clic** sur "?" → 90 % des visiteurs ne le voient jamais.
3. **Pas d'ancrage narratif** — le visiteur ne sait pas "pourquoi" tester avant d'avoir lu la page.
4. **Aucun CTA de sortie clair** après la démo (une fois qu'il a vu la magie, on ne lui redemande pas la démo commerciale immédiatement).

## Recommandation

Garder le widget, mais faire 3 ajustements ciblés (par ordre d'impact conversion) :

1. **Auto-tour au 1ᵉʳ scroll** (ou après 8 s sur la page) — un pulse discret sur le widget + une bulle "Testez le copilote en 10 s" qui disparaît au clic ou après 5 s. Objectif : passer de ~5 % à ~40 % d'interactions.
2. **CTA sortie de démo** — dès qu'une ordonnance de démo a été analysée, afficher dans le widget une bande "Vous voulez ça dans votre officine ? → Réserver ma démo (15 min)" qui scrolle vers `#demande-acces` et pré-remplit un champ "vu la démo".
3. **Renommer le trigger "?"** en un vrai bouton libellé (ex. "▶ Tester le copilote") avec un léger halo — plus lisible qu'un point d'interrogation qui évoque de l'aide, pas une démo.

Bonus optionnel : tracker `widget_opened`, `demo_prescription_analyzed`, `demo_to_lead_click` dans `track-demo-session` pour mesurer réellement chaque étape du funnel.

## Ce que je ferai en mode build

- Ajouter le déclenchement automatique du tour (au scroll ou timer, un seul affichage par session — clé localStorage déjà en place).
- Injecter un CTA "Réserver ma démo" dans `WidgetDemoTour` / le widget une fois une démo terminée.
- Remplacer le label du bouton d'ouverture par "▶ Tester le copilote" + petit halo animé.
- Ajouter 3 events analytiques dans le flow démo pour piloter les prochaines itérations.

Détails techniques : `src/components/WidgetDemoTour.tsx` (auto-trigger + libellé), le composant du widget flottant (CTA post-démo), `supabase/functions/track-demo-session/index.ts` (nouveaux events).

## Note sur "adapter grâce au livre"
Je n'ai pas trouvé de "livre" dans le projet — je suppose une faute de frappe (libre ? l'IA ?). Si tu voulais dire autre chose (base de connaissances, contenu éditorial, etc.), dis-le moi et j'ajuste le plan.
