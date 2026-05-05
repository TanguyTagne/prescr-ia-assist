import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GITHUB_OWNER = "TanguyTagne";
const GITHUB_REPO = "prescr-ia-assist";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const ghHeaders: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Asclion-Downloader",
    };
    if (githubToken) ghHeaders.Authorization = `Bearer ${githubToken}`;

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers: ghHeaders },
    );

    if (!ghRes.ok) throw new Error(`GitHub API error: ${ghRes.status}`);

    const release = await ghRes.json();
    const assets = release.assets || [];
    const asset =
      assets.find((a: any) => /asclion.*\.exe$/i.test(a.name)) ||
      assets.find((a: any) => a.name.endsWith(".exe"));

    if (!asset) {
      return new Response(
        JSON.stringify({ error: "Aucun installeur disponible" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Proxy the asset download through this function so the user never
    // hits a GitHub login page (works even if the repo is private).
    // Use the API asset URL with Accept: octet-stream + token.
    const assetRes = await fetch(asset.url, {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "Asclion-Downloader",
        ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
      },
      redirect: "follow",
    });

    if (!assetRes.ok || !assetRes.body) {
      throw new Error(`Asset download failed: ${assetRes.status}`);
    }

    return new Response(assetRes.body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.name}"`,
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
