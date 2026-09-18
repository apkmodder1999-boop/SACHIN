export default {
  async fetch(request, env, ctx) {
    const origin = new URL(request.url).origin;
    const SOURCE_URL = env?.BATCHES_URL || `${origin}/batches.json`;

    // Only allow GET/HEAD
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(
        JSON.stringify({
          status: 405,
          message: "Method Not Allowed"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Access-Control-Allow-Origin": "*",
            "Allow": "GET, HEAD"
          }
        }
      );
    }

    try {
      const response = await fetch(SOURCE_URL, {
        method: request.method,
        headers: {
          "Accept": "application/json"
        },
        cf: {
          cacheTtl: 60,
          cacheEverything: true
        }
      });

      // Return the source response body exactly as received.
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ||
            "application/json; charset=UTF-8",

          "Cache-Control": "public, max-age=60",

          // CORS
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });

    } catch (error) {
      return new Response(
        JSON.stringify({
          status: 500,
          message: "Failed to fetch batches.json"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
  }
};
