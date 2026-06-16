# Tester le sous-système robot sans robot réel

Le robot Rowa parle **WWKS2 = XML sur une socket TCP**. On peut rejouer ça sur un
seul PC avec deux scripts Node (`dev-fake-robot.js`, `dev-fake-lgo.js`) et valider
le système à trois niveaux, du plus simple au plus représentatif.

| Niveau | Ce qu'on valide | Marche sur 1 seul PC ? |
|--------|-----------------|------------------------|
| 1 | Le bouton **Diagnostic robot (PC serveur)** : trouve port / IP / sens / loopback | ✅ Oui |
| 2 | **Extraction du code + widget** (backend `tcp-listen`) | ✅ Oui (loopback OK) |
| 3 | **Capture réelle WinDivert/Npcap** sur la carte réseau | ⚠️ Non — VM ou 2e PC |

Prérequis : deux terminaux, lancés **à la racine du repo**. Node est déjà là.

---

## Niveau 1 — Le bouton de diagnostic (Get-NetTCPConnection)

Valide la **détection**. Aucune capture réseau ici : on lit la table des connexions
TCP de Windows, donc tout marche en local, loopback compris.

### 1.a — Liaison permanente, port dédié (cas le plus courant)

```
# Terminal A : le robot écoute
node electron/scripts/dev-fake-robot.js --port 6050

# Terminal B : le LGO garde une connexion ouverte et envoie 20 ordres
node electron/scripts/dev-fake-lgo.js --port 6050 --persist --repeat 20 --interval 2000
```

Puis : **Paramètres → Diagnostic robot (PC serveur)** (ou lance directement
`asclion-server-diagnostic.ps1`).

Attendu : `CONNEXIONS ÉTABLIES` montre `127.0.0.1:6050` ; le `RÉSUMÉ` sort un
**CANDIDAT port=6050, sens inbound (ce PC = serveur)** + l'**avertissement loopback**.

### 1.b — Une connexion par délivrance (socket ré-ouverte à chaque ordre)

```
node electron/scripts/dev-fake-robot.js --port 6050
node electron/scripts/dev-fake-lgo.js --port 6050 --repeat 10 --interval 1500
```

Lance le diagnostic **pendant** l'envoi : la fenêtre affiche des lignes
`[NOUVEAU] …:6050` en temps réel (c'est la détection des sockets éphémères).

### 1.c — IP non-loopback (simule un vrai serveur sur le LAN)

Remplace `127.0.0.1` par ton IP LAN (ex. `192.168.1.50`) **des deux côtés** :

```
node electron/scripts/dev-fake-robot.js --host 192.168.1.50 --port 6050
node electron/scripts/dev-fake-lgo.js   --host 192.168.1.50 --port 6050 --persist --repeat 20 --interval 2000
```

Attendu : candidat `port=6050`, `IP serveur=192.168.1.50`, **pas** d'avertissement loopback.

### 1.d — Ports variés

Rejoue 1.a en changeant `--port` : `9876` (défaut Asclion), `6050` (fréquent WWKS2),
un port haut `51000` (vérifie que l'heuristique « port de service » choisit bien le
bon côté de la connexion).

---

## Niveau 2 — Pipeline extraction → widget (backend `tcp-listen`)

Valide que le code est bien **extrait du XML** puis que le **widget** s'affiche,
sans dépendre de WinDivert. En `tcp-listen`, **Asclion lui-même écoute** le port :
on n'a donc PAS besoin du faux robot, seulement du faux LGO qui pointe vers Asclion.

Dans Asclion (console DevTools, ou via l'UI) :

```js
electronAPI.robot.setConfig({ robot: { enabled: true, brand: "rowa", port: 6050, captureBackend: "tcp-listen" } })
```

Puis envoie un ordre vers Asclion :

```
node electron/scripts/dev-fake-lgo.js --port 6050 --format ean
```

Attendu : le widget pop avec le produit + ses PC.

Teste chaque format pour couvrir les variantes de l'adaptateur Rowa :

| `--format`     | Doit déclencher ? | Pourquoi |
|----------------|-------------------|----------|
| `ean`          | ✅ | `<EAN>…</EAN>` |
| `barcode`      | ✅ | `<Barcode>…</Barcode>` |
| `article-code` | ✅ | `<Article Code="…">` |
| `gtin`         | ✅ | `<GTIN>…</GTIN>` |
| `pzn`          | ✅ | `<PZN>…</PZN>` (Allemagne) |
| `wwks2`        | ❌ **non** | code dans les **attributs** `Article Id` / `Pack ScanCode` → l'adaptateur actuel ne les matche pas |
| `raw`          | ❌ non | chiffres bruts, test négatif |

> Le cas `wwks2` qui échoue est **voulu** : c'est le format le plus proche du réel.
> Il montre qu'il faudra élargir le regex Rowa (`Article Id="…"`, `Pack ScanCode="…"`)
> une fois qu'on aura capturé une vraie trame (voir Niveau 3 / `-Capture`).

Astuce sans matériel ni réseau : `electronAPI.scanner.injectScan("3400936081349")`
injecte un code directement dans le pipeline (teste juste le widget).

---

## Niveau 3 — Capture réelle WinDivert / Npcap

C'est le seul niveau qui valide la **capture passive** telle qu'en officine. Piège :
le trafic *same-host* (127.0.0.1 **et** même ta propre IP LAN) est routé en interne
par Windows et **ne traverse pas vraiment la carte réseau** → WinDivert/Npcap ne le
voit pas (ou mal). Il faut donc deux hôtes.

- **Option A — une VM** (VirtualBox/Hyper-V, réseau *bridged* ou *host-only*).
  Faux robot dans la VM, faux LGO sur l'hôte pointant vers l'IP de la VM (ou
  l'inverse). Installe Asclion du côté que tu veux tester.
- **Option B — un 2e PC** sur le même LAN.

Config Asclion (DevTools ou UI) :

```js
// Sur le PC SERVEUR du robot (reçoit les ordres) :
electronAPI.robot.setConfig({ robot: { enabled:true, brand:"rowa", port:6050, captureBackend:"windivert", captureDirection:"inbound" } })

// Sur un PC CAISSE (émet les ordres) :
electronAPI.robot.setConfig({ robot: { enabled:true, brand:"rowa", port:6050, captureBackend:"windivert", captureDirection:"outbound" } })
```

Depuis l'autre machine :

```
node electron/scripts/dev-fake-lgo.js --host <IP_DU_SERVEUR> --port 6050 --persist --repeat 5 --interval 3000 --format ean
```

Vérifie dans `Paramètres → Robot` (statut) : `packetsSeen` augmente, `lastEan` se
remplit, le widget pop. Si `captureDirection` est faux, `packetsSeen` reste à 0 →
c'est exactement le réglage que le Niveau 1 t'a donné.

> `captureDirection: "both"` est le réglage le plus tolérant si tu n'es pas sûr du
> sens — à privilégier en officine.

---

## Récap express

```
# Niveau 1 (détection) — liaison permanente
node electron/scripts/dev-fake-robot.js --port 6050
node electron/scripts/dev-fake-lgo.js   --port 6050 --persist --repeat 20 --interval 2000
#   → clique "Diagnostic robot (PC serveur)"

# Niveau 2 (extraction + widget) — Asclion en tcp-listen sur 6050
node electron/scripts/dev-fake-lgo.js   --port 6050 --format ean        # doit popper
node electron/scripts/dev-fake-lgo.js   --port 6050 --format wwks2      # ne doit PAS (gap regex attendu)

# Niveau 3 (capture réelle) — depuis une VM / 2e PC vers l'IP du serveur
node electron/scripts/dev-fake-lgo.js   --host <IP_SERVEUR> --port 6050 --persist --repeat 5 --interval 3000
```
