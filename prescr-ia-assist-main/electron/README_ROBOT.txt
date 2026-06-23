ASCLION — INTERCEPTION ROBOT AUTOMATE & GUIDE D'UTILISATION
============================================================

Asclion peut intercepter les délivrances envoyées par le LGO à un robot
automate (Rowa, Pharmathek, Knapp, Swisslog, BD, Tosho…) et déclencher
le widget de recommandations sur tous les postes de la pharmacie.

Tout se configure depuis Paramètres › "Robot automate". Aucun fichier
n'est à éditer à la main.

★ NOUVEAU — ASSISTANT DE CONNEXION (recommandé)
   Paramètres › Robot automate › bouton "Assistant de connexion au robot".
   Il remplace, en façade, les deux anciens boutons ("Rechercher" le port et
   "Diagnostic robot (PC serveur)"), désormais regroupés sous "Avancé — outils
   manuels".

   En un parcours guidé, l'assistant :
     1. lance la découverte réseau et propose 2-3 chemins possibles
        (IP + port TCP, ou Named Pipe) classés par score de confiance ;
     2. te laisse en sélectionner un et l'enregistrer ;
     3. te demande de faire une VRAIE délivrance sur le LGO (fenêtre 60 s)
        pour confirmer le bon chemin LGO ↔ robot — et affiche le code capturé
        (WWKS2 / Omnicell inclus) ;
     4. passe automatiquement au candidat suivant si rien n'est capté.

   100 % PASSIF : la capture (WinDivert, sinon Npcap) observe le trafic sans
   jamais s'insérer entre le LGO et le robot. Le relais tcp-listen (MITM) est
   désactivé par défaut (robot.passiveOnly = true) — si Asclion s'arrête, le
   robot continue de recevoir ses ordres normalement.


SOMMAIRE
========

  1.   ARCHITECTURE
  2.   INSTALLATION DE NPCAP (mode sniffer passif)
  3.   MODE TCP-LISTEN (fallback sans Npcap)
  4.   MARQUES SUPPORTÉES NATIVEMENT
  4bis. RECHERCHE AUTOMATIQUE DU PORT
  5.   PROCÉDURE DIAGNOSTIQUE — marque inconnue
  6.   LISTENER HTTP (tous les PCs)
  7.   MISE À JOUR DE L'APP
  8.   DÉPANNAGE TECHNIQUE
  ─────────────────────────────────────────────────────
  GUIDE OPÉRATIONNEL — PARAMÈTRES ROBOT & SÉCURITÉ
  ─────────────────────────────────────────────────────
  9.   OÙ TROUVER LES PARAMÈTRES
  10.  ARCHITECTURE EN 1 PHRASE
  11.  CONFIGURATION DU PC SERVEUR (connecté au robot)
  12.  CONFIGURATION DES PCs CAISSE
  13.  RÉGÉNÉRER LE JETON PARTAGÉ
  14.  VÉRIFICATION QUE TOUT MARCHE
  15.  MODE DIAGNOSTIC EN PRATIQUE
  16.  RÉCAP DES PROTECTIONS DE SÉCURITÉ


1. ARCHITECTURE
---------------

  ┌──────────┐   TCP    ┌────────────────────┐   HTTP POST     ┌────────────────┐
  │   LGO    │ ───────► │  Asclion (PC robot)│ ──────────────► │ Asclion (caisse)│
  └──────────┘  port    │  - sniffer Npcap   │  /trigger {ean} │ - listener 5150 │
                9876    │  - ou TCP listen   │  + X-Asclion-   │ - pipeline scan │
                        │  - jeton partagé   │    Token        │ - jeton partagé │
                        └────────────────────┘                 └────────────────┘

  Le PC déclaré "serveur robot" intercepte le trafic TCP destiné au robot,
  extrait le code EAN/CIP du payload via un adaptateur dédié à la marque
  du robot, puis POSTe ce code à chaque PC Asclion de la pharmacie sur
  son listener HTTP local (port 5150 par défaut), authentifié par un
  jeton partagé.


2. INSTALLATION DE NPCAP (MODE SNIFFER PASSIF, RECOMMANDÉ)
----------------------------------------------------------

  Le mode sniffer ne modifie PAS le flux entre le LGO et le robot — il
  observe les paquets en passant. Le robot reçoit son trafic normalement,
  rien ne change pour le pharmacien.

  Étapes :

  a. Télécharger Npcap : https://npcap.com/dist/npcap-1.79.exe
     (ou version plus récente sur https://npcap.com/#download)

  b. Lancer l'installeur en tant qu'administrateur.

  c. Cocher : "Install Npcap in WinPcap API-compatible Mode".

  d. Décocher : "Restrict Npcap driver's access to Administrators only".
     (sinon Asclion ne pourra pas ouvrir l'interface réseau en mode user)

  e. Redémarrer Asclion. Dans Paramètres › Robot automate, le statut
     du sniffer doit passer en "npcap" après quelques secondes.

  Si Npcap n'est pas installé ou que la case d'admin est restée cochée,
  Asclion bascule automatiquement en mode TCP-listen (voir §3).


3. MODE TCP-LISTEN (FALLBACK SANS NPCAP)
----------------------------------------

  Asclion ouvre lui-même le port configuré et fait du man-in-the-middle
  transparent : le LGO doit être reconfiguré pour pointer vers l'IP du
  PC Asclion au lieu du robot. Asclion transmet ensuite les paquets au
  vrai robot en interne (à condition d'avoir renseigné targetIp dans
  asclion-robot-config.json).

  Inconvénient : si Asclion crashe, le robot ne reçoit plus rien jusqu'au
  redémarrage. Préférer Npcap dès que possible.

  Sécurité : la whitelist d'IPs configurée dans Paramètres limite les
  clients autorisés à se connecter au sniffer (voir §11.4).


4. MARQUES SUPPORTÉES NATIVEMENT
--------------------------------

  - Rowa / BD Rowa      port défaut 9876  -- XML <EAN>...</EAN>
  - Pharmathek          port défaut 6100  -- XML <ean>...</ean>
  - Générique           port à définir    -- regex utilisateur

  Quand on change de marque dans Paramètres, le port par défaut se
  pré-remplit automatiquement. Toute valeur saisie manuellement avant le
  changement de marque est conservée.

  Pour les autres robots (Knapp, Swisslog, Tosho…), utiliser le mode
  "Générique" et configurer le pattern regex correspondant. Le premier
  groupe capturant doit contenir l'EAN, par exemple :

      EAN>(\d{8,14})<
      barcode="(\d{8,14})"
      "code":"(\d{8,14})"

  Ports typiques par marque :

      Rowa / BD Rowa    9876
      Pharmathek        6100, 6200
      Knapp             5000, 12000
      Swisslog          8080, 9100
      Tosho             4444


4bis. RECHERCHE AUTOMATIQUE DU PORT
------------------------------------

  Si le port n'est pas connu, cliquer sur le bouton "Rechercher" à côté
  du champ Port TCP. Asclion exécute Get-NetTCPConnection en arrière-plan
  et liste toutes les connexions TCP établies depuis le PC.

  Les lignes sont triées par pertinence :

    1. Process reconnu comme LGO (winpharma, lgpi, pharmagest, leo,
       smartrx, leopharm)  -- surligné en couleur primaire avec le tag "LGO"
    2. Port distant qui match un port robot connu (9876, 6100, 5000, …)
       -- tag "port-robot"
    3. Tout le reste

  Cliquer sur la ligne qui correspond à la connexion LGO → robot
  remplit automatiquement le champ Port TCP. Pour avoir un résultat
  utile :

    a. La connexion doit être établie : lancer une délivrance de test
       au LGO juste avant de cliquer "Rechercher".
    b. Si la liste est vide, c'est que le LGO n'avait pas de connexion
       active à ce moment-là. Refaire un scan + cliquer "Rechercher"
       dans les secondes qui suivent.


5. PROCÉDURE DIAGNOSTIQUE — MARQUE INCONNUE
-------------------------------------------

  Si vous ne savez pas quel format le robot utilise :

  a. Dans Paramètres › Robot automate, choisir la marque "Diagnostic".

  b. Renseigner le port TCP utilisé par le LGO pour parler au robot.
     (À demander à l'éditeur du LGO ou à voir dans sa configuration,
      ou utiliser "Rechercher" — voir §4bis.)

  c. Cliquer "Enregistrer", puis effectuer 5 à 10 délivrances de test
     à la caisse.

  d. Récupérer le fichier de capture :

         %APPDATA%\Asclion\robot_capture.log

     (ou C:\Users\<NomUtilisateur>\AppData\Roaming\Asclion\robot_capture.log)

  e. L'envoyer au support Asclion. Une analyse du log permet d'écrire
     un nouvel adaptateur ou de fournir le regex à utiliser en mode
     "Générique".

  Le fichier est limité à 5 Mo, avec rotation quotidienne automatique.
  Les anciennes captures sont conservées sous robot_capture.<date>.log.

  PROTECTION RGPD : les NIR (n° sécu sociale), IBAN, emails, numéros de
  téléphone français et les balises XML <patient>, <nom>, <adresse>,
  <prenom> sont AUTOMATIQUEMENT remplacés par [REDACTED] avant écriture.
  Les EAN/CIP (8-14 chiffres) sont préservés volontairement — c'est tout
  l'objet de la capture.


6. LISTENER HTTP (TOUS LES PCS)
-------------------------------

  Tous les postes Asclion exposent automatiquement :

  - POST http://<ip>:5150/trigger
        Header : X-Asclion-Token: <jeton partagé>
        Body   : { "ean": "3400936081349" }
        → injecte le code dans le pipeline de scan (widget, log, etc.)

  - GET  http://<ip>:5150/health
        → { "status": "ok", "port": 5150 }

  Port modifiable dans Paramètres › Robot automate › "Port HTTP".

  Le listener écoute par défaut sur 127.0.0.1 (uniquement localhost).
  Il ne s'ouvre au LAN (0.0.0.0) que lorsque le switch "Mode serveur
  robot" est activé dans Paramètres, ET qu'un jeton partagé est défini.

  Le pare-feu Windows demande l'autorisation au premier lancement.
  Accepter "Réseaux privés".


7. MISE À JOUR DE L'APP
-----------------------

  Asclion utilise electron-updater : la nouvelle version est téléchargée
  silencieusement en arrière-plan, et appliquée au redémarrage suivant
  (typiquement le lendemain matin à l'ouverture de la pharmacie). Aucune
  intervention manuelle requise. La configuration robot et LGO est
  conservée à travers les mises à jour. Le jeton partagé est conservé.


8. DÉPANNAGE TECHNIQUE
----------------------

  - "Sniffer: idle" malgré Npcap installé
      → Vérifier que Npcap a été installé en mode "WinPcap-compatible"
        ET que la restriction admin n'est pas activée.

  - "Port HTTP: lastError: EADDRINUSE"
      → Un autre logiciel utilise le port 5150. Changer le port HTTP
        dans Paramètres et redémarrer.

  - Pas de déclenchement malgré la délivrance
      → Vérifier dans Paramètres › Robot automate la ligne
        "Listener : actif · Sniffer : <mode> · dernier EAN : <code>"
      → Si "dernier EAN" reste vide, le pattern ou la marque ne
        match pas le payload du robot. Passer en mode Diagnostic et
        suivre la procédure §5.

  - "Jeton refusé" sur un PC caisse lors du collage
      → Le jeton doit faire entre 24 et 128 caractères, uniquement
        alphanumérique + _ et -. Recopier proprement depuis le PC
        serveur, sans espace en début/fin.

  - PC caisse ne reçoit jamais rien malgré le jeton OK
      → Vérifier que le PC serveur a bien activé "Mode serveur robot"
        (sinon il bind 127.0.0.1 et n'envoie rien sur le LAN).
      → Vérifier que l'IP du PC caisse est dans la whitelist du PC
        serveur (ou que la whitelist est vide).
      → Vérifier pare-feu Windows + même sous-réseau.



===========================================================
GUIDE OPÉRATIONNEL — PARAMÈTRES ROBOT & SÉCURITÉ
===========================================================


9. OÙ TROUVER LES PARAMÈTRES
----------------------------

  Dans la fenêtre Asclion, cliquer sur l'icône engrenage en haut à
  droite (bouton "Settings"). Le dialogue Paramètres s'ouvre avec
  trois blocs :

    1. Robot automate  ← c'est ici que tout ce guide se passe
    2. Connexion LGO — Stocks
    3. Se déconnecter de ce poste


10. ARCHITECTURE EN 1 PHRASE
----------------------------

  UN seul PC est "serveur robot" (connecté au robot, intercepte le
  trafic, diffuse aux autres). TOUS les autres PCs sont "caisses"
  (reçoivent les notifications via le réseau local).


11. CONFIGURATION DU PC SERVEUR (connecté au robot)
----------------------------------------------------

  11.1. Activer le mode serveur robot
  -----------------------------------

    Cocher le switch "Mode serveur robot" → l'app va :

      - Démarrer le sniffer (Npcap ou TCP listen selon dispo)
      - Ouvrir le listener HTTP sur 0.0.0.0:5150 (au lieu de 127.0.0.1)
      - Exiger le jeton partagé pour toute notification entrante

  11.2. Configurer la marque + port
  ---------------------------------

    - Marque        → choisir Rowa / Pharmathek / Générique / Diagnostic
    - Port TCP du robot → soit pré-rempli automatiquement (9876 pour
                       Rowa, 6100 pour Pharmathek), soit cliquer
                       "Rechercher" pour scanner les connexions actives
                       et choisir celle du LGO (la ligne LGO sera
                       surlignée en bleu).
    - Pattern regex (Générique uniquement) → écrire un regex où le 1er
                       groupe capture l'EAN.
    - Sniffer Npcap → laisser coché si Npcap est installé (voir §2).

  11.3. Récupérer le jeton partagé
  --------------------------------

    Dans la section "Jeton partagé (sécurité)" :

      - Cliquer "Afficher" pour voir le jeton (par défaut masqué
        comme un mot de passe)
      - Cliquer "Copier" → le jeton est dans le presse-papier
      - Garder ce jeton, vous allez le coller sur chaque PC caisse à
        l'étape §12

  11.4. (Recommandé) Lister les IPs autorisées
  --------------------------------------------

    Dans la zone "IPs des PCs caisse autorisées", écrire l'IP de chaque
    PC de la pharmacie, UNE PAR LIGNE :

        192.168.1.10
        192.168.1.11
        192.168.1.12

    Si vide → tous les appareils du LAN peuvent se connecter au sniffer
    (déconseillé en pharmacie avec Wi-Fi guest ou réseau partagé).

    Pour trouver les IPs : ouvrir cmd.exe sur chaque PC et taper
    "ipconfig", ou consulter l'admin réseau / le routeur.

  11.5. Enregistrer
  -----------------

    Cliquer "Enregistrer". Le sniffer redémarre avec la nouvelle config.
    La ligne de statut tout en bas confirme :

        Listener 0.0.0.0 : actif · Sniffer : npcap · dernier EAN : —


12. CONFIGURATION DES PCs CAISSE
--------------------------------

  À faire UNE FOIS par PC caisse de la pharmacie.

  12.1. Désactiver le mode serveur robot
  ---------------------------------------

    DÉCOCHER le switch "Mode serveur robot". Ça :

      - Bind le listener sur 127.0.0.1 (sécurité par défaut)
      - Désactive le sniffer (pas besoin sur ces PCs)
      - Laisse quand même POST /trigger ouvert pour recevoir les
        notifications du PC serveur

  12.2. Coller le jeton du PC serveur
  -----------------------------------

    Dans la section "Jeton partagé" :

      - Cliquer "Coller depuis presse-papier" (le jeton du PC serveur
        doit y être — voir §11.3)
      - Toast vert "Jeton appliqué" = ça marche
      - Toast rouge "Jeton refusé" = le format est cassé (longueur,
        caractères) — recopier depuis le serveur

  12.3. Enregistrer
  -----------------

    Pas besoin de toucher au port TCP du robot — il ne sert pas ici.
    Juste "Enregistrer" pour valider l'état désactivé.


13. RÉGÉNÉRER LE JETON PARTAGÉ
------------------------------

  Quand le faire :

    - Suspicion de compromission (PC caisse volé, ex-employé qui
      pourrait avoir copié le jeton, etc.)
    - Audit de sécurité annuel — bonne pratique de rotation

  Sur le PC serveur, cliquer "Régénérer" (bouton rouge dans la section
  "Jeton partagé"). Confirmer dans la fenêtre.

  CONSÉQUENCE IMMÉDIATE : les autres PCs ne reçoivent plus rien tant que
  vous n'avez pas re-collé le nouveau jeton sur chacun d'eux (procédure
  §12.2).

  Il n'y a PAS de propagation automatique — c'est volontaire, pour
  garder le contrôle manuel et éviter une faille où une PC compromise
  pourrait pousser un nouveau jeton aux autres.


14. VÉRIFICATION QUE TOUT MARCHE
---------------------------------

  1. PC serveur : la ligne de statut affiche
       "Listener 0.0.0.0 : actif"

  2. PC caisse  : la ligne de statut affiche
       "Listener 127.0.0.1 : actif"

  3. Test live  : demander au robot une délivrance test
       → sur le PC serveur, le champ "dernier EAN" se met à jour
       → sur le PC caisse, le widget pop avec le médicament et ses PCs

  Si rien ne pop côté caisse :

    - Vérifier que le jeton est bien le même sur les 2 PCs (re-copier
      depuis le serveur, re-coller sur la caisse)
    - Vérifier que le pare-feu Windows autorise Asclion sur "Réseaux
      privés" (la 1ère fois, Windows pose la question — accepter)
    - Sur le PC serveur, ajouter l'IP du PC caisse dans "IPs autorisées"
      si elle n'y est pas
    - Vérifier que les deux PCs sont sur le même sous-réseau LAN


15. MODE DIAGNOSTIC EN PRATIQUE
-------------------------------

  Si le robot n'est ni Rowa ni Pharmathek et que vous ne connaissez pas
  le format :

    1. Choisir la marque "Diagnostic" dans le sélecteur
    2. Renseigner le port (utiliser "Rechercher" si besoin, voir §4bis)
    3. Cliquer "Enregistrer"
    4. Faire 5 à 10 délivrances de test au LGO
    5. Récupérer %APPDATA%\Asclion\robot_capture.log
       (les NIR, IBAN, emails, noms patients sont déjà masqués
        automatiquement — voir §5)
    6. Envoyer le log au support Asclion → ils écrivent un adaptateur
       ou fournissent un regex pour le mode Générique


16. RÉCAP DES PROTECTIONS DE SÉCURITÉ
--------------------------------------

  Protection                         Comment c'est géré
  ------------------------------------------------------------------
  Listener HTTP fermé au LAN         Switch "Mode serveur robot" OFF
  par défaut                         = bind 127.0.0.1

  Auth des notifications cross-PC    Jeton partagé 32 octets
                                     (256 bits d'entropie),
                                     comparé en constant-time

  Anti-spam triggers                 Rate limit 20 req/min/IP,
                                     payload max 4 KB

  Anti-MITM TCP                      Whitelist d'IPs sur le sniffer
                                     (configurable dans Paramètres)

  Anti-fuite PII (mode Diagnostic)   NIR, IBAN, emails, téléphones,
                                     balises <patient>/<nom>/<adresse>
                                     automatiquement remplacés par
                                     [REDACTED] avant écriture log

  Anti-RCE via lien web              shell.openExternal whitelist
                                     http: / https: / mailto:
                                     uniquement — tout autre scheme
                                     (javascript:, file://, ms-msdt:)
                                     bloqué et loggé

  Anti-XSS sur le jeton              Jeton jamais retourné par
                                     getConfig — uniquement via
                                     endpoint dédié getToken

  Anti-pop intrusif                  L'app passe au premier plan
                                     UNIQUEMENT si le médicament est
                                     reconnu ET qu'au moins un PC est
                                     suggéré. CIP inconnu = silence.
                                     Reconnu sans PC = silence.

  Tout est piloté depuis l'écran Paramètres — aucune édition manuelle
  de fichier requise. Les modifications prennent effet à la sauvegarde,
  sans redémarrage de l'app.
