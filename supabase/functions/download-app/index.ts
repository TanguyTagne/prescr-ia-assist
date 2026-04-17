import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GITHUB_OWNER = "TanguyTagne";
const GITHUB_REPO = "prescr-ia-assist";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    // Fetch the latest GitHub release
    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } },
    );

    if (!ghRes.ok) {
      throw new Error(`GitHub API error: ${ghRes.status}`);
    }

    const release = await ghRes.json();
    const assets = release.assets || [];

    // Prefer Asclion-Setup.exe, fallback to any .exe
    const asset =
      assets.find((a: any) => /asclion.*\.exe$/i.test(a.name)) ||
      assets.find((a: any) => a.name.endsWith(".exe"));

    if (!asset) {
      return new Response(
        JSON.stringify({ error: "Aucun installeur disponible dans la dernière release" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        },
      );
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: asset.browser_download_url,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
