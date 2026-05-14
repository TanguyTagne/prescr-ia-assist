import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// PHASE 4: Complete all missing protocols + link all medicaments
// ============================================================

const PROTOCOLES_COMPLETS = [
  // ---- GASTRO ----
  {
    pathologie: "Brûlures d estomac",
    conseils: [
      { code: "BRUL_C1", label: "Éviter les aliments acides et épicés", desc: "Limiter café, alcool, tomates, agrumes et plats épicés qui augmentent l'acidité gastrique" },
      { code: "BRUL_C2", label: "Ne pas s'allonger après les repas", desc: "Attendre au moins 2h après le repas avant de s'allonger, surélever la tête de lit" },
    ],
    produits: [
      { nom: "Pansement gastrique (Gaviscon type)", type: "otc", cat: "Antiacide", prio: 90, just: "Protection muqueuse gastrique immédiate, soulagement rapide" },
      { nom: "Complément bicarbonate digestif", type: "complement", cat: "Digestion", prio: 70, just: "Neutralisation de l'acidité gastrique en complément" },
      { nom: "Tisane digestive (mélisse/réglisse)", type: "phytotherapie", cat: "Phytothérapie digestive", prio: 50, just: "Apaisement naturel des muqueuses digestives" },
    ],
  },
  {
    pathologie: "Flatulences",
    conseils: [
      { code: "FLAT_C1", label: "Manger lentement et bien mastiquer", desc: "La mastication lente réduit l'aérophagie et favorise une meilleure digestion" },
      { code: "FLAT_C2", label: "Limiter les aliments fermentescibles", desc: "Réduire légumineuses, choux, boissons gazeuses qui augmentent la production de gaz" },
    ],
    produits: [
      { nom: "Charbon végétal activé (Charbon Belloc type)", type: "otc", cat: "Anti-ballonnements", prio: 90, just: "Absorption des gaz intestinaux, efficacité prouvée" },
      { nom: "Siméticone comprimés", type: "otc", cat: "Anti-flatulences", prio: 70, just: "Fragmentation des bulles de gaz, soulagement rapide" },
      { nom: "Probiotiques flore intestinale", type: "complement", cat: "Probiotiques", prio: 50, just: "Rééquilibrage de la flore pour réduire la fermentation" },
    ],
  },
  {
    pathologie: "Dysbiose intestinale",
    conseils: [
      { code: "DYSB_C1", label: "Enrichir l'alimentation en fibres prébiotiques", desc: "Consommer ail, oignon, poireau, banane pour nourrir les bonnes bactéries" },
      { code: "DYSB_C2", label: "Limiter les sucres raffinés", desc: "Les sucres raffinés favorisent la prolifération de bactéries pathogènes" },
    ],
    produits: [
      { nom: "Probiotiques multi-souches (Bioprotus type)", type: "complement", cat: "Probiotiques", prio: 90, just: "Restauration de la flore intestinale diversifiée" },
      { nom: "Prébiotiques FOS/Inuline", type: "complement", cat: "Prébiotiques", prio: 70, just: "Nourrissent sélectivement les bonnes bactéries" },
      { nom: "L-Glutamine poudre", type: "complement", cat: "Réparation intestinale", prio: 50, just: "Renforcement de la barrière intestinale" },
    ],
  },
  {
    pathologie: "Détox hépatique",
    conseils: [
      { code: "DTOX_C1", label: "Réduire la consommation d'alcool", desc: "L'alcool est le principal facteur de surcharge hépatique" },
      { code: "DTOX_C2", label: "Privilégier une alimentation légère", desc: "Favoriser légumes verts, artichaut, radis noir pour soutenir le foie" },
    ],
    produits: [
      { nom: "Desmodium gélules", type: "phytotherapie", cat: "Hépatoprotecteur", prio: 90, just: "Hépatoprotecteur de référence en phytothérapie" },
      { nom: "Artichaut extrait (Boldoflorine type)", type: "phytotherapie", cat: "Drainage hépatique", prio: 70, just: "Stimulation de la production biliaire" },
      { nom: "Chardon-Marie gélules", type: "phytotherapie", cat: "Protection hépatique", prio: 50, just: "Silymarine protège et régénère les cellules hépatiques" },
    ],
  },
  // ---- OPHTALMOLOGIE ----
  {
    pathologie: "Blépharite",
    conseils: [
      { code: "BLEP_C1", label: "Nettoyer les paupières quotidiennement", desc: "Utiliser des lingettes stériles ou une solution adaptée matin et soir" },
      { code: "BLEP_C2", label: "Appliquer des compresses tièdes", desc: "Compresses chaudes 5-10 min pour ramollir les sécrétions et déboucher les glandes" },
    ],
    produits: [
      { nom: "Lingettes nettoyantes paupières", type: "dispositif_medical", cat: "Hygiène oculaire", prio: 90, just: "Nettoyage spécifique des paupières, hypoallergénique" },
      { nom: "Larmes artificielles sans conservateur", type: "dispositif_medical", cat: "Confort oculaire", prio: 70, just: "Lubrification oculaire pour soulager l'irritation associée" },
      { nom: "Compresses oculaires stériles", type: "dispositif_medical", cat: "Soins oculaires", prio: 50, just: "Application de chaleur pour déboucher les glandes de Meibomius" },
    ],
  },
  {
    pathologie: "Chalazion",
    conseils: [
      { code: "CHAL_C1", label: "Appliquer des compresses chaudes", desc: "Compresses chaudes 10 min 3-4 fois/jour pour favoriser le drainage" },
      { code: "CHAL_C2", label: "Masser doucement la paupière", desc: "Massage circulaire après la compresse pour faciliter l'évacuation" },
    ],
    produits: [
      { nom: "Masque chauffant oculaire", type: "dispositif_medical", cat: "Soins oculaires", prio: 90, just: "Chaleur humide prolongée pour drainage du chalazion" },
      { nom: "Lingettes paupières antiseptiques", type: "dispositif_medical", cat: "Hygiène oculaire", prio: 70, just: "Prévention de la surinfection" },
      { nom: "Collyre hydratant unidose", type: "dispositif_medical", cat: "Confort oculaire", prio: 50, just: "Soulagement de l'irritation oculaire associée" },
    ],
  },
  {
    pathologie: "Conjonctivite bactérienne",
    conseils: [
      { code: "CONB_C1", label: "Ne pas toucher ni frotter les yeux", desc: "Éviter la propagation de l'infection et l'aggravation de l'inflammation" },
      { code: "CONB_C2", label: "Laver les mains fréquemment", desc: "Prévenir la contagion, ne pas partager serviettes ou coussins" },
    ],
    produits: [
      { nom: "Sérum physiologique unidose stérile", type: "dispositif_medical", cat: "Lavage oculaire", prio: 90, just: "Nettoyage des sécrétions purulentes avant le traitement" },
      { nom: "Compresses stériles non tissées", type: "dispositif_medical", cat: "Hygiène oculaire", prio: 70, just: "Nettoyage atraumatique des yeux infectés" },
      { nom: "Collyre antiseptique sans ordonnance", type: "otc", cat: "Antiseptique oculaire", prio: 50, just: "Action antiseptique complémentaire en attente de consultation" },
    ],
  },
  // ---- DERMATOLOGIE ----
  {
    pathologie: "Cicatrice",
    conseils: [
      { code: "CICA_C1", label: "Protéger la cicatrice du soleil", desc: "Écran solaire SPF50 pendant 12 mois minimum pour éviter l'hyperpigmentation" },
      { code: "CICA_C2", label: "Masser la cicatrice régulièrement", desc: "Massage quotidien pour assouplir et favoriser la maturation de la cicatrice" },
    ],
    produits: [
      { nom: "Crème cicatrisante (Cicalfate/Cicaplast type)", type: "dermo_cosmetique", cat: "Cicatrisation", prio: 90, just: "Accélération de la réparation cutanée" },
      { nom: "Pansements siliconés", type: "dispositif_medical", cat: "Cicatrisation", prio: 70, just: "Prévention des cicatrices hypertrophiques" },
      { nom: "Huile végétale de rose musquée", type: "dermo_cosmetique", cat: "Soin cicatrice", prio: 50, just: "Assouplissement et atténuation naturelle des cicatrices" },
    ],
  },
  {
    pathologie: "Dermatite de contact",
    conseils: [
      { code: "DERC_C1", label: "Identifier et éviter l'allergène", desc: "Repérer le produit ou matériau responsable et supprimer le contact" },
      { code: "DERC_C2", label: "Hydrater la peau quotidiennement", desc: "Crème émolliente pour restaurer la barrière cutanée endommagée" },
    ],
    produits: [
      { nom: "Crème émolliente réparatrice", type: "dermo_cosmetique", cat: "Émollient", prio: 90, just: "Restauration de la barrière cutanée, apaisement" },
      { nom: "Crème hydrocortisone 0.5%", type: "otc", cat: "Anti-inflammatoire cutané", prio: 70, just: "Réduction rapide de l'inflammation et du prurit" },
      { nom: "Syndet sans savon nettoyant", type: "dermo_cosmetique", cat: "Hygiène douce", prio: 50, just: "Nettoyage non irritant de la peau fragilisée" },
    ],
  },
  {
    pathologie: "Gale",
    conseils: [
      { code: "GALE_C1", label: "Traiter tout l'entourage simultanément", desc: "Traitement de tous les contacts proches le même jour pour éviter la re-contamination" },
      { code: "GALE_C2", label: "Laver tout le linge à 60°C", desc: "Draps, vêtements, serviettes lavés à 60°C ou isolés 72h dans un sac fermé" },
    ],
    produits: [
      { nom: "Spray acaricide literie/textile (A-PAR type)", type: "dispositif_medical", cat: "Désinfection", prio: 90, just: "Traitement de l'environnement indispensable contre la re-contamination" },
      { nom: "Crème apaisante anti-prurit", type: "dermo_cosmetique", cat: "Anti-prurit", prio: 70, just: "Soulagement des démangeaisons intenses post-traitement" },
      { nom: "Émollient réparateur corps", type: "dermo_cosmetique", cat: "Soin réparateur", prio: 50, just: "Hydratation de la peau irritée par le traitement scabicide" },
    ],
  },
  {
    pathologie: "Impétigo",
    conseils: [
      { code: "IMPE_C1", label: "Nettoyer les lésions à l'eau et au savon doux", desc: "Nettoyage biquotidien pour retirer les croûtes et limiter la propagation" },
      { code: "IMPE_C2", label: "Couper les ongles courts", desc: "Éviter le grattage et la dissémination des lésions" },
    ],
    produits: [
      { nom: "Antiseptique cutané chlorhexidine", type: "otc", cat: "Antiseptique", prio: 90, just: "Désinfection des lésions pour limiter la propagation" },
      { nom: "Pansements hydrocolloïdes", type: "dispositif_medical", cat: "Pansement", prio: 70, just: "Protection des lésions et prévention de la contagion" },
      { nom: "Savon antiseptique doux", type: "otc", cat: "Hygiène", prio: 50, just: "Hygiène quotidienne adaptée à la peau infectée" },
    ],
  },
  // ---- UROLOGIE ----
  {
    pathologie: "Cystite récidivante",
    conseils: [
      { code: "CYSR_C1", label: "Boire au moins 1.5L d'eau par jour", desc: "Dilution des urines et rinçage vésical pour prévenir les récidives" },
      { code: "CYSR_C2", label: "Uriner après les rapports sexuels", desc: "Élimination mécanique des bactéries introduites dans l'urètre" },
    ],
    produits: [
      { nom: "Canneberge (cranberry) gélules", type: "complement", cat: "Prévention urinaire", prio: 90, just: "Prévention de l'adhésion bactérienne prouvée cliniquement" },
      { nom: "D-Mannose poudre", type: "complement", cat: "Prévention urinaire", prio: 70, just: "Empêche l'adhésion de E.coli à la paroi vésicale" },
      { nom: "Probiotiques flore vaginale", type: "complement", cat: "Probiotiques", prio: 50, just: "Rééquilibrage de la flore pour limiter les infections ascendantes" },
    ],
  },
  {
    pathologie: "Énurésie nocturne",
    conseils: [
      { code: "ENUR_C1", label: "Limiter les boissons le soir", desc: "Réduire les apports hydriques 2h avant le coucher" },
      { code: "ENUR_C2", label: "Instaurer un passage aux toilettes avant le coucher", desc: "Routine systématique pour vider la vessie au maximum" },
    ],
    produits: [
      { nom: "Alèse imperméable lavable", type: "dispositif_medical", cat: "Protection literie", prio: 90, just: "Protection du matelas, réduit le stress lié aux accidents" },
      { nom: "Culottes absorbantes nuit enfant", type: "dispositif_medical", cat: "Protection", prio: 70, just: "Sécurité et confort nocturne pour l'enfant" },
      { nom: "Calendrier de progrès/motivation", type: "accessoire", cat: "Accompagnement", prio: 50, just: "Renforcement positif pour la prise de conscience" },
    ],
  },
  // ---- PROCTOLOGIE ----
  {
    pathologie: "Fissure anale",
    conseils: [
      { code: "FISS_C1", label: "Augmenter les apports en fibres", desc: "Fibres solubles pour des selles plus molles et réduire la douleur à la défécation" },
      { code: "FISS_C2", label: "Réaliser des bains de siège tièdes", desc: "Bains de siège 10-15 min après chaque selle pour détendre le sphincter" },
    ],
    produits: [
      { nom: "Crème cicatrisante anale", type: "otc", cat: "Proctologie", prio: 90, just: "Cicatrisation et protection de la muqueuse anale" },
      { nom: "Laxatif osmotique doux (Macrogol type)", type: "otc", cat: "Transit", prio: 70, just: "Ramollissement des selles pour réduire le traumatisme" },
      { nom: "Lingettes hygiène intime apaisantes", type: "dermo_cosmetique", cat: "Hygiène", prio: 50, just: "Nettoyage doux sans irritation de la zone fragilisée" },
    ],
  },
  // ---- RHUMATOLOGIE / DOULEUR ----
  {
    pathologie: "Douleurs articulaires légères",
    conseils: [
      { code: "DART_C1", label: "Maintenir une activité physique douce", desc: "Marche, natation, vélo pour entretenir la mobilité articulaire" },
      { code: "DART_C2", label: "Appliquer du froid en cas de poussée inflammatoire", desc: "Poche de glace 15 min pour réduire l'inflammation locale" },
    ],
    produits: [
      { nom: "Gel anti-inflammatoire local (diclofénac)", type: "otc", cat: "AINS topique", prio: 90, just: "Action anti-inflammatoire locale ciblée" },
      { nom: "Chondroïtine + Glucosamine gélules", type: "complement", cat: "Confort articulaire", prio: 70, just: "Protection du cartilage, réduction de la dégradation" },
      { nom: "Bande de contention articulaire", type: "dispositif_medical", cat: "Orthopédie", prio: 50, just: "Soutien mécanique de l'articulation douloureuse" },
    ],
  },
  {
    pathologie: "Entorse",
    conseils: [
      { code: "ENTR_C1", label: "Appliquer le protocole RICE", desc: "Repos, Ice (glace), Compression, Élévation dans les 48 premières heures" },
      { code: "ENTR_C2", label: "Ne pas forcer sur l'articulation", desc: "Repos relatif, éviter l'appui complet jusqu'à diminution de la douleur" },
    ],
    produits: [
      { nom: "Poche de froid réutilisable", type: "dispositif_medical", cat: "Froid thérapeutique", prio: 90, just: "Réduction de l'œdème et de la douleur en phase aiguë" },
      { nom: "Bande élastique de contention", type: "dispositif_medical", cat: "Contention", prio: 70, just: "Compression et stabilisation de l'articulation" },
      { nom: "Gel anti-inflammatoire local", type: "otc", cat: "AINS topique", prio: 50, just: "Soulagement anti-inflammatoire local complémentaire" },
    ],
  },
  {
    pathologie: "Fibromyalgie",
    conseils: [
      { code: "FIBR_C1", label: "Pratiquer une activité physique régulière adaptée", desc: "Exercice progressif (marche, yoga, aquagym) pour réduire la douleur" },
      { code: "FIBR_C2", label: "Favoriser un sommeil de qualité", desc: "Routine de coucher régulière, environnement calme et sombre" },
    ],
    produits: [
      { nom: "Magnésium marin haute absorption", type: "complement", cat: "Magnésium", prio: 90, just: "Réduction des douleurs musculaires et de la fatigue" },
      { nom: "Crème de massage musculaire", type: "dermo_cosmetique", cat: "Soin musculaire", prio: 70, just: "Massage décontractant des zones douloureuses" },
      { nom: "Mélatonine sommeil", type: "complement", cat: "Sommeil", prio: 50, just: "Amélioration du sommeil souvent perturbé dans la fibromyalgie" },
    ],
  },
  {
    pathologie: "Lombalgie",
    conseils: [
      { code: "LOMB_C1", label: "Rester actif autant que possible", desc: "Le repos prolongé aggrave la lombalgie, bouger aide à la récupération" },
      { code: "LOMB_C2", label: "Adopter de bonnes postures", desc: "Ergonomie au travail, port de charges avec les jambes" },
    ],
    produits: [
      { nom: "Patch chauffant dos (12h)", type: "dispositif_medical", cat: "Thermothérapie", prio: 90, just: "Chaleur continue pour décontraction musculaire prolongée" },
      { nom: "Gel anti-inflammatoire local", type: "otc", cat: "AINS topique", prio: 70, just: "Soulagement anti-inflammatoire ciblé sur la zone lombaire" },
      { nom: "Ceinture lombaire de maintien", type: "dispositif_medical", cat: "Orthopédie", prio: 50, just: "Soutien mécanique temporaire en phase douloureuse" },
    ],
  },
  {
    pathologie: "Sciatique",
    conseils: [
      { code: "SCIA_C1", label: "Éviter la position assise prolongée", desc: "Alterner assis/debout, marcher régulièrement pour soulager la compression" },
      { code: "SCIA_C2", label: "Étirements doux du dos et des ischio-jambiers", desc: "Étirements progressifs pour libérer la tension sur le nerf sciatique" },
    ],
    produits: [
      { nom: "Anti-inflammatoire oral OTC (ibuprofène)", type: "otc", cat: "AINS", prio: 90, just: "Réduction de l'inflammation compressive sur le nerf" },
      { nom: "Patch chauffant lombaire", type: "dispositif_medical", cat: "Thermothérapie", prio: 70, just: "Décontraction musculaire de la zone concernée" },
      { nom: "Coussin ergonomique coccyx", type: "dispositif_medical", cat: "Ergonomie", prio: 50, just: "Soulagement de la pression en position assise" },
    ],
  },
  {
    pathologie: "Torticolis",
    conseils: [
      { code: "TORT_C1", label: "Appliquer de la chaleur sur la zone", desc: "Bouillotte ou patch chauffant pour décontraction musculaire" },
      { code: "TORT_C2", label: "Mobiliser doucement le cou", desc: "Mouvements lents et progressifs pour éviter l'enraidissement" },
    ],
    produits: [
      { nom: "Patch chauffant nuque", type: "dispositif_medical", cat: "Thermothérapie", prio: 90, just: "Chaleur ciblée pour décontraction du trapèze et du cou" },
      { nom: "Gel décontractant musculaire", type: "otc", cat: "Myorelaxant topique", prio: 70, just: "Soulagement local de la contracture cervicale" },
      { nom: "Oreiller ergonomique cervical", type: "dispositif_medical", cat: "Ergonomie", prio: 50, just: "Prévention des récidives par un bon maintien cervical nocturne" },
    ],
  },
  {
    pathologie: "Tendinite",
    conseils: [
      { code: "TEND_C1", label: "Mettre au repos le tendon concerné", desc: "Repos relatif, éviter les mouvements répétitifs déclencheurs" },
      { code: "TEND_C2", label: "Appliquer du froid après l'effort", desc: "Glacer 15 min pour réduire l'inflammation tendineuse" },
    ],
    produits: [
      { nom: "Gel anti-inflammatoire local (kétoprofène)", type: "otc", cat: "AINS topique", prio: 90, just: "Pénétration cutanée efficace sur les tendons superficiels" },
      { nom: "Bande de strapping", type: "dispositif_medical", cat: "Contention", prio: 70, just: "Immobilisation partielle et soulagement mécanique" },
      { nom: "Poche de froid réutilisable", type: "dispositif_medical", cat: "Cryothérapie", prio: 50, just: "Réduction de l'inflammation post-effort" },
    ],
  },
  {
    pathologie: "Spasmes musculaires",
    conseils: [
      { code: "SPAS_C1", label: "S'hydrater suffisamment", desc: "La déshydratation est une cause fréquente de crampes et spasmes" },
      { code: "SPAS_C2", label: "Étirer le muscle en douceur", desc: "Étirement progressif pour relâcher la contraction involontaire" },
    ],
    produits: [
      { nom: "Magnésium marin + B6", type: "complement", cat: "Magnésium", prio: 90, just: "Correction de la carence en magnésium, cause fréquente de spasmes" },
      { nom: "Spray décontractant musculaire", type: "otc", cat: "Myorelaxant topique", prio: 70, just: "Soulagement rapide par voie locale" },
      { nom: "Bouillotte sèche micro-ondes", type: "dispositif_medical", cat: "Thermothérapie", prio: 50, just: "Chaleur douce pour relaxation musculaire" },
    ],
  },
  // ---- CARDIOLOGIE / VASCULAIRE ----
  {
    pathologie: "Insuffisance veineuse",
    conseils: [
      { code: "INSV_C1", label: "Surélever les jambes au repos", desc: "Favoriser le retour veineux en surélevant les jambes 15 cm" },
      { code: "INSV_C2", label: "Éviter la station debout prolongée", desc: "Marcher régulièrement et éviter les positions statiques prolongées" },
    ],
    produits: [
      { nom: "Bas de contention classe 2", type: "dispositif_medical", cat: "Contention veineuse", prio: 90, just: "Compression graduée pour améliorer le retour veineux" },
      { nom: "Veinotonique oral (Diosmine type)", type: "otc", cat: "Phlébotrope", prio: 70, just: "Renforcement du tonus veineux et réduction de l'œdème" },
      { nom: "Gel fraîcheur jambes légères", type: "dermo_cosmetique", cat: "Confort veineux", prio: 50, just: "Soulagement immédiat de la sensation de lourdeur" },
    ],
  },
  {
    pathologie: "Varices",
    conseils: [
      { code: "VARI_C1", label: "Porter des bas de contention adaptés", desc: "Compression quotidienne pour limiter la progression des varices" },
      { code: "VARI_C2", label: "Pratiquer la marche quotidienne", desc: "Activation de la pompe musculaire du mollet pour le retour veineux" },
    ],
    produits: [
      { nom: "Bas de contention classe 2", type: "dispositif_medical", cat: "Contention veineuse", prio: 90, just: "Traitement de base de l'insuffisance veineuse variqueuse" },
      { nom: "Veinotonique diosmine/hespéridine", type: "otc", cat: "Phlébotrope", prio: 70, just: "Réduction de l'œdème et des symptômes veineux" },
      { nom: "Crème apaisante jambes lourdes", type: "dermo_cosmetique", cat: "Confort veineux", prio: 50, just: "Hydratation et fraîcheur pour les jambes fatiguées" },
    ],
  },
  // ---- NEUROLOGIE / PSYCHIATRIE ----
  {
    pathologie: "Anxiété",
    conseils: [
      { code: "ANXI_C1", label: "Pratiquer la respiration abdominale", desc: "Respiration lente et profonde pour activer le système parasympathique" },
      { code: "ANXI_C2", label: "Limiter la caféine et les excitants", desc: "Café, thé fort, boissons énergisantes augmentent l'anxiété" },
    ],
    produits: [
      { nom: "Magnésium marin + B6", type: "complement", cat: "Magnésium", prio: 90, just: "Réduction de l'excitabilité neuromusculaire" },
      { nom: "Passiflore gélules ou tisane", type: "phytotherapie", cat: "Anxiolytique naturel", prio: 70, just: "Effet sédatif léger, utilisé traditionnellement contre l'anxiété" },
      { nom: "Spray relaxant aux huiles essentielles (lavande)", type: "aromatherapie", cat: "Relaxation", prio: 50, just: "Effet calmant olfactif favorisant la détente" },
    ],
  },
  {
    pathologie: "Insomnie",
    conseils: [
      { code: "INSO_C1", label: "Maintenir des horaires de coucher réguliers", desc: "Se coucher et se lever à la même heure pour réguler le rythme circadien" },
      { code: "INSO_C2", label: "Éviter les écrans 1h avant le coucher", desc: "La lumière bleue perturbe la sécrétion de mélatonine" },
    ],
    produits: [
      { nom: "Mélatonine 1.9mg", type: "complement", cat: "Sommeil", prio: 90, just: "Régulation du cycle veille-sommeil, endormissement facilité" },
      { nom: "Valériane gélules", type: "phytotherapie", cat: "Sommeil", prio: 70, just: "Effet sédatif doux pour améliorer la qualité du sommeil" },
      { nom: "Spray oreiller lavande", type: "aromatherapie", cat: "Relaxation", prio: 50, just: "Ambiance apaisante pour favoriser l'endormissement" },
    ],
  },
  {
    pathologie: "Vertiges",
    conseils: [
      { code: "VERT_C1", label: "S'asseoir ou s'allonger lors d'un épisode", desc: "Prévention des chutes, position stable le temps que le vertige passe" },
      { code: "VERT_C2", label: "Éviter les mouvements brusques de la tête", desc: "Mouvements lents et contrôlés pour limiter les déclenchements" },
    ],
    produits: [
      { nom: "Gingembre gélules anti-nauséeux", type: "phytotherapie", cat: "Anti-vertigineux", prio: 90, just: "Réduction des nausées et vertiges, bonne tolérance" },
      { nom: "Magnésium marin", type: "complement", cat: "Équilibre nerveux", prio: 70, just: "Soutien du système nerveux vestibulaire" },
      { nom: "Bracelet anti-nausées acupression", type: "dispositif_medical", cat: "Anti-nausées", prio: 50, just: "Stimulation du point P6 pour réduire les nausées associées" },
    ],
  },
  // ---- GYNÉCOLOGIE ----
  {
    pathologie: "Allaitement complémentation",
    conseils: [
      { code: "ALLA_C1", label: "Maintenir une alimentation variée et équilibrée", desc: "Besoins nutritionnels accrus pendant l'allaitement" },
      { code: "ALLA_C2", label: "S'hydrater abondamment", desc: "Au moins 2L d'eau par jour pour soutenir la production de lait" },
    ],
    produits: [
      { nom: "Compléments post-nataux (fer + acide folique + DHA)", type: "complement", cat: "Compléments grossesse", prio: 90, just: "Couverture des besoins nutritionnels accrus pendant l'allaitement" },
      { nom: "Crème mamelons lanoline", type: "dermo_cosmetique", cat: "Soin allaitement", prio: 70, just: "Protection et cicatrisation des mamelons crevassés" },
      { nom: "Tisane allaitement (fenouil/anis)", type: "phytotherapie", cat: "Lactation", prio: 50, just: "Soutien traditionnel de la lactation" },
    ],
  },
  {
    pathologie: "Ménopause troubles",
    conseils: [
      { code: "MENO_C1", label: "Maintenir une activité physique régulière", desc: "Exercice pour réduire bouffées de chaleur et préserver la densité osseuse" },
      { code: "MENO_C2", label: "Adopter une alimentation riche en calcium", desc: "Produits laitiers, légumes verts pour prévenir l'ostéoporose" },
    ],
    produits: [
      { nom: "Isoflavones de soja / Trèfle rouge", type: "complement", cat: "Phytoestrogènes", prio: 90, just: "Réduction naturelle des bouffées de chaleur" },
      { nom: "Calcium + Vitamine D3", type: "complement", cat: "Os", prio: 70, just: "Prévention de la perte osseuse post-ménopausique" },
      { nom: "Gel hydratant intime", type: "dispositif_medical", cat: "Confort intime", prio: 50, just: "Soulagement de la sécheresse vaginale fréquente" },
    ],
  },
  // ---- NUTRITION / CARENCE ----
  {
    pathologie: "Carence en vitamine B12",
    conseils: [
      { code: "B12_C1", label: "Vérifier les apports alimentaires en B12", desc: "Viande, poisson, œufs, produits laitiers sont les sources principales" },
      { code: "B12_C2", label: "Consulter si régime végétalien", desc: "La supplémentation est indispensable en cas de régime sans produits animaux" },
    ],
    produits: [
      { nom: "Vitamine B12 méthylcobalamine sublingual", type: "complement", cat: "Vitamines", prio: 90, just: "Forme active à absorption rapide" },
      { nom: "Complexe vitamines B", type: "complement", cat: "Vitamines", prio: 70, just: "Synergie des vitamines B pour métabolisme optimal" },
      { nom: "Spiruline comprimés", type: "complement", cat: "Superaliment", prio: 50, just: "Source naturelle complémentaire de vitamines B et fer" },
    ],
  },
  {
    pathologie: "Anémie ferriprive",
    conseils: [
      { code: "ANEM_C1", label: "Prendre le fer à jeun avec de la vitamine C", desc: "La vitamine C améliore l'absorption du fer de 30 à 60%" },
      { code: "ANEM_C2", label: "Espacer la prise de fer des produits laitiers et du thé", desc: "Calcium et tanins inhibent l'absorption du fer" },
    ],
    produits: [
      { nom: "Fer bisglycinate gélules", type: "complement", cat: "Fer", prio: 90, just: "Forme de fer la mieux tolérée au niveau digestif" },
      { nom: "Vitamine C 500mg", type: "complement", cat: "Vitamines", prio: 70, just: "Potentialisation de l'absorption du fer" },
      { nom: "Spiruline riche en fer", type: "complement", cat: "Superaliment", prio: 50, just: "Apport complémentaire naturel en fer et B12" },
    ],
  },
  {
    pathologie: "Fatigue",
    conseils: [
      { code: "FATI_C1", label: "Dormir suffisamment (7-9h)", desc: "Respecter les besoins en sommeil pour permettre la récupération" },
      { code: "FATI_C2", label: "Vérifier les carences (fer, vitamine D, B12)", desc: "Un bilan sanguin peut révéler une cause traitable de fatigue" },
    ],
    produits: [
      { nom: "Magnésium marin + B6", type: "complement", cat: "Énergie", prio: 90, just: "Réduction de la fatigue, soutien du métabolisme énergétique" },
      { nom: "Gelée royale fraîche", type: "complement", cat: "Vitalité", prio: 70, just: "Stimulant naturel, riche en nutriments essentiels" },
      { nom: "Vitamine C 1000mg", type: "complement", cat: "Énergie", prio: 50, just: "Stimulation des défenses et réduction de la fatigue" },
    ],
  },
  // ---- PÉDIATRIE ----
  {
    pathologie: "Érythème fessier",
    conseils: [
      { code: "ERYF_C1", label: "Changer la couche fréquemment", desc: "Limiter le contact prolongé avec l'urine et les selles" },
      { code: "ERYF_C2", label: "Laisser les fesses à l'air libre", desc: "Moments sans couche pour favoriser la cicatrisation" },
    ],
    produits: [
      { nom: "Pâte à l'eau protectrice", type: "dermo_cosmetique", cat: "Soin bébé", prio: 90, just: "Barrière protectrice contre l'humidité et les irritants" },
      { nom: "Liniment oléo-calcaire", type: "dermo_cosmetique", cat: "Nettoyant bébé", prio: 70, just: "Nettoyage doux et nourrissant à chaque change" },
      { nom: "Crème réparatrice cuivre-zinc", type: "dermo_cosmetique", cat: "Cicatrisation", prio: 50, just: "Favorise la réparation cutanée, action antibactérienne" },
    ],
  },
  {
    pathologie: "Poussées dentaires",
    conseils: [
      { code: "POUS_C1", label: "Proposer un anneau de dentition réfrigéré", desc: "Le froid soulage la douleur gingivale" },
      { code: "POUS_C2", label: "Masser doucement les gencives", desc: "Avec un doigt propre ou une compresse humide" },
    ],
    produits: [
      { nom: "Gel gingival apaisant bébé", type: "otc", cat: "Douleur dentaire", prio: 90, just: "Application locale pour soulager les gencives" },
      { nom: "Anneau de dentition réfrigérant", type: "dispositif_medical", cat: "Dentition", prio: 70, just: "Froid antalgique naturel sur les gencives" },
      { nom: "Granules homéopathiques Chamomilla", type: "homeopathie", cat: "Poussées dentaires", prio: 50, just: "Utilisé traditionnellement pour l'inconfort dentaire du nourrisson" },
    ],
  },
  // ---- ORL ----
  {
    pathologie: "Laryngite",
    conseils: [
      { code: "LARY_C1", label: "Mettre la voix au repos", desc: "Éviter de forcer sur les cordes vocales, chuchoter aggrave parfois" },
      { code: "LARY_C2", label: "Humidifier l'air ambiant", desc: "L'air sec aggrave l'irritation laryngée" },
    ],
    produits: [
      { nom: "Pastilles gorge émollientes (miel/propolis)", type: "otc", cat: "ORL", prio: 90, just: "Adoucissement du larynx et soulagement de la douleur" },
      { nom: "Spray gorge antiseptique", type: "otc", cat: "ORL", prio: 70, just: "Action antiseptique et anti-inflammatoire locale" },
      { nom: "Miel de Manuka", type: "complement", cat: "Apithérapie", prio: 50, just: "Propriétés antibactériennes et adoucissantes naturelles" },
    ],
  },
  {
    pathologie: "Sinusite",
    conseils: [
      { code: "SINU_C1", label: "Faire des lavages nasaux abondants", desc: "Irrigation au sérum physiologique ou spray eau de mer hypertonique" },
      { code: "SINU_C2", label: "Inhaler de la vapeur d'eau", desc: "Inhalations chaudes avec quelques gouttes d'huile essentielle d'eucalyptus" },
    ],
    produits: [
      { nom: "Spray nasal eau de mer hypertonique", type: "dispositif_medical", cat: "ORL", prio: 90, just: "Décongestion nasale naturelle par effet osmotique" },
      { nom: "Inhalateur à vapeur", type: "dispositif_medical", cat: "ORL", prio: 70, just: "Fluidification des sécrétions sinusales" },
      { nom: "Comprimés à base de pelargonium", type: "phytotherapie", cat: "ORL", prio: 50, just: "Efficacité démontrée dans les sinusites aiguës" },
    ],
  },
  {
    pathologie: "Otite",
    conseils: [
      { code: "OTIT_C1", label: "Ne pas introduire d'objet dans l'oreille", desc: "Éviter cotons-tiges et tout objet qui pourrait aggraver l'otite" },
      { code: "OTIT_C2", label: "Appliquer de la chaleur sur l'oreille", desc: "Bouillotte tiède contre l'oreille pour soulager la douleur" },
    ],
    produits: [
      { nom: "Antalgique oral (paracétamol/ibuprofène)", type: "otc", cat: "Douleur", prio: 90, just: "Gestion de la douleur en première intention" },
      { nom: "Spray auriculaire hygiène", type: "dispositif_medical", cat: "ORL", prio: 70, just: "Nettoyage doux du conduit auditif externe" },
      { nom: "Solution antiseptique auriculaire OTC", type: "otc", cat: "ORL", prio: 50, just: "Antisepsie complémentaire du conduit" },
    ],
  },
  {
    pathologie: "Sécheresse nasale",
    conseils: [
      { code: "SECN_C1", label: "Humidifier l'air intérieur", desc: "Utiliser un humidificateur, surtout en période de chauffage" },
      { code: "SECN_C2", label: "Éviter de se moucher trop fort", desc: "Mouchage doux pour ne pas irriter davantage la muqueuse" },
    ],
    produits: [
      { nom: "Spray nasal au sérum physiologique", type: "dispositif_medical", cat: "Hygiène nasale", prio: 90, just: "Hydratation et nettoyage de la muqueuse nasale sèche" },
      { nom: "Pommade nasale hydratante", type: "dispositif_medical", cat: "Soin nasal", prio: 70, just: "Protection et restauration de la muqueuse desséchée" },
      { nom: "Sérum physiologique unidoses", type: "dispositif_medical", cat: "Hygiène nasale", prio: 50, just: "Lavage nasal quotidien pratique et stérile" },
    ],
  },
  {
    pathologie: "Rhinopharyngite",
    conseils: [
      { code: "RHIN_C1", label: "Lavage nasal fréquent au sérum physiologique", desc: "3-4 fois/jour pour désencombrer les voies nasales" },
      { code: "RHIN_C2", label: "Repos et hydratation", desc: "Boissons chaudes, repos pour favoriser la guérison" },
    ],
    produits: [
      { nom: "Spray eau de mer isotonique", type: "dispositif_medical", cat: "ORL", prio: 90, just: "Nettoyage et hydratation des fosses nasales" },
      { nom: "Pastilles gorge miel-citron", type: "otc", cat: "ORL", prio: 70, just: "Soulagement de l'irritation pharyngée associée" },
      { nom: "Vitamine C 500mg", type: "complement", cat: "Immunité", prio: 50, just: "Soutien des défenses immunitaires" },
    ],
  },
  // ---- DIVERS ----
  {
    pathologie: "Allergie alimentaire",
    conseils: [
      { code: "ALAL_C1", label: "Identifier et exclure l'allergène alimentaire", desc: "Tenir un journal alimentaire pour repérer les aliments déclencheurs" },
      { code: "ALAL_C2", label: "Lire systématiquement les étiquettes", desc: "Vérifier la présence d'allergènes dans les produits transformés" },
    ],
    produits: [
      { nom: "Antihistaminique oral OTC (cétirizine)", type: "otc", cat: "Antihistaminique", prio: 90, just: "Prise en charge des symptômes allergiques légers" },
      { nom: "Probiotiques anti-allergiques", type: "complement", cat: "Probiotiques", prio: 70, just: "Modulation de la réponse immunitaire intestinale" },
      { nom: "Crème apaisante anti-prurit", type: "dermo_cosmetique", cat: "Anti-prurit", prio: 50, just: "Soulagement des manifestations cutanées allergiques" },
    ],
  },
  {
    pathologie: "Piqûre d insecte",
    conseils: [
      { code: "PIQI_C1", label: "Désinfecter la zone de piqûre", desc: "Nettoyage à l'eau savonneuse puis antiseptique" },
      { code: "PIQI_C2", label: "Appliquer du froid", desc: "Glaçon enveloppé 10 min pour limiter le gonflement et la douleur" },
    ],
    produits: [
      { nom: "Crème anti-démangeaisons (hydrocortisone)", type: "otc", cat: "Anti-prurit", prio: 90, just: "Soulagement rapide du prurit et de l'inflammation locale" },
      { nom: "Roll-on apaisant après-piqûre", type: "dermo_cosmetique", cat: "Après-piqûre", prio: 70, just: "Application ciblée et rafraîchissante sur la piqûre" },
      { nom: "Spray répulsif insectes", type: "otc", cat: "Prévention", prio: 50, just: "Protection préventive contre les nouvelles piqûres" },
    ],
  },
  {
    pathologie: "Poux",
    conseils: [
      { code: "POUX_C1", label: "Traiter toute la famille simultanément", desc: "Vérifier et traiter les contacts proches pour éviter la réinfestation" },
      { code: "POUX_C2", label: "Laver la literie et les bonnets à 60°C", desc: "Élimination des poux et lentes sur les textiles" },
    ],
    produits: [
      { nom: "Traitement anti-poux diméticone", type: "dispositif_medical", cat: "Anti-parasitaire", prio: 90, just: "Action mécanique par étouffement, sans insecticide" },
      { nom: "Peigne anti-poux métallique", type: "dispositif_medical", cat: "Anti-parasitaire", prio: 70, just: "Élimination mécanique des lentes, indispensable" },
      { nom: "Spray préventif anti-poux", type: "dispositif_medical", cat: "Prévention", prio: 50, just: "Protection quotidienne en période d'épidémie scolaire" },
    ],
  },
  {
    pathologie: "Verrue",
    conseils: [
      { code: "VERR_C1", label: "Ne pas gratter ni arracher la verrue", desc: "Risque de dissémination du virus HPV et d'infection" },
      { code: "VERR_C2", label: "Protéger la verrue dans les espaces humides", desc: "Port de chaussettes en piscine, ne pas marcher pieds nus" },
    ],
    produits: [
      { nom: "Solution kératolytique acide salicylique", type: "otc", cat: "Traitement verrues", prio: 90, just: "Destruction progressive de la verrue par kératolyse" },
      { nom: "Cryothérapie en spray OTC", type: "otc", cat: "Traitement verrues", prio: 70, just: "Destruction par le froid, alternative au kératolytique" },
      { nom: "Pansements protecteurs verrues", type: "dispositif_medical", cat: "Protection", prio: 50, just: "Protection de la verrue traitée et limitation de la contagion" },
    ],
  },
  {
    pathologie: "Vomissements",
    conseils: [
      { code: "VOMI_C1", label: "Réhydrater par petites gorgées fréquentes", desc: "Eau, bouillon, SRO par petites quantités toutes les 15 minutes" },
      { code: "VOMI_C2", label: "Reprendre l'alimentation progressivement", desc: "Aliments légers : riz, banane, compote, biscottes" },
    ],
    produits: [
      { nom: "Solution de réhydratation orale (SRO)", type: "otc", cat: "Réhydratation", prio: 90, just: "Compensation des pertes hydro-électrolytiques essentielles" },
      { nom: "Gingembre gélules anti-nauséeux", type: "phytotherapie", cat: "Anti-nausées", prio: 70, just: "Antiémétique naturel efficace et bien toléré" },
      { nom: "Bracelet anti-nausées acupression", type: "dispositif_medical", cat: "Anti-nausées", prio: 50, just: "Stimulation du point P6, sans médicament" },
    ],
  },
  {
    pathologie: "Zona",
    conseils: [
      { code: "ZONA_C1", label: "Ne pas gratter les vésicules", desc: "Risque de surinfection bactérienne et de cicatrices" },
      { code: "ZONA_C2", label: "Consulter rapidement en cas de zona ophtalmique", desc: "Zona autour de l'œil = urgence, risque de complications visuelles" },
    ],
    produits: [
      { nom: "Antiseptique cutané chlorhexidine", type: "otc", cat: "Antiseptique", prio: 90, just: "Prévention de la surinfection des vésicules" },
      { nom: "Pansements non adhérents stériles", type: "dispositif_medical", cat: "Pansement", prio: 70, just: "Protection des lésions sans arrachage" },
      { nom: "Crème cicatrisante post-lésionnelle", type: "dermo_cosmetique", cat: "Cicatrisation", prio: 50, just: "Favorise la réparation cutanée après la phase aiguë" },
    ],
  },
  {
    pathologie: "Déshydratation",
    conseils: [
      { code: "DESH_C1", label: "Boire par petites gorgées régulières", desc: "Réhydratation progressive pour éviter les vomissements" },
      { code: "DESH_C2", label: "Surveiller les signes de gravité", desc: "Pli cutané persistant, confusion, absence d'urine = urgence" },
    ],
    produits: [
      { nom: "Sachets SRO (solution de réhydratation orale)", type: "otc", cat: "Réhydratation", prio: 90, just: "Remplacement optimal des sels minéraux et du glucose" },
      { nom: "Eau enrichie en minéraux", type: "complement", cat: "Hydratation", prio: 70, just: "Apport complémentaire en sels minéraux" },
      { nom: "Probiotiques restauration flore", type: "complement", cat: "Probiotiques", prio: 50, just: "Restauration de la flore après épisode de déshydratation" },
    ],
  },
  {
    pathologie: "Goutte",
    conseils: [
      { code: "GOUT_C1", label: "Réduire la consommation d'alcool", desc: "La bière et les spiritueux augmentent l'uricémie" },
      { code: "GOUT_C2", label: "Boire au moins 2L d'eau par jour", desc: "L'hydratation favorise l'élimination de l'acide urique" },
    ],
    produits: [
      { nom: "Complément cerise noire / quercétine", type: "complement", cat: "Anti-uricémique naturel", prio: 90, just: "Réduction naturelle de l'acide urique" },
      { nom: "Gel anti-inflammatoire local", type: "otc", cat: "AINS topique", prio: 70, just: "Soulagement de l'inflammation articulaire locale" },
      { nom: "Poche de froid articulaire", type: "dispositif_medical", cat: "Cryothérapie", prio: 50, just: "Réduction rapide de l'inflammation en crise" },
    ],
  },
  // ---- MANQUANTES IMPORTANTES ----
  {
    pathologie: "Toux du fumeur",
    conseils: [
      { code: "TOUF_C1", label: "Envisager un sevrage tabagique", desc: "Le tabac est la cause principale, le sevrage est le traitement le plus efficace" },
      { code: "TOUF_C2", label: "Hydrater les voies respiratoires", desc: "Boissons chaudes, inhalations pour fluidifier les sécrétions" },
    ],
    produits: [
      { nom: "Pastilles gorge miel-propolis", type: "otc", cat: "ORL", prio: 90, just: "Adoucissement de la gorge irritée par la toux chronique" },
      { nom: "Sirop expectorant naturel (lierre/thym)", type: "phytotherapie", cat: "ORL", prio: 70, just: "Fluidification des sécrétions bronchiques" },
      { nom: "Substituts nicotiniques (gommes/pastilles)", type: "otc", cat: "Sevrage tabagique", prio: 50, just: "Aide au sevrage tabagique, traitement de la cause" },
    ],
  },
  {
    pathologie: "Transit lent",
    conseils: [
      { code: "TRAL_C1", label: "Augmenter les fibres alimentaires progressivement", desc: "Fruits, légumes, céréales complètes pour stimuler le péristaltisme" },
      { code: "TRAL_C2", label: "Boire au moins 1.5L d'eau par jour", desc: "L'hydratation ramollit les selles et facilite le transit" },
    ],
    produits: [
      { nom: "Psyllium blond mucilages", type: "complement", cat: "Fibres", prio: 90, just: "Laxatif de lest naturel, régulation douce du transit" },
      { nom: "Probiotiques transit (B. lactis)", type: "complement", cat: "Probiotiques", prio: 70, just: "Amélioration de la fréquence et consistance des selles" },
      { nom: "Pruneaux ou jus de pruneaux", type: "complement", cat: "Laxatif naturel", prio: 50, just: "Solution naturelle traditionnelle pour stimuler le transit" },
    ],
  },
  {
    pathologie: "Stress",
    conseils: [
      { code: "STRE_C1", label: "Pratiquer une activité de relaxation", desc: "Méditation, yoga, cohérence cardiaque pour gérer le stress" },
      { code: "STRE_C2", label: "Limiter les stimulants", desc: "Réduire café, alcool, écrans le soir" },
    ],
    produits: [
      { nom: "Magnésium marin + B6", type: "complement", cat: "Anti-stress", prio: 90, just: "Le magnésium est le minéral anti-stress de référence" },
      { nom: "Rhodiola rosea gélules", type: "phytotherapie", cat: "Adaptogène", prio: 70, just: "Plante adaptogène pour améliorer la résistance au stress" },
      { nom: "Huile essentielle lavande vraie", type: "aromatherapie", cat: "Relaxation", prio: 50, just: "Diffusion ou application pour effet calmant immédiat" },
    ],
  },
  {
    pathologie: "Vergetures",
    conseils: [
      { code: "VERG_C1", label: "Hydrater la peau quotidiennement", desc: "Application matin et soir d'une crème riche pour maintenir l'élasticité" },
      { code: "VERG_C2", label: "Éviter les variations de poids rapides", desc: "Les fluctuations brutales de poids favorisent l'apparition de vergetures" },
    ],
    produits: [
      { nom: "Huile anti-vergetures (amande douce/argan)", type: "dermo_cosmetique", cat: "Soin vergetures", prio: 90, just: "Prévention et atténuation par nutrition intense de la peau" },
      { nom: "Crème anti-vergetures (centella asiatica)", type: "dermo_cosmetique", cat: "Soin vergetures", prio: 70, just: "Stimulation de la production de collagène" },
      { nom: "Beurre de karité pur", type: "dermo_cosmetique", cat: "Hydratant", prio: 50, just: "Nutrition intense et souplesse de la peau" },
    ],
  },
  {
    pathologie: "Vieillissement cutané",
    conseils: [
      { code: "VIEI_C1", label: "Appliquer un écran solaire quotidien", desc: "Le soleil est le premier facteur de vieillissement cutané prématuré" },
      { code: "VIEI_C2", label: "Hydrater la peau matin et soir", desc: "Maintien de l'hydratation et de la souplesse cutanée" },
    ],
    produits: [
      { nom: "Sérum vitamine C antioxydant", type: "dermo_cosmetique", cat: "Anti-âge", prio: 90, just: "Protection antioxydante et stimulation de la production de collagène" },
      { nom: "Crème acide hyaluronique", type: "dermo_cosmetique", cat: "Anti-âge", prio: 70, just: "Hydratation profonde et comblement des rides" },
      { nom: "Collagène marin buvable", type: "complement", cat: "Anti-âge", prio: 50, just: "Soutien de la structure dermique de l'intérieur" },
    ],
  },
  {
    pathologie: "Ongles cassants",
    conseils: [
      { code: "ONGL_C1", label: "Protéger les mains avec des gants", desc: "Lors du ménage ou du jardinage pour éviter les agressions" },
      { code: "ONGL_C2", label: "Hydrater les ongles et les cuticules", desc: "Huile de ricin ou crème spécifique pour renforcer les ongles" },
    ],
    produits: [
      { nom: "Biotine (Vitamine B8) gélules", type: "complement", cat: "Ongles/Cheveux", prio: 90, just: "Renforcement de la kératine des ongles, efficacité démontrée" },
      { nom: "Vernis durcisseur ongles", type: "dermo_cosmetique", cat: "Soin ongles", prio: 70, just: "Protection mécanique et renforcement de la surface" },
      { nom: "Levure de bière gélules", type: "complement", cat: "Ongles/Cheveux", prio: 50, just: "Source naturelle de vitamines B pour la kératine" },
    ],
  },
  {
    pathologie: "Peau sèche et terne",
    conseils: [
      { code: "PSEC_C1", label: "Utiliser un nettoyant doux sans savon", desc: "Les savons classiques déshydratent la peau" },
      { code: "PSEC_C2", label: "Appliquer une crème hydratante après la douche", desc: "Sur peau encore légèrement humide pour sceller l'hydratation" },
    ],
    produits: [
      { nom: "Crème hydratante riche corps et visage", type: "dermo_cosmetique", cat: "Hydratant", prio: 90, just: "Restauration de la barrière cutanée et confort immédiat" },
      { nom: "Huile végétale nourrissante (jojoba/avocat)", type: "dermo_cosmetique", cat: "Nutrition cutanée", prio: 70, just: "Nutrition profonde pour peaux très sèches" },
      { nom: "Oméga 3 gélules", type: "complement", cat: "Peau", prio: 50, just: "Soutien de l'hydratation cutanée de l'intérieur" },
    ],
  },
  {
    pathologie: "Peau grasse",
    conseils: [
      { code: "PGRA_C1", label: "Ne pas décaper la peau", desc: "Les nettoyants agressifs stimulent la production de sébum par rebond" },
      { code: "PGRA_C2", label: "Hydrater avec une crème légère non comédogène", desc: "La peau grasse a aussi besoin d'hydratation" },
    ],
    produits: [
      { nom: "Gel nettoyant purifiant doux", type: "dermo_cosmetique", cat: "Nettoyant visage", prio: 90, just: "Nettoyage sans agression du film hydrolipidique" },
      { nom: "Crème matifiante non comédogène", type: "dermo_cosmetique", cat: "Soin visage", prio: 70, just: "Régulation du sébum et finition mate" },
      { nom: "Zinc gélules", type: "complement", cat: "Peau", prio: 50, just: "Régulation de la séborrhée par voie orale" },
    ],
  },
  {
    pathologie: "Rosacée",
    conseils: [
      { code: "ROSA_C1", label: "Éviter les facteurs déclenchants", desc: "Alcool, épices, exposition au froid/chaud brutal, stress" },
      { code: "ROSA_C2", label: "Utiliser un écran solaire haute protection", desc: "Le soleil aggrave la rosacée, SPF50 indispensable" },
    ],
    produits: [
      { nom: "Crème anti-rougeurs apaisante", type: "dermo_cosmetique", cat: "Anti-rougeurs", prio: 90, just: "Réduction des rougeurs et renforcement de la barrière cutanée" },
      { nom: "Eau thermale spray", type: "dermo_cosmetique", cat: "Apaisant", prio: 70, just: "Effet apaisant immédiat et anti-inflammatoire" },
      { nom: "Nettoyant micellaire peaux sensibles", type: "dermo_cosmetique", cat: "Nettoyant", prio: 50, just: "Nettoyage ultra-doux sans rinçage, adapté à la rosacée" },
    ],
  },
  {
    pathologie: "Surpoids",
    conseils: [
      { code: "SURP_C1", label: "Adopter une alimentation équilibrée", desc: "Privilégier fruits, légumes, protéines maigres, limiter les sucres" },
      { code: "SURP_C2", label: "Pratiquer 30 min d'activité physique par jour", desc: "Marche rapide, vélo, natation pour augmenter les dépenses énergétiques" },
    ],
    produits: [
      { nom: "Konjac coupe-faim gélules", type: "complement", cat: "Minceur", prio: 90, just: "Glucomannane qui gonfle dans l'estomac, effet satiétogène" },
      { nom: "Thé vert extrait standardisé", type: "phytotherapie", cat: "Brûleur", prio: 70, just: "Stimulation de la thermogenèse et de l'oxydation des graisses" },
      { nom: "Probiotiques métaboliques (L. gasseri)", type: "complement", cat: "Microbiote/Minceur", prio: 50, just: "Modulation du microbiote associé au métabolisme" },
    ],
  },
  {
    pathologie: "Rétention d eau",
    conseils: [
      { code: "RETE_C1", label: "Réduire les apports en sel", desc: "Le sel favorise la rétention hydrique" },
      { code: "RETE_C2", label: "Surélever les jambes en fin de journée", desc: "Favorise le drainage et réduit les gonflements" },
    ],
    produits: [
      { nom: "Queue de cerise tisane/gélules", type: "phytotherapie", cat: "Draineur", prio: 90, just: "Diurétique naturel doux, traditionnel" },
      { nom: "Piloselle extrait", type: "phytotherapie", cat: "Draineur", prio: 70, just: "Stimulation de l'élimination rénale" },
      { nom: "Bas de contention légère", type: "dispositif_medical", cat: "Contention", prio: 50, just: "Compression pour réduire les œdèmes des membres inférieurs" },
    ],
  },
  {
    pathologie: "Performance sportive",
    conseils: [
      { code: "PERF_C1", label: "S'hydrater avant, pendant et après l'effort", desc: "Eau et boissons isotoniques pour maintenir les performances" },
      { code: "PERF_C2", label: "Adapter l'alimentation à l'entraînement", desc: "Glucides complexes avant, protéines après l'effort" },
    ],
    produits: [
      { nom: "Boisson isotonique/électrolytes", type: "complement", cat: "Sport", prio: 90, just: "Compensation des pertes minérales et énergétiques" },
      { nom: "Protéines whey / récupération", type: "complement", cat: "Sport", prio: 70, just: "Récupération musculaire optimale post-effort" },
      { nom: "Magnésium + potassium", type: "complement", cat: "Anti-crampes", prio: 50, just: "Prévention des crampes et contractures musculaires" },
    ],
  },
  {
    pathologie: "Mémoire et cognition",
    conseils: [
      { code: "MEMO_C1", label: "Stimuler le cerveau quotidiennement", desc: "Lecture, jeux de mémoire, apprentissage pour entretenir les fonctions cognitives" },
      { code: "MEMO_C2", label: "Dormir suffisamment", desc: "Le sommeil est essentiel à la consolidation de la mémoire" },
    ],
    produits: [
      { nom: "Ginkgo biloba extrait standardisé", type: "phytotherapie", cat: "Cognition", prio: 90, just: "Amélioration de la microcirculation cérébrale" },
      { nom: "Oméga 3 DHA haute concentration", type: "complement", cat: "Cerveau", prio: 70, just: "DHA essentiel pour la structure et la fonction neuronale" },
      { nom: "Bacopa monnieri gélules", type: "phytotherapie", cat: "Cognition", prio: 50, just: "Plante nootrope traditionnelle pour la mémoire" },
    ],
  },
  {
    pathologie: "Spasmophilie",
    conseils: [
      { code: "SPMO_C1", label: "Apprendre la respiration abdominale", desc: "Contrôle de l'hyperventilation qui aggrave les symptômes" },
      { code: "SPMO_C2", label: "Réduire les sources de stress", desc: "Le stress est le principal déclencheur des crises" },
    ],
    produits: [
      { nom: "Magnésium marin haute dose + B6", type: "complement", cat: "Magnésium", prio: 90, just: "Correction de la carence en magnésium, base du traitement" },
      { nom: "Calcium + Vitamine D", type: "complement", cat: "Minéraux", prio: 70, just: "Rôle dans l'excitabilité neuromusculaire" },
      { nom: "Passiflore gélules", type: "phytotherapie", cat: "Relaxation", prio: 50, just: "Effet sédatif léger pour réduire l'anxiété associée" },
    ],
  },
];

// ============================================================
// MEDICAMENT -> PATHOLOGIE MAPPINGS
// ============================================================
const MED_PATHO_MAPPINGS: Record<string, string[]> = {
  "Gaviscon suspension": ["brûlures d'estomac", "reflux gastro-œsophagien léger", "Brûlures d estomac"],
  "Gavisconell menthe": ["brûlures d'estomac", "reflux gastro-œsophagien léger", "Brûlures d estomac"],
  "Acérola 1000": ["fatigue passagère", "Immunité faible", "Prévention hivernale"],
  "Acérola 1000 Arkopharma": ["fatigue passagère", "Immunité faible", "Prévention hivernale"],
  "Actifed Rhume": ["Rhume", "Congestion nasale", "Rhinopharyngite"],
  "Actisoufre": ["Rhinopharyngite", "Sinusite", "Rhume"],
  "Aldactone 25mg": ["Hypertension artérielle", "Insuffisance cardiaque", "Rétention d eau"],
  "Alphagan": ["Glaucome"],
  "Alvityl Vitalité": ["fatigue passagère", "Convalescence", "Immunité faible"],
  "Amlor 5mg": ["Hypertension artérielle"],
  "Amoxicilline Biogaran 1g": ["Angine", "Otite", "Sinusite", "Infection bactérienne", "Bronchite aiguë"],
  "Anafranil": ["Dépression", "Anxiété", "TOC"],
  "Apranax 550mg": ["Douleur modérée", "douleurs musculaires", "Règles douloureuses", "Arthrose"],
  "Aprovel 150mg": ["Hypertension artérielle"],
  "Arkogélules Valériane": ["insomnie légère", "Troubles du sommeil légers", "Anxiété légère"],
  "Arkorelax Sommeil Fort": ["insomnie légère", "Troubles du sommeil légers", "Décalage horaire"],
  "Aspirine UPSA 1000mg": ["Douleur légère", "Fièvre", "Céphalées", "maux de tête légers"],
  "Atacand 8mg": ["Hypertension artérielle"],
  "Atarax 25mg": ["Anxiété", "Urticaire", "Prurit", "insomnie légère"],
  "Atrovent": ["BPCO", "Asthme"],
  "Augmentin 1g/125mg": ["Angine", "Otite", "Sinusite", "Infection bactérienne", "Bronchite aiguë"],
  "Avamys": ["Rhinite allergique", "Allergie saisonnière", "Congestion nasale"],
  "Avodart": ["Hypertrophie bénigne de prostate"],
  "Bactrim Forte": ["Infection urinaire", "Cystite", "Infection bactérienne"],
  "Bepanthen": ["Érythème fessier", "Cicatrice", "irritation cutanée légère"],
  "Berocca Performance": ["fatigue passagère", "Convalescence", "Troubles de la concentration"],
  "Biafine": ["Brûlure légère", "Coup de soleil"],
  "Bion 3 Défense": ["Immunité faible", "Prévention hivernale", "fatigue passagère"],
  "Bioprotus 7000": ["Dysbiose intestinale", "Diarrhée aiguë", "Immunité faible"],
  "Boldoflorine": ["Détox hépatique", "Transit lent", "Constipation"],
  "Boswellia Solgar": ["Douleurs articulaires légères", "Arthrose"],
  "Carbolevure": ["Ballonnements", "Flatulences", "Diarrhée aiguë"],
  "Cardensiel 10mg": ["Hypertension artérielle", "Insuffisance cardiaque"],
  "Cardensiel 2.5mg": ["Hypertension artérielle", "Insuffisance cardiaque"],
  "Cardensiel 5mg": ["Hypertension artérielle", "Insuffisance cardiaque"],
  "Champix": ["Sevrage tabagique"],
  "Charbon Belloc": ["Ballonnements", "Flatulences"],
  "Charbon de Belloc": ["Ballonnements", "Flatulences"],
  "Chibro-Proscar 5mg": ["Hypertrophie bénigne de prostate"],
  "Chlorella Bio Flamant Vert": ["Détox hépatique", "Immunité faible"],
  "Chondro-Aid Fort": ["Arthrose", "Douleurs articulaires légères"],
  "Chronodorm Mélatonine": ["insomnie légère", "Troubles du sommeil légers", "Décalage horaire"],
  "Circadin 2mg": ["insomnie légère", "Troubles du sommeil légers"],
  "Circulation Vigne Rouge Arkopharma": ["Jambes lourdes", "Insuffisance veineuse", "Varices"],
  "Clarityne 10mg": ["Allergie saisonnière", "Rhinite allergique", "Urticaire"],
  "Coenzyme Q10 Solgar": ["fatigue passagère", "Performance sportive", "Vieillissement cutané"],
  "Colchimax": ["Goutte"],
  "Collagène Marin": ["Vieillissement cutané", "Douleurs articulaires légères", "Arthrose"],
  "CoQ10 100mg": ["fatigue passagère", "Performance sportive"],
  "Cordarone 200mg": ["Fibrillation auriculaire", "Tachycardie"],
  "Cortancyl 20mg": ["Inflammation", "Allergie saisonnière", "Asthme"],
  "Cortisédermyl": ["Eczéma léger", "irritation cutanée légère", "Dermatite de contact"],
  "Coversyl 10mg": ["Hypertension artérielle"],
  "Coversyl 5mg": ["Hypertension artérielle"],
  "Cozaar 50mg": ["Hypertension artérielle"],
  "Crestor 10mg": ["Hypercholestérolémie"],
  "Curcuma Piperine": ["Inflammation", "Douleurs articulaires légères", "Arthrose"],
  "Cyclo 3 Fort": ["Jambes lourdes", "Insuffisance veineuse", "Hémorroïdes"],
  "Cymbalta 60mg": ["Dépression", "Douleur neuropathique", "Fibromyalgie"],
  "Cys-Control": ["Cystite", "Cystite récidivante", "Infection urinaire récidivante"],
  "Cystine B6": ["Chute de cheveux", "Ongles cassants"],
  "D-Cure 25000": ["Carence en vitamine D", "Ostéoporose"],
  "D-Stress Synergia": ["Stress", "Anxiété légère", "Spasmophilie"],
  "Daflon 500mg": ["Jambes lourdes", "Hémorroïdes", "Insuffisance veineuse"],
  "Dafalgan 1g": ["Douleur légère", "Fièvre", "Céphalées", "maux de tête légers"],
  "Décontractyl": ["Spasmes musculaires", "Torticolis", "Lombalgie"],
  "Dermoval": ["Psoriasis", "Eczéma"],
  "Desloratadine Mylan 5mg": ["Allergie saisonnière", "Rhinite allergique", "Urticaire"],
  "Diclofénac gel 1%": ["douleurs musculaires", "Douleur articulaire", "Entorse", "Tendinite"],
  "Doliprane 1000mg": ["Douleur légère", "Fièvre", "Céphalées", "maux de tête légers"],
  "Domperidone 10mg": ["Nausées", "nausées simples", "Vomissements"],
  "Donormyl 15mg": ["insomnie légère", "Troubles du sommeil légers"],
  "Drill Miel Rosat": ["Maux de gorge", "Angine"],
  "Drill pastilles": ["Maux de gorge", "Angine", "Laryngite"],
  "Dulcolax 5mg": ["Constipation", "constipation occasionnelle"],
  "Duphalac": ["Constipation", "constipation occasionnelle", "Transit lent"],
  "Econazole crème": ["Mycose cutanée", "mycose superficielle", "Candidose vaginale"],
  "Efferalgan 1g": ["Douleur légère", "Fièvre", "Céphalées"],
  "Eludril Bain de Bouche": ["Gingivite", "Aphtes"],
  "Euphon pastilles": ["Maux de gorge", "Toux sèche", "Laryngite"],
  "Euphrasia collyre": ["Conjonctivite allergique", "Sécheresse oculaire"],
  "Euphytose": ["Anxiété légère", "Stress", "insomnie légère"],
  "Euvanol spray": ["Congestion nasale", "Rhume"],
  "Exomuc 200mg": ["Toux grasse", "Bronchite aiguë"],
  "Flector Tissugel": ["douleurs musculaires", "Douleur articulaire", "Entorse", "Tendinite"],
  "Fluimucil 200mg": ["Toux grasse", "Bronchite aiguë"],
  "Forlax 10g": ["Constipation", "constipation occasionnelle", "Transit lent"],
  "Fucidine crème": ["Impétigo", "irritation cutanée légère"],
  "Fungizone buvable": ["Candidose buccale"],
  "Gaviscon suspension": ["brûlures d'estomac", "reflux gastro-œsophagien léger", "Brûlures d estomac", "Gastrite"],
  "Gavisconell menthe": ["brûlures d'estomac", "reflux gastro-œsophagien léger", "Brûlures d estomac", "Gastrite"],
  "Gelox suspension": ["brûlures d'estomac", "Gastrite"],
  "Ginkgo Biloba Arkopharma": ["Mémoire et cognition", "Jambes lourdes", "Vertiges"],
  "Glucosamine Chondroïtine": ["Arthrose", "Douleurs articulaires légères"],
  "Granions de Zinc": ["Acné", "Immunité faible", "Peau grasse"],
  "Harpagophytum gélules": ["Douleurs articulaires légères", "Arthrose", "Lombalgie"],
  "Hépar eau minérale": ["Constipation", "Transit lent"],
  "Homéogène 9": ["Maux de gorge", "Laryngite"],
  "Homéoplasmine": ["irritation cutanée légère", "Sécheresse nasale"],
  "Humex Mal de Gorge": ["Maux de gorge", "Angine"],
  "Humex Rhume": ["Rhume", "Congestion nasale"],
  "Humex Toux Sèche": ["Toux sèche"],
  "Hylak Forte": ["Dysbiose intestinale", "Ballonnements"],
  "Ibuprofène 400mg": ["Douleur modérée", "douleurs musculaires", "Fièvre", "Règles douloureuses"],
  "Imodium 2mg": ["Diarrhée aiguë", "diarrhée aiguë simple", "Gastro-entérite"],
  "Imodiumcaps 2mg": ["Diarrhée aiguë", "diarrhée aiguë simple"],
  "Inexium 20mg": ["reflux gastro-œsophagien léger", "Gastrite", "brûlures d'estomac"],
  "Innéov Densilogy": ["Chute de cheveux"],
  "Jouvence de l Abbé Soury": ["Jambes lourdes", "Insuffisance veineuse"],
  "Kétoprofène gel 2.5%": ["douleurs musculaires", "Tendinite", "Entorse"],
  "Lactibiane référence": ["Dysbiose intestinale", "Diarrhée aiguë", "Immunité faible"],
  "Lansoyl gel": ["Constipation", "Fissure anale"],
  "Lévothyrox": ["Hypothyroïdie"],
  "Lexomil": ["Anxiété", "Insomnie"],
  "Loperamide 2mg": ["Diarrhée aiguë", "diarrhée aiguë simple", "Gastro-entérite"],
  "Lyrica": ["Douleur neuropathique"],
  "Lysopaine": ["Maux de gorge", "Angine"],
  "Maalox maux d'estomac": ["brûlures d'estomac", "Gastrite", "reflux gastro-œsophagien léger"],
  "Mag 2": ["Spasmes musculaires", "Crampes musculaires", "Stress", "Spasmophilie", "fatigue passagère"],
  "Magné B6": ["Spasmes musculaires", "Crampes musculaires", "Stress", "fatigue passagère"],
  "Magne B6 Fort": ["Spasmes musculaires", "fatigue passagère", "Stress"],
  "Maxilase": ["Maux de gorge", "Angine"],
  "Mercurochrome solution": ["irritation cutanée légère", "Piqûre d'insecte"],
  "Meteospasmyl": ["Ballonnements", "Flatulences", "Crampes abdominales", "Syndrome du côlon irritable"],
  "Metformine 500mg": ["Diabète type 2"],
  "Monuril 3g": ["Cystite", "Infection urinaire"],
  "Motilium 10mg": ["Nausées", "nausées simples", "Vomissements"],
  "Movicol": ["Constipation", "constipation occasionnelle", "Transit lent"],
  "Mucomyst 200mg": ["Toux grasse", "Bronchite aiguë"],
  "Mycohydralin": ["Candidose vaginale", "Mycose cutanée"],
  "Nasonex": ["Rhinite allergique", "Congestion nasale", "Sinusite"],
  "Nautamine": ["Mal des transports", "Nausées"],
  "Neurobion B1-B6-B12": ["Douleur neuropathique", "fatigue passagère"],
  "Nicorette gommes": ["Sevrage tabagique"],
  "Nicorette patchs": ["Sevrage tabagique"],
  "Nicopatch": ["Sevrage tabagique"],
  "Nifuroxazide 200mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Novalac Transit": ["Constipation"],
  "Nurofenflash 400mg": ["Douleur modérée", "douleurs musculaires", "Règles douloureuses", "Céphalées"],
  "Nurofen 400mg": ["Douleur modérée", "douleurs musculaires", "Fièvre", "Céphalées"],
  "Oligobs Grossesse": ["Grossesse complémentation", "Grossesse"],
  "Oméprazole 20mg": ["reflux gastro-œsophagien léger", "Gastrite", "brûlures d'estomac"],
  "Onagre huile gélules": ["Syndrome prémenstruel", "Peau sèche et terne", "Eczéma léger"],
  "Orelox": ["Otite", "Sinusite", "Angine"],
  "Oscillococcinum": ["Grippe", "Prévention hivernale"],
  "Pantoprazole 20mg": ["reflux gastro-œsophagien léger", "Gastrite", "brûlures d'estomac"],
  "Paracétamol 500mg": ["Douleur légère", "Fièvre"],
  "Parasidose": ["Pédiculose", "Poux"],
  "Pediakid Immuno-Fort": ["Immunité faible", "Prévention hivernale"],
  "Percutalgine gel": ["douleurs musculaires", "Tendinite"],
  "PhysioCalm collyre": ["Sécheresse oculaire", "Conjonctivite allergique"],
  "Piascledine 300": ["Arthrose", "Douleurs articulaires légères"],
  "Pileje Lactibiane": ["Dysbiose intestinale"],
  "Plantain gélules": ["Allergie saisonnière", "Toux sèche"],
  "Pouxit": ["Pédiculose", "Poux"],
  "Primpéran": ["Nausées", "Vomissements"],
  "Prospan sirop": ["Toux grasse", "Bronchite aiguë"],
  "Pyostacine": ["Angine", "Sinusite", "Infection bactérienne"],
  "Rennies": ["brûlures d'estomac", "Gastrite"],
  "Rhinadvil": ["Rhume", "Congestion nasale", "Sinusite"],
  "Smecta": ["Diarrhée aiguë", "diarrhée aiguë simple", "Gastro-entérite"],
  "Solupred 20mg": ["Inflammation", "Allergie saisonnière", "Asthme"],
  "Spasfon": ["Crampes abdominales", "Règles douloureuses", "Coliques du nourrisson"],
  "Spasfon Lyoc": ["Crampes abdominales", "Règles douloureuses"],
  "Spiruline Bio": ["fatigue passagère", "Anémie ferriprive", "Performance sportive", "Immunité faible"],
  "Stérimar spray": ["Rhume", "Congestion nasale", "Sécheresse nasale", "Rhinopharyngite"],
  "Stresam": ["Anxiété", "Stress"],
  "Strepsils": ["Maux de gorge", "Angine"],
  "Subutex": ["Dépression"],
  "Tardyferon": ["Anémie ferriprive", "Carence en fer"],
  "Tiorfan 100mg": ["Diarrhée aiguë", "Gastro-entérite"],
  "Toplexil sirop": ["Toux sèche"],
  "Tramadol 50mg": ["Douleur modérée"],
  "Traumapaed gel": ["Entorse", "douleurs musculaires"],
  "Ultra-Levure": ["Diarrhée aiguë", "Dysbiose intestinale", "Gastro-entérite"],
  "Uvestérol D": ["Carence en vitamine D"],
  "Valériane Arkogélules": ["insomnie légère", "Anxiété légère"],
  "Ventoline": ["Asthme"],
  "Vicks Vaporub": ["Rhume", "Congestion nasale", "Toux grasse"],
  "Vitamine D3 1000UI": ["Carence en vitamine D", "Ostéoporose", "Immunité faible"],
  "Voltarène Emulgel": ["douleurs musculaires", "Douleur articulaire", "Entorse", "Tendinite"],
  "Xyzall 5mg": ["Allergie saisonnière", "Rhinite allergique", "Urticaire"],
  "ZMA (Zinc Magnésium)": ["Performance sportive", "fatigue passagère", "Crampes musculaires"],
  "Zyma D 10000": ["Carence en vitamine D"],
  "Zyrtec 10mg": ["Allergie saisonnière", "Rhinite allergique", "Urticaire"],
  "Zymad 80000": ["Carence en vitamine D", "Ostéoporose"],
  // Acid Hyaluronique, probiotics, etc
  "Acide Hyaluronique 200mg": ["Vieillissement cutané", "Douleurs articulaires légères"],
  "Magnésium Marin B6": ["fatigue passagère", "Stress", "Crampes musculaires", "Spasmes musculaires"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders }

  // ── Admin auth guard ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminCheckClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminCheckClient.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stats = {
      protocoles_created: 0,
      conseils_created: 0,
      produits_created: 0,
      med_patho_links: 0,
      errors: [] as string[],
    };

    // Load existing pathologies
    const { data: allPathologies } = await supabase.from("pathologies").select("id, nom_pathologie");
    const pathMap = new Map<string, string>();
    for (const p of allPathologies || []) {
      pathMap.set(p.nom_pathologie.toLowerCase(), p.id);
    }

    // Load existing medicaments  
    const { data: allMeds } = await supabase.from("medicaments").select("id, nom_commercial");
    const medMap = new Map<string, string>();
    for (const m of allMeds || []) {
      medMap.set(m.nom_commercial, m.id);
    }

    // ============================================
    // STEP 1: Create protocols for missing pathologies
    // ============================================
    for (const proto of PROTOCOLES_COMPLETS) {
      const pathId = pathMap.get(proto.pathologie.toLowerCase());
      if (!pathId) {
        stats.errors.push(`Pathologie not found: ${proto.pathologie}`);
        continue;
      }

      // Check if protocol already exists
      const { data: existing } = await supabase
        .from("protocole_pathologie")
        .select("id")
        .eq("pathologie_id", pathId)
        .eq("actif", true)
        .maybeSingle();

      if (existing) continue; // Already has a protocol

      // Upsert conseils
      const conseilIds: string[] = [];
      for (const c of proto.conseils) {
        const { data: existingC } = await supabase
          .from("conseils_associes")
          .select("id")
          .eq("pathologie_id", pathId)
          .eq("conseil_code", c.code)
          .maybeSingle();

        if (existingC) {
          conseilIds.push(existingC.id);
        } else {
          const { data: newC } = await supabase
            .from("conseils_associes")
            .insert({
              pathologie_id: pathId,
              conseil_code: c.code,
              conseil: c.label,
              description: c.desc,
              priorite: conseilIds.length === 0 ? 90 : 70,
            })
            .select("id")
            .single();
          if (newC) {
            conseilIds.push(newC.id);
            stats.conseils_created++;
          }
        }
      }

      // Upsert produits
      const produitIds: string[] = [];
      for (const p of proto.produits) {
        const { data: existingP } = await supabase
          .from("produits_complementaires")
          .select("id")
          .eq("pathologie_id", pathId)
          .ilike("produit", `%${p.nom.substring(0, 20)}%`)
          .maybeSingle();

        if (existingP) {
          produitIds.push(existingP.id);
        } else {
          const { data: newP } = await supabase
            .from("produits_complementaires")
            .insert({
              pathologie_id: pathId,
              produit: p.nom,
              nom_produit: p.nom,
              type_produit: p.type,
              categorie: p.cat,
              priorite: p.prio,
              est_otc: p.type === "otc",
              est_complement: p.type === "complement" || p.type === "phytotherapie",
              est_dispositif_medical: p.type === "dispositif_medical",
              est_eligible_cross_sell: true,
            })
            .select("id")
            .single();
          if (newP) {
            produitIds.push(newP.id);
            stats.produits_created++;
          }
        }
      }

      // Create protocol if we have 2 conseils + 3 produits
      if (conseilIds.length >= 2 && produitIds.length >= 3) {
        const { error } = await supabase.from("protocole_pathologie").insert({
          pathologie_id: pathId,
          conseil_1_id: conseilIds[0],
          conseil_2_id: conseilIds[1],
          produit_complementaire_1_id: produitIds[0],
          produit_complementaire_2_id: produitIds[1],
          produit_complementaire_3_id: produitIds[2],
          justification_1: proto.produits[0].just,
          justification_2: proto.produits[1].just,
          justification_3: proto.produits[2].just,
          priorite_produit_1: proto.produits[0].prio,
          priorite_produit_2: proto.produits[1].prio,
          priorite_produit_3: proto.produits[2].prio,
          actif: true,
          version_protocole: 1,
        });
        if (!error) stats.protocoles_created++;
        else stats.errors.push(`Proto ${proto.pathologie}: ${error.message}`);
      } else {
        stats.errors.push(`Incomplete data for ${proto.pathologie}: ${conseilIds.length} conseils, ${produitIds.length} produits`);
      }
    }

    // ============================================
    // STEP 2: Link medicaments to pathologies
    // ============================================
    for (const [medName, pathologies] of Object.entries(MED_PATHO_MAPPINGS)) {
      const medId = medMap.get(medName);
      if (!medId) continue;

      for (const pathName of pathologies) {
        const pathId = pathMap.get(pathName.toLowerCase());
        if (!pathId) continue;

        // Check if link exists
        const { data: existingLink } = await supabase
          .from("medicament_pathologie")
          .select("id")
          .eq("medicament_id", medId)
          .eq("pathologie_id", pathId)
          .maybeSingle();

        if (!existingLink) {
          const { error } = await supabase.from("medicament_pathologie").insert({
            medicament_id: medId,
            pathologie_id: pathId,
            score_pertinence: 80,
            source_mapping: "phase4_seed",
          });
          if (!error) stats.med_patho_links++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Phase 4 complete: ${stats.protocoles_created} protocoles, ${stats.conseils_created} conseils, ${stats.produits_created} produits, ${stats.med_patho_links} med-patho links`,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
