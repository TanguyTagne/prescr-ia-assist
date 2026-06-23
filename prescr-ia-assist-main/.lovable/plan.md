# Garantir la lecture des ordres LGO → robot

Aucune méthode unique ne couvre 100 % du parc. La seule façon d'**assurer** qu'on lit le message, c'est d'empiler plusieurs voies d'interception, classées par fiabilité, et de basculer automatiquement sur la suivante quand la précédente ne voit rien pendant une vraie délivrance. C'est exactement la logique de l'assistant actuel, mais incomplète sur 3 points.

## Hiérarchie des canaux à supporter (du plus fiable au plus universel)

```text
1. API/webhook officielle du LGO       ← 100 % fiable, 0 % invasif
2. Hook fichier / dossier "ordres"     ← très fiable (LGPI, certaines LEO)
3. Capture TCP WWKS2 (LAN, pas loopback) ← le cas "manuel" Omnicell/Rowa direct
4. Capture loopback LGO ↔ middleware    ← cas LEO/LMS, le bloquant actuel
5. Interception port série (com0com)    ← robots RS232
6. Lecture log applicatif du middleware ← dernier recours, déjà écrit sur disque
```

## Pourquoi le canal 4 (loopback LMS) est le point qui débloque LEO

WinDivert ne voit pas le loopback Windows en SNIFF classique. Trois moyens fiables existent :

- **`WINDIVERT_LAYER_REFLECT` + filtre `loopback`** (WinDivert 2.2 supporte la couche loopback depuis 2021), au lieu du layer NETWORK actuel
- **ETW provider `Microsoft-Windows-TCPIP`** (Event Tracing for Windows) — capte les écritures TCP locales sans driver
- **RawCap.exe** (Netresec, gratuit, signé) — capture loopback sans installation

Une fois le port LMS identifié (Get-NetTCPConnection le voit déjà côté processus LMS), on lance la capture sur ce port et on log en mode diagnostic pour déterminer :
- WWKS2 lisible → adaptateur Rowa s'applique direct
- Binaire propriétaire LEO → reverse de 5–10 trames suffit (toujours du CIP 13 chiffres)
- TLS → canal 4 condamné, on bascule sur 1, 2 ou 6

## Ce qu'il faut ajouter à Asclion

### A. Mode capture loopback
- `electron/native/windivert/windivert-capture.ps1` : ajouter flag `-Loopback` qui ouvre WinDivert avec filtre `loopback and tcp.DstPort == <port>`
- Fallback ETW via `logman start` + `Microsoft-Windows-TCPIP` quand WinDivert loopback échoue
- Bundle `RawCap.exe` (200 Ko, gratuit) en dernier recours

### B. Auto-scan des ports middleware
Dans l'assistant robot, quand `discover-port` ne remonte que du `127.0.0.1`, lancer automatiquement :
1. Liste des PID/ports en LISTEN sur loopback (`Get-NetTCPConnection -State Listen`)
2. Filtre sur processus connus middleware : `LMS*.exe`, `RowaService*`, `Pharmathek*`, `OmnicellAgent*`
3. Capture loopback 60 s sur chaque candidat pendant délivrance test
4. Adaptateur Diagnostic → dump base64 pour inspection à distance

### C. Adaptateur LEO/LMS dédié
Une fois 5–10 trames LMS récoltées en pharmacie test, écrire `adapters.js` → `leoLms` avec la regex/parseur du format. À ajouter dans la chaîne d'adaptateurs.

### D. Canal 1 prêt à recevoir
Edge function `lgo-delivery-webhook` (publique, HMAC signée) prête à brancher dès que LEO/Winpharma répond. Zéro code côté Electron nécessaire pour ce canal.

### E. Canal 6 (log applicatif) en filet
Reprendre le `useFolderWatcher` existant et le pointer sur les répertoires log connus (`C:\ProgramData\LEO\LMS\logs\*.log`, équivalents Rowa/Pharmathek). Tail incrémental + regex CIP. Marche même quand tout le reste échoue, latence 1-2 s.

### F. Télémétrie "canal qui a fonctionné"
Chaque scan robot capté envoie `{ pharmacy_id, channel: 'wwks2'|'loopback'|'serial'|'webhook'|'log' }` à `analytics_events`. Au bout de 20 pharmacies on saura quel canal couvre quel LGO, et l'assistant proposera direct le bon.

## Plan d'implémentation proposé (ordre)

1. **Ajouter le mode loopback à WinDivert + fallback ETW + RawCap** (canal 4)
2. **Auto-scan ports middleware dans l'assistant robot** (UX du canal 4)
3. **Bundler `cap-loopback-diag.ps1`** : un script "1 clic" qui capture 60 s sur tous les ports loopback du LMS et zippe le résultat pour analyse → débloque le diagnostic LEO sans attendre LEO
4. **Edge function `lgo-delivery-webhook`** prête + doc côté admin (canal 1)
5. **Watcher de logs middleware** comme filet (canal 6)
6. **Adaptateur LEO/LMS** dès qu'on a les trames
7. **Télémétrie canal**

## Détails techniques

- **WinDivert loopback** : disponible depuis 2.2.0, filtre `loopback` officiel, mais nécessite `WINDIVERT_FLAG_SNIFF | WINDIVERT_FLAG_RECV_ONLY` exactement comme aujourd'hui — pas de risque de coupure
- **ETW** : `logman create trace asclion -p Microsoft-Windows-TCPIP -o trace.etl`, parser le .etl avec `tracerpt` → XML. Pas de driver, pas d'admin sur W10+
- **RawCap** : `RawCap.exe -f 127.0.0.1 dump.pcap`, lecture du pcap en streaming Node via `pcap-parser` (pur JS)
- **Sécurité** : tous les canaux restent passifs (sniff/lecture seule), aucun n'injecte de paquet dans la chaîne LGO→robot

## Hors scope

- Pas de changement côté UI marketing/landing
- Pas de modification de la chaîne scan douchette (déjà OK)
- Pas de signature code Windows (sujet séparé)

## Question à trancher avant d'implémenter

Veux-tu que je commence par **(3) le script "1 clic" de diagnostic loopback** — qui te permettrait dès demain de récolter des trames LMS dans la pharmacie pilote et de débloquer LEO sans dépendre d'eux — ou par **(1+2) le mode loopback intégré à l'assistant** directement ?
