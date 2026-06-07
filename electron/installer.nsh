; Custom NSIS hooks for Asclion installer
; Cleans up Windows Task Scheduler entries created by the app at runtime.

!macro customInstall
  DetailPrint "Configuration du démarrage automatique admin Asclion..."
  ExecWait '"$INSTDIR\\Asclion.exe" --asclion-repair-autolaunch --reason=install --no-restart-after-repair'
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
