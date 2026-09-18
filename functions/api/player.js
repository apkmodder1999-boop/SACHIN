// Cloudflare Function Optimized for Combined Image Player Engine
// Supports dynamic M3U8 rewriting & native MP4 (Range Requests/Seeking)

const TARGET_ORIGIN = "https://appx-play.akamai.net.in";

export async function onRequest(context) {
  // Extract the request from the Cloudflare Function context
  const { request } = context;
  return await handleRequest(request);
}

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 1. Handle CORS Preflight Settings (Optimized for Media Players)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        // Dynamically allow whatever headers the player is requesting (crucial for Range requests)
        "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 2. Stream & Video Segment Routing (?url=...)
  const streamUrlParam = url.searchParams.get("url");
  if (streamUrlParam) {
    try {
      const targetUrl = new URL(streamUrlParam);
      const modifiedHeaders = new Headers(request.headers);
      
      // Target Spoofing Headers
      modifiedHeaders.set("Host", targetUrl.host);
      modifiedHeaders.set("Origin", TARGET_ORIGIN);
      modifiedHeaders.set("Referer", TARGET_ORIGIN + "/");
      modifiedHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");

      // Fetch upstream media (Supports both 200 OK and 206 Partial Content)
      const response = await fetch(targetUrl.href, {
        method: request.method,
        headers: modifiedHeaders,
        redirect: "follow"
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      newHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");
      
      // Strip restrictive security headers that break iframe preview and cross-origin video playback
      newHeaders.delete("x-frame-options");
      newHeaders.delete("x-content-type-options");
      newHeaders.delete("content-security-policy");
      
      const contentType = response.headers.get("content-type") || "";
      const isM3U8 = targetUrl.pathname.endsWith(".m3u8") || 
                     targetUrl.href.includes(".m3u8") || 
                     contentType.includes("mpegurl") || 
                     contentType.includes("application/x-mpegurl");

      // HLS Manifest Dynamic Playlist Rewriter (.m3u8)
      if (isM3U8) {
        let responseText = await response.text();
        const lines = responseText.split('\n');
        
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          
          if (trimmed.startsWith('#')) {
            // Rewrite keys and maps inside m3u8 tags
            return line.replace(/URI="([^"]+)"/g, (match, p1) => {
              let absoluteUri;
              try {
                absoluteUri = p1.startsWith('http') ? p1 : new URL(p1, targetUrl.href).href;
              } catch {
                absoluteUri = p1;
              }
              return `URI="${url.pathname}?url=${encodeURIComponent(absoluteUri)}"`;
            });
          }
          
          // Rewrite segment chunks (.ts, .aac, .m4s, etc.)
          let absoluteUri;
          try {
            if (trimmed.startsWith('http')) {
              absoluteUri = trimmed;
            } else {
              const resolved = new URL(trimmed, targetUrl.href);
              // Preserve authentication / edge-cache query tokens if segment does not have its own
              if (!trimmed.includes('?') && targetUrl.search && !resolved.search) {
                resolved.search = targetUrl.search;
              }
              absoluteUri = resolved.href;
            }
          } catch {
            absoluteUri = trimmed;
          }
          return `${url.pathname}?url=${encodeURIComponent(absoluteUri)}`;
        });

        const rewrittenText = rewrittenLines.join('\n');
        newHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
        newHeaders.delete("Content-Length");

        return new Response(rewrittenText, { status: response.status, headers: newHeaders });
      }

      // Enforce accurate MIME types for media segments so Hls.js demuxers work reliably
      if (targetUrl.pathname.endsWith(".ts") || targetUrl.href.includes(".ts")) {
        newHeaders.set("Content-Type", "video/mp2t");
      } else if (targetUrl.pathname.endsWith(".mp4") || targetUrl.href.includes(".mp4")) {
        newHeaders.set("Content-Type", "video/mp4");
      } else if (targetUrl.pathname.endsWith(".m4s") || targetUrl.href.includes(".m4s")) {
        newHeaders.set("Content-Type", "video/iso.segment");
      } else if (targetUrl.pathname.endsWith(".aac") || targetUrl.href.includes(".aac")) {
        newHeaders.set("Content-Type", "audio/aac");
      } else if (targetUrl.pathname.endsWith(".key") || targetUrl.href.includes(".key")) {
        newHeaders.set("Content-Type", "application/octet-stream");
      }

      // Safe passthrough for media chunks (.ts) AND video files (.mp4)
      return new Response(response.body, { status: response.status, headers: newHeaders });
    } catch (err) {
      return new Response(`Stream Engine Error: ${err.message}`, { status: 500 });
    }
  }

  // 3. Asset & Portal Reverse Proxy Pipeline
  // Maps routes like /combined-img-player and /uhs-hls-player/images/watermark/...
  let targetPath = url.pathname === "/" ? "/combined-img-player" : url.pathname;
  const destinationUrl = new URL(targetPath + url.search, TARGET_ORIGIN).href;

  try {
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", new URL(TARGET_ORIGIN).host);
    proxyHeaders.set("Origin", TARGET_ORIGIN);
    proxyHeaders.set("Referer", TARGET_ORIGIN + "/");
    proxyHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");

    const response = await fetch(destinationUrl, {
      method: request.method,
      headers: proxyHeaders,
      redirect: "follow"
    });

    const finalHeaders = new Headers(response.headers);
    finalHeaders.set("Access-Control-Allow-Origin", "*");

    const contentType = response.headers.get("content-type") || "";

    // Intercept JavaScript and HTML to keep internal domain calls localized inside the proxy sandbox
    if (contentType.includes("text/html") || contentType.includes("javascript")) {
      let textContent = await response.text();
      textContent = textContent.split(TARGET_ORIGIN).join(url.origin);
      return new Response(textContent, { status: response.status, headers: finalHeaders });
    }

    // Direct piping for watermark images, CSS, and structural fonts
    return new Response(response.body, { status: response.status, headers: finalHeaders });

  } catch (err) {
    return new Response(`Portal Proxy Failure: ${err.message}`, { status: 500 });
  }
}
