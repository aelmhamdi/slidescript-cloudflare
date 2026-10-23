const ALLOWED_MODELS = new Set([
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite"
]);
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-frame-options": "DENY"
    }
  });
}

async function handleGenerate(request, env) {
  const pageOrigin = new URL(request.url).origin;
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== pageOrigin) {
    return json({ error: { message: "Cross-origin requests are not allowed." } }, 403);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: { message: "The site administrator has not configured the GEMINI_API_KEY secret." } }, 503);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: { message: "The slide request is too large. Reduce the number or size of embedded images." } }, 413);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ error: { message: "Could not read the request body." } }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: { message: "The slide request is too large. Reduce the number or size of embedded images." } }, 413);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: { message: "Invalid JSON request." } }, 400);
  }

  const model = String(input?.model || "");
  if (!ALLOWED_MODELS.has(model)) {
    return json({ error: { message: "The requested model is not enabled for this site." } }, 400);
  }
  if (!Array.isArray(input?.contents) || input.contents.length !== 1 || !Array.isArray(input.contents[0]?.parts)) {
    return json({ error: { message: "The request must contain one slide prompt and its supporting content." } }, 400);
  }
  if (input.contents[0].parts.length > 8) {
    return json({ error: { message: "Too many content parts were included for one slide." } }, 400);
  }

  const requestedConfig = input.generationConfig && typeof input.generationConfig === "object"
    ? input.generationConfig
    : {};
  const generationConfig = {
    temperature: 0.25,
    maxOutputTokens: Math.min(1500, Math.max(128, Number(requestedConfig.maxOutputTokens) || 1500))
  };
  if (requestedConfig.thinkingConfig?.thinkingLevel === "low") {
    generationConfig.thinkingConfig = { thinkingLevel: "low" };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({ contents: input.contents, generationConfig })
    });
  } catch {
    return json({ error: { message: "Could not connect to Google's Gemini API. Please retry." } }, 502);
  }

  const responseText = await upstream.text();
  return new Response(responseText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-frame-options": "DENY"
    }
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/generate") {
      if (request.method !== "POST") {
        return json({ error: { message: "Use POST to generate a slide narration." } }, 405);
      }
      return handleGenerate(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: { message: "API endpoint not found." } }, 404);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse);
  }
};
