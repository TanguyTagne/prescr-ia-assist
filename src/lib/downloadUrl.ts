// Lien de téléchargement de l'installeur Windows.
// On passe par la fonction edge `download-app` qui proxifie la dernière release
// GitHub : l'utilisateur n'atterrit jamais sur une page de connexion GitHub.
const SUPABASE_BASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://oknjfjplseopgymijnca.supabase.co";

export const DOWNLOAD_URL = `${SUPABASE_BASE_URL}/functions/v1/download-app`;
