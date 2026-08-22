/**
 * AURA SENTINEL - Database & Authentication Engine
 * Supports Free Forever MongoDB Atlas with In-Memory/Local Fallback and RBAC.
 */

const { MongoClient } = require('mongodb');

let mongoClient = null;
let db = null;
let isConnected = false;

// Default demo user profile
const DEFAULT_DEMO_USER = {
  email: 'analyst@aura.capital',
  password: 'sentinel2026',
  name: 'Senior Financial Architect',
  org: 'Aura Capital Markets',
  role: 'ANALYST',
  theme: 'dark',
  watchlist: ['HAL.NS', 'BEL.NS', 'RELIANCE.NS', 'TATAPOWER.NS'],
  createdAt: new Date().toISOString()
};

// Default master admin account
const DEFAULT_ADMIN_USER = {
  email: (process.env.ADMIN_EMAIL || 'admin@aura.capital').toLowerCase(),
  password: process.env.ADMIN_PASSWORD || 'admin2026',
  name: 'Master System Administrator',
  org: 'Aura Capital Global',
  role: 'ADMIN',
  theme: 'dark',
  watchlist: ['HAL.NS', 'BEL.NS', 'NVDA', 'TSM', 'LMT'],
  createdAt: new Date().toISOString()
};

// In-Memory fallback store
const fallbackStore = {
  users: [DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER]
};

/**
 * Initialize MongoDB Connection (if MONGODB_URI is provided)
 */
async function initDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('[DB] No MONGODB_URI provided in environment. Running in High-Speed Local/Memory mode.');
    return;
  }

  try {
    console.log('[DB] Connecting to MongoDB Atlas Cluster (Free Tier)...');
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });

    await mongoClient.connect();
    db = mongoClient.db('aura_sentinel');
    isConnected = true;

    console.log('=======================================================');
    console.log(' 🍃 [MongoDB Atlas] Connected successfully to Cloud Database!');
    console.log(' 🔐 Cross-Device User Accounts & Admin RBAC is ACTIVE.');
    console.log('=======================================================');

    // Create unique index on email
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });

    // Seed master admin account if not present
    await usersCollection.updateOne(
      { email: DEFAULT_ADMIN_USER.email },
      { $setOnInsert: DEFAULT_ADMIN_USER },
      { upsert: true }
    );

    // Seed demo analyst if not present
    await usersCollection.updateOne(
      { email: DEFAULT_DEMO_USER.email },
      { $setOnInsert: DEFAULT_DEMO_USER },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[DB] MongoDB Connection warning (falling back to memory):', err.message);
    isConnected = false;
  }
}

/**
 * Find a user by email (case-insensitive)
 */
async function findUserByEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  if (isConnected && db) {
    try {
      return await db.collection('users').findOne({ email: cleanEmail });
    } catch (e) {
      console.warn('[DB] Error querying MongoDB user, checking fallback:', e.message);
    }
  }

  return fallbackStore.users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail) || null;
}

/**
 * Get all registered users (for Admin console)
 */
async function getAllUsers() {
  if (isConnected && db) {
    try {
      const users = await db.collection('users')
        .find({}, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      return users;
    } catch (e) {
      console.error('[DB] Error fetching all users:', e.message);
    }
  }

  return fallbackStore.users.map(({ password, ...rest }) => rest);
}

/**
 * Create or register a new user
 */
async function registerUser(userData) {
  const cleanEmail = (userData.email || '').trim().toLowerCase();
  const cleanPass = String(userData.password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Email and passcode are required.');
  }

  const role = userData.role === 'ADMIN' ? 'ADMIN' : 'ANALYST';

  const userDoc = {
    name: (userData.name || '').trim() || 'Macro Analyst',
    org: (userData.org || '').trim() || 'Aura Capital Markets',
    email: cleanEmail,
    password: cleanPass,
    role,
    theme: userData.theme || 'dark',
    watchlist: userData.watchlist || ['HAL.NS', 'BEL.NS', 'RELIANCE.NS', 'TATAPOWER.NS'],
    updatedAt: new Date().toISOString(),
    createdAt: userData.createdAt || new Date().toISOString()
  };

  if (isConnected && db) {
    try {
      await db.collection('users').updateOne(
        { email: cleanEmail },
        { $set: userDoc },
        { upsert: true }
      );
      return userDoc;
    } catch (e) {
      console.error('[DB] MongoDB Register Error:', e.message);
    }
  }

  // Fallback in-memory
  const idx = fallbackStore.users.findIndex(u => (u.email || '').trim().toLowerCase() === cleanEmail);
  if (idx >= 0) {
    fallbackStore.users[idx] = { ...fallbackStore.users[idx], ...userDoc };
  } else {
    fallbackStore.users.push(userDoc);
  }

  return userDoc;
}

/**
 * Delete a user by email (Admin only)
 */
async function deleteUser(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@aura.capital').toLowerCase();

  if (cleanEmail === adminEmail) {
    throw new Error('Master root administrator cannot be deleted.');
  }

  if (isConnected && db) {
    try {
      const res = await db.collection('users').deleteOne({ email: cleanEmail });
      return res.deletedCount > 0;
    } catch (e) {
      console.error('[DB] MongoDB Delete Error:', e.message);
      throw e;
    }
  }

  const idx = fallbackStore.users.findIndex(u => (u.email || '').trim().toLowerCase() === cleanEmail);
  if (idx !== -1) {
    fallbackStore.users.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Update user role (Admin only)
 */
async function updateUserRole(email, newRole) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const role = newRole === 'ADMIN' ? 'ADMIN' : 'ANALYST';

  if (isConnected && db) {
    try {
      await db.collection('users').updateOne(
        { email: cleanEmail },
        { $set: { role, updatedAt: new Date().toISOString() } }
      );
      return true;
    } catch (e) {
      console.error('[DB] MongoDB Role Update Error:', e.message);
      throw e;
    }
  }

  const user = fallbackStore.users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
  if (user) {
    user.role = role;
    return true;
  }
  return false;
}

/**
 * Authenticate user credentials
 */
async function authenticateUser(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  if (!cleanEmail || !cleanPass) return null;

  // 1. Direct master admin credential check
  if (cleanEmail === DEFAULT_ADMIN_USER.email && cleanPass === DEFAULT_ADMIN_USER.password) {
    return {
      name: DEFAULT_ADMIN_USER.name,
      org: DEFAULT_ADMIN_USER.org,
      email: DEFAULT_ADMIN_USER.email,
      role: 'ADMIN',
      theme: 'dark',
      watchlist: DEFAULT_ADMIN_USER.watchlist || []
    };
  }

  // 2. Direct default demo analyst credential check
  if (cleanEmail === DEFAULT_DEMO_USER.email && cleanPass === DEFAULT_DEMO_USER.password) {
    return {
      name: DEFAULT_DEMO_USER.name,
      org: DEFAULT_DEMO_USER.org,
      email: DEFAULT_DEMO_USER.email,
      role: 'ANALYST',
      theme: 'dark',
      watchlist: DEFAULT_DEMO_USER.watchlist || []
    };
  }

  const user = await findUserByEmail(cleanEmail);
  if (!user) return null;

  if (String(user.password || '').trim() === cleanPass) {
    return {
      name: user.name,
      org: user.org,
      email: user.email,
      role: user.role || 'ANALYST',
      theme: user.theme || 'dark',
      watchlist: user.watchlist || []
    };
  }

  return null;
}

/**
 * Get Watchlist for user
 */
async function getUserWatchlist(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);
  return user ? (user.watchlist || []) : [];
}

/**
 * Save / Update Watchlist for user
 */
async function saveUserWatchlist(email, watchlistArray) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  if (isConnected && db) {
    try {
      await db.collection('users').updateOne(
        { email: cleanEmail },
        { $set: { watchlist: watchlistArray, updatedAt: new Date().toISOString() } }
      );
      return true;
    } catch (e) {
      console.error('[DB] Watchlist Save Error:', e.message);
    }
  }

  const user = fallbackStore.users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
  if (user) {
    user.watchlist = watchlistArray;
  }
  return true;
}

module.exports = {
  initDb,
  findUserByEmail,
  getAllUsers,
  registerUser,
  deleteUser,
  updateUserRole,
  authenticateUser,
  getUserWatchlist,
  saveUserWatchlist,
  isMongoConnected: () => isConnected
};
