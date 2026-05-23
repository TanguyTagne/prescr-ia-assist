## Problème

Le workflow GitHub Actions `build-electron.yml` échoue à l'étape **Release** avec `Bad credentials`. L'erreur vient de `softprops/action-gh-release@v2` qui n'arrive pas à s'authentifier avec `GITHUB_TOKEN`.

Causes probables :
1. L'action attend le token via l'input `token:` (sous `with:`) plutôt que via `env: GITHUB_TOKEN`. Dans certaines versions/configs, le fallback env ne marche pas.
2. La permission `contents: write` est bien là, mais elle peut être bloquée au niveau du repo (Settings → Actions → Workflow permissions = "Read repository contents").
3. Actions Node 20 dépréciées (avertissement, pas bloquant aujourd'hui).

## Correctif proposé

### 1. `.github/workflows/build-electron.yml`

- Passer le token explicitement à l'action release via `with: token: ${{ secrets.GITHUB_TOKEN }}` (plus fiable que l'env var).
- Garder `permissions: contents: write` au niveau workflow.
- Bump des actions dépréciées : `actions/checkout@v5`, `actions/setup-node@v5`.
- Retirer la variable `GH_TOKEN` du step electron-builder (inutile avec `--publish never`).

### 2. Vérification côté repo (à faire par l'utilisateur)

Sur GitHub : **Settings → Actions → General → Workflow permissions** → cocher **"Read and write permissions"** + **"Allow GitHub Actions to create and approve pull requests"**. C'est souvent la vraie cause du `Bad credentials` quand le token est bien là mais sans droits d'écriture.

## Résultat attendu

Le build Windows se termine, l'installeur `Asclion-Setup.exe` est publié comme asset d'une release `v{run_number}`, et l'edge function `download-app` peut le récupérer normalement.

## Fichier modifié

- `.github/workflows/build-electron.yml`
