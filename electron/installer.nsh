; Custom NSIS hooks for Asclion installer
; Cleans up Windows Task Scheduler entries created by the app at runtime.

!macro customHeader
  RequestExecutionLevel admin
!macroend

!macro customInstall
  DetailPrint "Configuration du démarrage automatique admin Asclion..."
  ; Lance Asclion en mode "repair-autolaunch" — il enregistre les tâches
  ; planifiées admin pour le user actuellement connecté (le pharmacien),
  ; puis fire schtasks /Run "AsclionAtLogon" après 2 secondes pour
  ; relancer Asclion via la tâche planifiée (donc en mode admin).
  ;
  ; Le drapeau --no-restart-after-repair a été RETIRÉ : sans ça, Asclion
  ; ne se relançait pas après l'update et l'utilisateur se retrouvait en
  ; user mode (la suite ouverte par runAfterFinish=true dans package.json
  ; perdait le token admin via Explorer). runAfterFinish est maintenant
  ; à false pour laisser la tâche planifiée gagner sans course.
  ExecWait '"$INSTDIR\\Asclion.exe" --asclion-repair-autolaunch --reason=install'
!macroend

!macro customUnInstall
  DetailPrint "Suppression des tâches de lancement automatique Asclion..."
  nsExec::Exec 'schtasks /Delete /TN "AsclionAtLogon" /F'
  nsExec::Exec 'schtasks /Delete /TN "AsclionAtBoot" /F'
  nsExec::Exec 'schtasks /Delete /TN "AsclionDaily0830" /F'
  nsExec::Exec 'schtasks /Delete /TN "AsclionDaily0900" /F'
  ; Legacy task name from previous versions
  nsExec::Exec 'schtasks /Delete /TN "AsclionDailyLaunch" /F'
!macroend
