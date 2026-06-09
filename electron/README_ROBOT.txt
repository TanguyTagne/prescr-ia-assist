ASCLION — INTERCEPTION ROBOT AUTOMATE
======================================

Asclion peut intercepter les délivrances envoyées par le LGO à un robot
automate (Rowa, Pharmathek, Knapp, Swisslog, BD, Tosho…) et déclencher
le widget de recommandations sur tous les postes de la pharmacie.

Tout se configure depuis Paramètres › "Robot automate". Aucun fichier
n'est à éditer à la main.


1. ARCHITECTURE
---------------

  ┌──────────┐   TCP    ┌────────────────────┐   HTTP POST     ┌────────────────┐
  │   LGO    │ ───────► │  Asclion (PC robot)│ ──────────────► │ Asclion (caisse)│
  └──────────┘  port    │  - sniffer Npcap   │  /trigger {ean} │ - listener 5150 │
                9876    │  - ou TCP listen   │                 │ - pipeline scan │
                        └────────────────────┘                 └────────────────┘

  Le PC déclaré "serveur robot" intercepte le trafic TCP destiné au robot,
  extrait le code EAN/CIP du payload via un adaptateur dédié à la marque
  du robot, puis POSTe ce code à chaque PC Asclion de la pharmacie sur
  son listener HTTP local (port 5150 par défaut).


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
     (À demander à l'éditeur du LGO ou à voir dans sa configuration.)

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


6. LISTENER HTTP (TOUS LES PCS)
-------------------------------

  Tous les postes Asclion exposent automatiquement :

  - POST http://<ip>:5150/trigger
        { "ean": "3400936081349" }
        → injecte le code dans le pipeline de scan (widget, log, etc.)

  - GET  http://<ip>:5150/health
        → { "status": "ok", "ip": "...", "version": "...", "port": 5150 }

  Port modifiable dans Paramètres › Robot automate › "Port HTTP".

  Le pare-feu Windows demande l'autorisation au premier lancement.
  Accepter "Réseaux privés".


7. MISE À JOUR DE L'APP
-----------------------

  Asclion utilise electron-updater : la nouvelle version est téléchargée
  silencieusement en arrière-plan, et appliquée au redémarrage suivant
  (typiquement le lendemain matin à l'ouverture de la pharmacie). Aucune
  intervention manuelle requise. La configuration robot et LGO est
  conservée à travers les mises à jour.


8. DÉPANNAGE
------------

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
