/**
 * AURA SENTINEL - Database & Authentication Engine
 * Supports Free Forever MongoDB Atlas with In-Memory/Local Fallback.
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
  role: 'TIER-1 MACRO STRATEGIST',
  theme: 'dark',
  createdAt: new Date().toISOString()
};

// In-Memory fallback store
const fallbackStore = {
  users: [DEFAULT_DEMO_USER],
  watchlists: {}
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
    console.log(' 🔐 Cross-Device User Accounts & Watchlist Sync is ACTIVE.');
    console.log('=======================================================');

    // Create unique index on email
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });

    // Seed default demo account if collection is empty
    const count = await usersCollection.countDocuments();
    if (count === 0) {
      await usersCollection.insertOne(DEFAULT_DEMO_USER);
    }
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
 * Create or register a new user
 */
async function registerUser(userData) {
  const cleanEmail = (userData.email || '').trim().toLowerCase();
  const cleanPass = String(userData.password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Email and passcode are required.');
  }

  const userDoc = {
    name: (userData.name || '').trim() || 'Macro Analyst',
    org: (userData.org || '').trim() || 'Aura Capital Markets',
    email: cleanEmail,
    password: cleanPass,
    role: userData.role || 'TIER-1 MACRO ANALYST',
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
 * Authenticate user credentials
 */
async function authenticateUser(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  if (!cleanEmail || !cleanPass) return null;

  const user = await findUserByEmail(cleanEmail);
  if (!user) return null;

  if (String(user.password || '').trim() === cleanPass) {
    // Return user object without sensitive fields if needed
    return {
      name: user.name,
      org: user.org,
      email: user.email,
      role: user.role || 'TIER-1 MACRO ANALYST',
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
  registerUser,
  authenticateUser,
  getUserWatchlist,
  saveUserWatchlist,
  isMongoConnected: () => isConnected
};
