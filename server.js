/**
 * AURA SENTINEL - Backend Server (Zero-Dependency Multi-Region Node.js Engine)
 * Dual-market support for INDIA (NSE/BSE) and GLOBAL (US/World).
 */

// Load environment variables from .env file (GEMINI_API_KEY etc.)
require('dotenv').config();

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const macroEngine = require('./services/macroEngine');
const { searchTickers } = require('./services/financeApi');
const dbService = require('./services/db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Initialize MongoDB Connection (if MONGODB_URI is provided in .env/Render)
dbService.initDb();

// Pre-warm macro engine on boot for both regions
Promise.all([
  macroEngine.getOrUpdateData('india'),
  macroEngine.getOrUpdateData('global')
]).then(() => {
  console.log('[Server] Macro Engine intelligence pre-warmed for India & Global.');
}).catch(err => {
  console.warn('[Server] Initial pre-warm notice:', err.message);
});

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(reqPath, res) {
  let safePath = reqPath === '/' ? '/index.html' : reqPath;
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Internal Server Error');
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const region = (query.region === 'global') ? 'global' : 'india';

  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // API Route: Macro Overview
  if (pathname === '/api/macro-overview' && req.method === 'GET') {
    try {
      const data = await macroEngine.getOrUpdateData(region, false);
      return sendJson(res, 200, {
        success: true,
        region,
        data: data.macroOverview,
        lastUpdated: data.lastUpdated,
        nextRefresh: data.nextRefresh
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Stock Opportunities
  if (pathname === '/api/stock-opportunities' && req.method === 'GET') {
    try {
      const data = await macroEngine.getOrUpdateData(region, false);
      return sendJson(res, 200, {
        success: true,
        region,
        data: data.stockOpportunities,
        lastUpdated: data.lastUpdated,
        nextRefresh: data.nextRefresh
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Incident Wire
  if (pathname === '/api/incident-wire' && req.method === 'GET') {
    try {
      const data = await macroEngine.getOrUpdateData(region, false);
      return sendJson(res, 200, {
        success: true,
        region,
        data: data.incidentWire,
        lastUpdated: data.lastUpdated,
        nextRefresh: data.nextRefresh
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Stock Search Autocomplete
  if (pathname === '/api/stock-search' && req.method === 'GET') {
    try {
      const q = query.q || '';
      if (!q || q.trim().length === 0) {
        return sendJson(res, 200, { success: true, results: [] });
      }
      const results = await searchTickers(q, region);
      return sendJson(res, 200, { success: true, region, results });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Specific Stock Deep Dive
  if (pathname === '/api/stock-deep-dive' && req.method === 'GET') {
    try {
      const symbol = query.symbol || query.q;
      const range = query.range || '1mo';
      const interval = query.interval || (range === '1d' ? '5m' : range === '5d' ? '15m' : range === '1y' || range === '3y' ? '1wk' : '1d');
      
      if (!symbol) {
        return sendJson(res, 400, { success: false, error: 'Symbol parameter required' });
      }
      const deepDive = await macroEngine.deepDiveStock(symbol, region, range, interval);
      return sendJson(res, 200, { success: true, region, range, interval, data: deepDive });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Manual Force Refresh
  if (pathname === '/api/refresh' && req.method === 'POST') {
    try {
      console.log(`[Server] Manual Refresh triggered for ${region.toUpperCase()}`);
      const data = await macroEngine.getOrUpdateData(region, true);
      return sendJson(res, 200, {
        success: true,
        region,
        message: `Intelligence refreshed for ${region.toUpperCase()} feeds.`,
        lastUpdated: data.lastUpdated,
        nextRefresh: data.nextRefresh,
        totalArticles: data.macroOverview ? data.macroOverview.totalArticlesAnalyzed : 0
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Auth Register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const user = await dbService.registerUser(body);
      return sendJson(res, 200, {
        success: true,
        message: 'User successfully registered.',
        user: {
          name: user.name,
          org: user.org,
          email: user.email,
          role: user.role,
          theme: user.theme,
          watchlist: user.watchlist
        }
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // API Route: Auth Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const user = await dbService.authenticateUser(body.email, body.password);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'INVALID SECURITY CREDENTIALS. ACCESS DENIED.' });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'ACCESS GRANTED.',
        user
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Watchlist Get & Sync
  if (pathname === '/api/auth/watchlist' && req.method === 'GET') {
    try {
      const email = query.email;
      const watchlist = await dbService.getUserWatchlist(email);
      return sendJson(res, 200, { success: true, watchlist });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/auth/watchlist' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      await dbService.saveUserWatchlist(body.email, body.watchlist);
      return sendJson(res, 200, { success: true, message: 'Watchlist updated.' });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Admin Get All Users
  if (pathname === '/api/admin/users' && req.method === 'GET') {
    try {
      const requesterEmail = req.headers['x-user-email'] || query.adminEmail;
      const requester = await dbService.findUserByEmail(requesterEmail);
      if (!requester || requester.role !== 'ADMIN') {
        return sendJson(res, 403, { success: false, error: 'ELEVATED SECURITY CLEARANCE REQUIRED (ADMIN ONLY).' });
      }

      const users = await dbService.getAllUsers();
      return sendJson(res, 200, {
        success: true,
        totalUsers: users.length,
        mongoConnected: dbService.isMongoConnected(),
        users
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: Admin Provision User
  if (pathname === '/api/admin/users/create' && req.method === 'POST') {
    try {
      const requesterEmail = req.headers['x-user-email'];
      const requester = await dbService.findUserByEmail(requesterEmail);
      if (!requester || requester.role !== 'ADMIN') {
        return sendJson(res, 403, { success: false, error: 'ELEVATED SECURITY CLEARANCE REQUIRED (ADMIN ONLY).' });
      }

      const body = await readJsonBody(req);
      const user = await dbService.registerUser(body);
      return sendJson(res, 200, {
        success: true,
        message: `Account created for ${user.email} with role [${user.role}].`,
        user: {
          name: user.name,
          org: user.org,
          email: user.email,
          role: user.role,
          theme: user.theme
        }
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // API Route: Admin Delete / Purge User
  if (pathname === '/api/admin/users/delete' && req.method === 'POST') {
    try {
      const requesterEmail = req.headers['x-user-email'];
      const requester = await dbService.findUserByEmail(requesterEmail);
      if (!requester || requester.role !== 'ADMIN') {
        return sendJson(res, 403, { success: false, error: 'ELEVATED SECURITY CLEARANCE REQUIRED (ADMIN ONLY).' });
      }

      const body = await readJsonBody(req);
      const targetEmail = body.email;
      if (!targetEmail) {
        return sendJson(res, 400, { success: false, error: 'Target email is required.' });
      }

      await dbService.deleteUser(targetEmail);
      return sendJson(res, 200, {
        success: true,
        message: `User ${targetEmail} access revoked and purged from MongoDB.`
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // API Route: Admin Toggle User Role
  if (pathname === '/api/admin/users/role' && req.method === 'POST') {
    try {
      const requesterEmail = req.headers['x-user-email'];
      const requester = await dbService.findUserByEmail(requesterEmail);
      if (!requester || requester.role !== 'ADMIN') {
        return sendJson(res, 403, { success: false, error: 'ELEVATED SECURITY CLEARANCE REQUIRED (ADMIN ONLY).' });
      }

      const body = await readJsonBody(req);
      await dbService.updateUserRole(body.email, body.role);
      return sendJson(res, 200, {
        success: true,
        message: `User ${body.email} role updated to [${body.role}].`
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // API Route: Health check
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'OPERATIONAL',
      mongoConnected: dbService.isMongoConnected(),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      service: 'AURA SENTINEL Multi-Region Macro Engine (India & Global)'
    });
  }

  // Serve static UI files
  serveStaticFile(pathname, res);
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` 🛡️  AURA SENTINEL — Macro Intelligence Terminal`);
  console.log(` 🌐 Markets Supported: 🇮🇳 INDIA (NSE/BSE) & 🌐 GLOBAL (US/World)`);
  console.log(` 🚀 Server active: http://localhost:${PORT}`);
  console.log(` ⏱️  Auto-refresh interval: 1 Hour (with manual push button)`);
  console.log(`=======================================================`);
});
