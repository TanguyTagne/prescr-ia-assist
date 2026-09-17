---
title: "RGPD et données de santé à l'officine : le point sur la pseudonymisation"
slug: "rgpd-donnees-officine"
description: "RGPD et officine : ce que dit le cadre sur les données de santé, anonymisation vs pseudonymisation, et comment Asclion conçoit sa surcouche."
date: 2026-10-02
category: "Outils & logiciels"
author: "Tanguy, fondateur d'Asclion"
essential:
  - "Les données de santé sont des données sensibles au sens du RGPD : leur traitement exige une base légale, des finalités précises et des mesures de protection renforcées."
  - "Deux notions clés, souvent confondues (CNIL) : l'anonymisation, processus irréversible qui rend les données hors RGPD, et la pseudonymisation, qui remplace les identifiants directs (nom, prénom) par des données indirectes (hash, numéro) — un processus réversible et donc toujours qualifié « données personnelles », mais qui réduit fortement les risques et que le RGPD encourage."
  - "Pour un outil de comptoir, la règle d'or : ne pas faire sortir de données identifiantes de l'officine."
faq:
  - q: "Un hash du patient, est-ce vraiment anonyme ?"
    a: "Non : c'est de la pseudonymisation. Les données restent personnelles et protégées par le RGPD — mais avec un risque fortement réduit, à condition de garder les clés séparées et protégées (CNIL)."
  - q: "Qui est responsable de traitement quand un copilote est installé ?"
    a: "L'officine reste responsable du traitement de ses données de délivrance ; l'éditeur agit comme sous-traitant (contrat, instructions documentées, sécurité). Le DPA doit être lisible et opposable — Asclion le publie."
  - q: "Un outil « sans stockage patient » est-il possible ?"
    a: "Oui : Asclion traite le CIP scanné et renvoie une suggestion ; seules des données anonymisées/pseudonymisées (statistiques d'usage, hash pour les rappels opt-in) transitent. C'est l'architecture à exiger de tout fournisseur."
relatedLinks:
  - { label: "Choisir son logiciel d'officine", href: "/blog/choisir-logiciel-officine" }
  - { label: "Copilote IA en officine : définition, usages, limites", href: "/blog/copilote-ia-officine" }
  - { label: "Lutter contre les invendus de parapharmacie sans casser le conseil", href: "/blog/invendus-stock-pharmacie" }
  - { label: "Découvrir Asclion", href: "/fonctionnalites" }
relatedPosts:
  - "copilote-ia-officine"
  - "invendus-stock-pharmacie"
---

# RGPD et données de santé à l'officine : le point sur la pseudonymisation

Entre la délivrance au comptoir et un outil connecté, une question revient toujours : que deviennent les données ? Rappel des notions RGPD utiles au comptoir, et des choix de conception qui font la différence.

## Ce qu'un outil de conseil doit (et ne doit pas) faire
1. Base légale claire pour chaque traitement, information des patients, durée de conservation définie.
2. Pseudonymisation par défaut : les patients ne sont identifiés en base que par des hasards anonymes — jamais de nom, jamais d'adresse.
3. Hébergement des données de santé conforme (HDS en France) quand des données de santé sont traitées côté serveur.
4. Contrôles d'accès : rôles gradués (préparateur = comptoir ; manager = KPI ; admin = configuration), authentification par requête, sécurité au niveau des lignes (row-level security).
5. Minimisation : ne pas remonter d'historique patient inutile au comptoir ; les statistiques restent agrégées et anonymisées (pour les groupements : insights agrégés sans accès aux données brutes).
6. Réversibilité encadrée : export, suppression, portabilité — l'officine reste maîtresse de ses données.

## Anonymisation ≠ pseudonymisation (tableau CNIL, simplifié)
- Anonymisation : irréversible ; les données ne sont plus personnelles ; le RGPD ne s'applique plus. Exige de vrais critères (pas de ré-identification par recoupement).
- Pseudonymisation : réversible avec information supplémentaire séparée et protégée ; les données restent personnelles, mais le risque est réduit — mesure encouragée par le RGPD.
- Cas pratique : un « hash patient anonymisé » pour programmer un SMS de rappel de fin de traitement = pseudonymisation : le rappel est possible, personne ne peut retrouver l'identité en base.

Sources : CNIL, « L'anonymisation de données personnelles » et fiches « Identifier les données personnelles » ; référentiels CNIL professionnels de santé (pseudonymisation ≠ anonymisation : effacer les noms ne suffit pas).

## 5 phrases prêtes à adapter (RGPD au comptoir)
1. « Aucune donnée patient identifiable ne sort de l'officine : c'est une exigence, pas une option. »
2. « Un hash anonyme, ce n'est pas de l'anonymat magique : c'est de la pseudonymisation, protégée et encadrée. »
3. « Le rappel SMS se fait en opt-in explicite, avec un identifiant qui ne dit aucun nom. »
4. « Vous restez responsable de traitement, nous sous-traitant : les rôles sont écrits, opposables. »
5. « Demandez à tout fournisseur la même chose : minimisation, rôles, sécurité documentée. »
