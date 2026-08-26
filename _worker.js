/**
 * Cloudflare Worker Backend / Reverse Proxy for VaaTracker
 * Proxies all /api/*, /socket.io/* and /health requests directly to the Node.js backend on Render (https://vaatracker-backend.onrender.com)
 * Serves static assets for everything else via env.ASSETS
 */

const RENDER_BACKEND_ORIGIN = "https://vaatracker-backend.onrender.com";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-session-token",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // 1b. Handle VAAREC Magic Link Email Dispatcher via Resend
    if (pathname === "/api/vaarec-send-email" && request.method === "POST") {
      try {
        const body = await request.json();
        const { to, subject, html } = body;
        const resendApiKey = atob('cmVfRjJEQ3VDUHJfNlVIdGdGaGpVVlp5TlA4c2EyZmEyRFhr');

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "VAAREC <onboarding@resend.dev>",
            to: Array.isArray(to) ? to : [to],
            subject: subject || "🏆 Seu Acesso ao Replay VAAREC",
            html: html
          })
        });

        const resData = await resendRes.json();
        return new Response(JSON.stringify(resData), {
          status: resendRes.status,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Resend email dispatch error", details: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      }
    }

    // 2. Proxy API and Socket.IO directly to Render backend
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/socket.io/") ||
      pathname === "/health" ||
      pathname === "/ws"
    ) {
      const targetUrl = new URL(url.pathname + url.search, RENDER_BACKEND_ORIGIN);
      
      const newHeaders = new Headers(request.headers);
      newHeaders.set("Host", "vaatracker-backend.onrender.com");
      newHeaders.set("X-Forwarded-Host", url.hostname);
      newHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

      try {
        const backendResponse = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: newHeaders,
          body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(backendResponse.headers);
        Object.entries(corsHeaders()).forEach(([k, v]) => responseHeaders.set(k, v));

        return new Response(backendResponse.body, {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          headers: responseHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Backend proxy error", details: String(err) }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }
    }

    // 3. Fallback to static assets
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
