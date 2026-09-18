import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import fs from 'fs';

import * as activeHandler from './functions/api/active.js';
import * as batchesHandler from './functions/api/batches.js';
import * as classesHandler from './functions/api/classes.js';
import * as fetchActiveHandler from './functions/api/fetch_active.js';
import fetchBatchesHandler from './functions/api/fetch_batches.js';
import * as liveHandler from './functions/api/live.js';
import * as playerHandler from './functions/api/player.js';
import * as previousLiveHandler from './functions/api/previous_live.js';
import * as subjectsHandler from './functions/api/subjects.js';
import * as topicsHandler from './functions/api/topics.js';
import * as videoHandler from './functions/api/video.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Parse json / raw body if needed
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const routeHandlers = {
  active: activeHandler,
  batches: batchesHandler,
  classes: classesHandler,
  fetch_active: fetchActiveHandler,
  'my-batches': fetchActiveHandler,
  fetch_batches: fetchBatchesHandler,
  live: liveHandler,
  player: playerHandler,
  previous_live: previousLiveHandler,
  subjects: subjectsHandler,
  topics: topicsHandler,
  video: videoHandler,
};

async function dispatchCloudflareFunction(mod, req, res) {
  try {
    const host = req.get('host') || `127.0.0.1:${PORT}`;
    const protocol = req.protocol || 'http';
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val !== undefined) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const webRequest = new Request(fullUrl, {
      method: req.method,
      headers,
      body,
    });

    const env = {
      ...process.env,
      TOKENS_URL: process.env.TOKENS_URL || `http://127.0.0.1:${PORT}/tokens.json`,
      BATCHES_URL: process.env.BATCHES_URL || `http://127.0.0.1:${PORT}/batches.json`,
    };

    const context = {
      request: webRequest,
      env,
      params: req.params,
      data: {},
      next: async () => {},
    };

    let webResponse;
    const method = req.method.toUpperCase();

    if (method === 'OPTIONS' && typeof mod.onRequestOptions === 'function') {
      webResponse = await mod.onRequestOptions(context);
    } else if (method === 'GET' && typeof mod.onRequestGet === 'function') {
      webResponse = await mod.onRequestGet(context);
    } else if (method === 'POST' && typeof mod.onRequestPost === 'function') {
      webResponse = await mod.onRequestPost(context);
    } else if (method === 'PUT' && typeof mod.onRequestPut === 'function') {
      webResponse = await mod.onRequestPut(context);
    } else if (method === 'DELETE' && typeof mod.onRequestDelete === 'function') {
      webResponse = await mod.onRequestDelete(context);
    } else if (typeof mod.onRequest === 'function') {
      webResponse = await mod.onRequest(context);
    } else if (typeof mod.fetch === 'function') {
      webResponse = await mod.fetch(webRequest, env, {});
    } else if (mod.default && typeof mod.default.fetch === 'function') {
      webResponse = await mod.default.fetch(webRequest, env, {});
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    if (!webResponse) {
      res.status(500).json({ error: 'Empty response from handler' });
      return;
    }

    res.status(webResponse.status);
    for (const [key, value] of webResponse.headers.entries()) {
      res.setHeader(key, value);
    }

    if (webResponse.body) {
      const stream = Readable.fromWeb(webResponse.body);
      stream.on('error', (err) => {
        // Stream aborted or client disconnected (normal during seeking/navigation)
      });
      res.on('error', (err) => {
        // Socket closed
      });
      stream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error(`Error executing function for ${req.path}:`, err);
    if (!res.headersSent) {
      res.status(500).json({
        status: 500,
        error: err.message || 'Internal Server Error',
      });
    }
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Stream player reverse proxy routes
app.all(['/combined-img-player*', '/uhs-hls-player*'], (req, res) => {
  return dispatchCloudflareFunction(playerHandler, req, res);
});

// API Routes dispatcher
app.all('/api/:route', async (req, res, next) => {
  const routeName = req.params.route;
  const handler = routeHandlers[routeName];
  if (handler) {
    return dispatchCloudflareFunction(handler, req, res);
  }
  next();
});

// Serve clean URLs for HTML files (e.g., /classes -> /classes.html)
app.use((req, res, next) => {
  if (req.method === 'GET' && !path.extname(req.path)) {
    const htmlFile = path.join(__dirname, `${req.path}.html`);
    if (fs.existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    }
  }
  next();
});

// Serve static assets and root HTML files
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
