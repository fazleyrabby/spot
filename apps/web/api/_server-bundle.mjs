// apps/server/src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// apps/server/src/config.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
} catch {
}
dotenv.config();
var config = {
  port: parseInt(process.env.PORT || "5050", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://localhost:5432/spot_db",
  cookieSecret: process.env.COOKIE_SECRET || "spot_default_cookie_secret_at_least_32_chars",
  corsOrigin: process.env.CORS_ORIGIN || "https://www.claimyourspot.lol",
  isProd: process.env.NODE_ENV === "production"
};

// apps/server/src/routes.ts
import { Router } from "express";

// apps/server/src/db.ts
import pg from "pg";
var { Pool } = pg;
var _pool = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes("supabase.co") || config.databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : void 0,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
    _pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return _pool;
}
var pool = new Proxy({}, {
  get(_target, prop, _receiver) {
    return getPool()[prop];
  }
});
async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === "development" && duration > 200) {
    console.warn(`[DB Slow Query] ${duration}ms: ${text.slice(0, 80)}...`);
  }
  return res;
}

// apps/server/src/auth.ts
import crypto from "crypto";
var COOKIE_NAME = "spot_session_token";
var COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax",
  maxAge: 10 * 365 * 24 * 60 * 60 * 1e3,
  // 10 years (permanent identity)
  path: "/"
};
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
async function resolveCitizen(token) {
  const tokenHash = hashToken(token);
  const res = await query(
    `SELECT id, display_name as "displayName", avatar_id as "avatarId", 
            custom_avatar_data as "customAvatarData", tagline,
            website_url as "websiteUrl", github_url as "githubUrl",
            twitter_url as "twitterUrl", facebook_url as "facebookUrl",
            instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
            linkedin_url as "linkedinUrl",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM citizens
     WHERE session_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}
async function optionalAuthMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers["x-spot-session"];
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  if (!token && customHeader) {
    token = customHeader;
  }
  if (token && typeof token === "string") {
    req.rawSessionToken = token;
    const citizen = await resolveCitizen(token);
    if (citizen) req.citizen = citizen;
  }
  next();
}
async function requireAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers["x-spot-session"];
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  if (!token && customHeader) {
    token = customHeader;
  }
  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Unauthorized: Missing citizen session token" });
    return;
  }
  const citizen = await resolveCitizen(token);
  if (!citizen) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
    return;
  }
  req.citizen = citizen;
  req.rawSessionToken = token;
  next();
}

// apps/server/src/rateLimiter.ts
var SlidingWindowRateLimiter = class {
  windows = /* @__PURE__ */ new Map();
  maxRequests;
  windowMs;
  message;
  maxKeys;
  constructor(maxRequests, windowMs, message, maxKeys = 1e4) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.message = message || "Too many requests, please try again later";
    this.maxKeys = maxKeys;
    if (!process.env.VERCEL) {
      setInterval(() => this.cleanup(), 10 * 60 * 1e3);
    }
  }
  evictOldest() {
    const firstKey = this.windows.keys().next().value;
    if (firstKey !== void 0) this.windows.delete(firstKey);
  }
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }
  middleware() {
    return (req, res, next) => {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown_ip";
      const now = Date.now();
      let entry = this.windows.get(ip);
      if (!entry) {
        if (this.windows.size >= this.maxKeys) this.evictOldest();
        entry = { timestamps: [] };
        this.windows.set(ip, entry);
      } else {
        this.windows.delete(ip);
        this.windows.set(ip, entry);
      }
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < this.windowMs);
      if (entry.timestamps.length >= this.maxRequests) {
        const oldest = entry.timestamps[0];
        const retryAfterSeconds = Math.ceil((oldest + this.windowMs - now) / 1e3);
        res.setHeader("Retry-After", retryAfterSeconds);
        res.status(429).json({
          error: "RateLimitExceeded",
          message: this.message,
          retryAfterSeconds
        });
        return;
      }
      entry.timestamps.push(now);
      next();
    };
  }
};
var citizenCreationLimiter = new SlidingWindowRateLimiter(
  5,
  24 * 60 * 60 * 1e3,
  "Maximum citizen registration limit reached for this IP today"
).middleware();
var spotClaimLimiter = new SlidingWindowRateLimiter(
  3,
  60 * 1e3,
  "Spot claim rate limit exceeded. Please wait a minute before trying again."
).middleware();

// packages/shared/src/schemas.ts
import { z } from "zod";
var BLOCKED_WORDS = [
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "nigger",
  "nigga",
  "cunt",
  "dick",
  "pussy",
  "slut",
  "whore",
  "motherfucker",
  "bullshit",
  "douche"
];
function containsBlockedWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => {
    const re = new RegExp(`\\b${w}\\b`, "i");
    return re.test(lower) || w.length > 4 && lower.includes(w);
  });
}
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function sanitizeDisplayName(name) {
  let clean = name.trim();
  for (const w of BLOCKED_WORDS) {
    if (w.length >= 3) {
      const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
      clean = clean.replace(re, (m) => "*".repeat(m.length));
    }
  }
  clean = clean.replace(/\s{2,}/g, " ").trim();
  return (clean.slice(0, 32) || "Citizen").trim();
}
var SafeUrlSchema = z.string().max(256, "URL must not exceed 256 characters").trim().refine(
  (val) => {
    if (!val) return true;
    try {
      const parsed = new URL(val);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "URL must use a valid http:// or https:// scheme" }
).optional().or(z.literal(""));
var CreateCitizenSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(32, "Display name must not exceed 32 characters").trim(),
  avatarId: z.string().min(1, "Avatar selection is required").max(32, "Avatar ID must not exceed 32 characters").trim(),
  customAvatarData: z.string().max(65536).optional().or(z.literal("")),
  tagline: z.string().max(80, "Tagline must not exceed 80 characters").trim().optional().or(z.literal("")),
  websiteUrl: SafeUrlSchema,
  githubUrl: z.string().max(128, "GitHub handle or URL must not exceed 128 characters").trim().optional().or(z.literal("")),
  twitterUrl: z.string().max(128, "X / Twitter handle or URL must not exceed 128 characters").trim().optional().or(z.literal("")),
  facebookUrl: z.string().max(128, "Facebook profile or URL must not exceed 128 characters").trim().optional().or(z.literal("")),
  instagramUrl: z.string().max(128, "Instagram handle or URL must not exceed 128 characters").trim().optional().or(z.literal("")),
  youtubeUrl: z.string().max(128, "YouTube channel or URL must not exceed 128 characters").trim().optional().or(z.literal("")),
  linkedinUrl: SafeUrlSchema,
  githubId: z.string().max(64).optional(),
  email: z.string().email().optional().or(z.literal("")),
  avatarUrl: z.string().url().max(512).optional().or(z.literal(""))
});
var ClaimSpotSchema = z.object({
  spotId: z.string().regex(/^\d{1,3},\d{1,3}$/, 'Spot ID must be in format x,y (e.g. "42,17")'),
  idempotencyKey: z.string().uuid("Idempotency key must be a valid UUID").optional(),
  // Optional citizen profile if claiming simultaneously on first visit
  citizen: CreateCitizenSchema.optional()
});
var UpdateCitizenSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty").max(32, "Display name must not exceed 32 characters").trim().optional(),
  avatarId: z.string().min(1).max(32).trim().optional(),
  customAvatarData: z.string().max(65536).optional().or(z.literal("")),
  tagline: z.string().max(80).trim().optional(),
  websiteUrl: SafeUrlSchema,
  githubUrl: z.string().max(128).trim().optional(),
  twitterUrl: z.string().max(128).trim().optional(),
  facebookUrl: z.string().max(128).trim().optional(),
  instagramUrl: z.string().max(128).trim().optional(),
  youtubeUrl: z.string().max(128).trim().optional(),
  linkedinUrl: SafeUrlSchema
});

// apps/server/src/routes.ts
import crypto2 from "crypto";
var apiRouter = Router();
var MAX_PROFANITY_WARNINGS = 3;
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"]?.split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || req.ip || null;
}
async function enforceServerProfanity(displayName, tagline, req) {
  if (!containsBlockedWord(displayName) && !containsBlockedWord(tagline)) {
    return displayName;
  }
  const ip = clientIp(req);
  const key = ip ? `ip:${ip}` : null;
  let current = 0;
  if (key) {
    const rows = await query(
      `SELECT warning_count FROM moderation_flags WHERE device_key = $1 LIMIT 1`,
      [key]
    );
    current = Number(rows.rows[0]?.warning_count) || 0;
  }
  const next = current + 1;
  if (key) {
    await query(
      `INSERT INTO moderation_flags (device_key, ip_address, warning_count, last_attempt)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (device_key)
       DO UPDATE SET warning_count = EXCLUDED.warning_count, ip_address = EXCLUDED.ip_address, last_attempt = NOW()`,
      [key, ip, next]
    );
  }
  if (next >= MAX_PROFANITY_WARNINGS) {
    const err = new Error("Blocked: you repeatedly used offensive language.");
    err.status = 403;
    throw err;
  }
  return sanitizeDisplayName(displayName);
}
function buildCitizenProfileUpdate(fields) {
  const colMap = [
    ["displayName", "display_name"],
    ["avatarId", "avatar_id"],
    ["customAvatarData", "custom_avatar_data"],
    ["tagline", "tagline"],
    ["websiteUrl", "website_url"],
    ["githubUrl", "github_url"],
    ["twitterUrl", "twitter_url"],
    ["facebookUrl", "facebook_url"],
    ["instagramUrl", "instagram_url"],
    ["youtubeUrl", "youtube_url"],
    ["linkedinUrl", "linkedin_url"]
  ];
  const assignments = [];
  const params = [];
  for (const [key, col] of colMap) {
    if (fields[key] !== void 0) {
      params.push(fields[key]);
      assignments.push(`${col} = $${params.length}`);
    }
  }
  return { assignments, params };
}
var CITIZEN_PROFILE_COLUMNS = `
  id, display_name as "displayName", avatar_id as "avatarId",
  custom_avatar_data as "customAvatarData", tagline,
  website_url as "websiteUrl", github_url as "githubUrl",
  twitter_url as "twitterUrl", facebook_url as "facebookUrl",
  instagram_url as "instagramUrl", youtube_url as "youtubeUrl",
  linkedin_url as "linkedinUrl",
  created_at as "createdAt", updated_at as "updatedAt"
`;
var sseConnections = /* @__PURE__ */ new Set();
function getUniqueOnlineCount() {
  const uniqueIds = /* @__PURE__ */ new Set();
  for (const conn of sseConnections) {
    uniqueIds.add(conn.clientId);
  }
  return Math.max(1, uniqueIds.size);
}
function broadcastRealtimeEvent(event) {
  const data = `data: ${JSON.stringify(event)}

`;
  for (const conn of sseConnections) {
    try {
      conn.res.write(data);
    } catch {
      sseConnections.delete(conn);
    }
  }
}
var enableSSE = process.env.VERCEL ? false : process.env.ENABLE_SSE !== "false";
var sseHandler = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const tokenParam = typeof req.query.token === "string" ? req.query.token : void 0;
  const tabParam = typeof req.query.tabId === "string" ? req.query.tabId : void 0;
  const rawToken = req.rawSessionToken || tokenParam;
  let citizenId = req.citizen?.id;
  if (!citizenId && rawToken) {
    const resolved = await resolveCitizen(rawToken);
    if (resolved) citizenId = resolved.id;
  }
  const clientId = citizenId || (rawToken ? `tok_${rawToken.substring(0, 12)}` : tabParam ? `tab_${tabParam}` : `ip_${req.ip || "local"}`);
  const conn = { res, clientId };
  sseConnections.add(conn);
  const initialCount = getUniqueOnlineCount();
  res.write(`data: ${JSON.stringify({ type: "connected", onlineCount: initialCount })}

`);
  broadcastRealtimeEvent({ type: "presence", onlineCount: initialCount });
  const cleanup = () => {
    if (sseConnections.has(conn)) {
      sseConnections.delete(conn);
      broadcastRealtimeEvent({ type: "presence", onlineCount: getUniqueOnlineCount() });
    }
  };
  req.on("close", cleanup);
  req.on("end", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
};
if (enableSSE) {
  apiRouter.get("/realtime/stream", optionalAuthMiddleware, sseHandler);
}
if (enableSSE) {
  setInterval(() => {
    for (const conn of sseConnections) {
      try {
        conn.res.write(": ping\n\n");
      } catch {
        sseConnections.delete(conn);
        broadcastRealtimeEvent({ type: "presence", onlineCount: getUniqueOnlineCount() });
      }
    }
  }, 15e3);
}
apiRouter.get("/world", async (req, res) => {
  try {
    const spotsRes = await query(`
      SELECT 
        s.id as "spotId", s.x, s.y, s.owner_id as "citizenId",
        c.display_name as "displayName", c.avatar_id as "avatarId",
        c.custom_avatar_data as "customAvatarData", c.tagline,
        c.website_url as "websiteUrl", c.github_url as "githubUrl",
        c.twitter_url as "twitterUrl", c.facebook_url as "facebookUrl",
        c.instagram_url as "instagramUrl", c.youtube_url as "youtubeUrl",
        c.linkedin_url as "linkedinUrl",
        (c.github_url IS NOT NULL AND c.github_url <> '') as "isVerified"
      FROM spots s
      INNER JOIN citizens c ON s.owner_id = c.id
    `);
    const statsRes = await query(`
      SELECT 
        count(*) as total_spots,
        count(owner_id) as claimed_count
      FROM spots
    `);
    const totalSpots = parseInt(statsRes.rows[0]?.total_spots, 10) || 1e4;
    const claimedCount = parseInt(statsRes.rows[0]?.claimed_count, 10) || spotsRes.rows.length;
    const isLocalhost = req.hostname === "localhost" || req.ip === "127.0.0.1" || req.ip === "::1";
    const hasVisitedCookie = req.cookies?.spot_visited;
    let totalVisitors = 1;
    if (!isLocalhost && !hasVisitedCookie) {
      const visitorRes = await query(
        `UPDATE site_stats SET value = value + 1 WHERE key = 'total_visitors' RETURNING value;`
      );
      totalVisitors = parseInt(visitorRes.rows[0]?.value, 10) || 1;
      res.cookie("spot_visited", "1", {
        maxAge: 24 * 60 * 60 * 1e3,
        // 24 hours
        httpOnly: true,
        sameSite: "lax"
      });
    } else {
      const readRes = await query(`SELECT value FROM site_stats WHERE key = 'total_visitors' LIMIT 1;`);
      totalVisitors = parseInt(readRes.rows[0]?.value, 10) || 1;
    }
    res.json({
      width: 100,
      height: 100,
      totalSpots,
      claimedCount,
      totalVisitors,
      onlineCount: getUniqueOnlineCount(),
      occupied: spotsRes.rows
    });
  } catch (err) {
    console.error("Error fetching world snapshot:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to load world snapshot" });
  }
});
apiRouter.get("/citizens/me", optionalAuthMiddleware, async (req, res) => {
  if (!req.citizen) {
    res.json({ authenticated: false, citizen: null, ownedSpot: null });
    return;
  }
  try {
    const spotRes = await query(
      `SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`,
      [req.citizen.id]
    );
    res.json({
      authenticated: true,
      citizen: req.citizen,
      ownedSpot: spotRes.rows[0] || null
    });
  } catch (err) {
    console.error("Error fetching citizen session:", err);
    res.status(500).json({ error: "InternalServerError" });
  }
});
apiRouter.post("/auth/github/sync", async (req, res) => {
  const { githubId, username, email, avatarUrl, displayName } = req.body;
  if (!githubId) {
    res.status(400).json({ error: "MissingGithubId" });
    return;
  }
  try {
    const existing = await query(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE github_id = $1
       LIMIT 1`,
      [String(githubId)]
    );
    let citizen;
    let rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    if (existing.rows.length > 0) {
      citizen = existing.rows[0];
      await query(
        `UPDATE citizens SET session_token_hash = $1, github_url = COALESCE($2, github_url),
           email = COALESCE($3, email), avatar_url = COALESCE($4, avatar_url), updated_at = NOW()
         WHERE id = $5`,
        [tokenHash, username || null, email || null, avatarUrl || null, citizen.id]
      );
    } else {
      const citizenId = `c_${crypto2.randomBytes(12).toString("hex")}`;
      const name = displayName || username || "Citizen";
      const insertRes = await query(
        `INSERT INTO citizens (id, session_token_hash, display_name, avatar_id, github_url, github_id, email, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
        [citizenId, tokenHash, name, "astronaut", username || null, String(githubId), email || null, avatarUrl || null]
      );
      citizen = insertRes.rows[0];
    }
    const spotRes = await query(`SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`, [citizen.id]);
    res.cookie(COOKIE_NAME, rawToken, COOKIE_OPTIONS);
    res.json({
      success: true,
      authenticated: true,
      sessionToken: rawToken,
      citizen,
      ownedSpot: spotRes.rows[0] || null
    });
  } catch (err) {
    console.error("Error syncing GitHub user:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to sync GitHub user" });
  }
});
apiRouter.post("/spots/claim", spotClaimLimiter, optionalAuthMiddleware, async (req, res) => {
  const parsed = CreateCitizenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", details: parsed.error.format() });
    return;
  }
  const { x, y } = req.body;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 99 || y < 0 || y > 99) {
    res.status(400).json({ error: "ValidationError", message: "x and y coordinates are required (0-99)." });
    return;
  }
  const spotId = `${x},${y}`;
  const input = parsed.data;
  let displayName = input.displayName;
  try {
    displayName = await enforceServerProfanity(input.displayName, input.tagline, req);
  } catch (err) {
    if (err?.status === 403) {
      res.status(403).json({ error: "Blocked", message: err.message });
      return;
    }
    throw err;
  }
  let citizen = req.citizen;
  let rawToken = req.rawSessionToken;
  if (!citizen && input.githubId) {
    const gitRes = await query(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE github_id = $1
       LIMIT 1`,
      [input.githubId]
    );
    if (gitRes.rows.length > 0) {
      citizen = gitRes.rows[0];
    }
  }
  if (!citizen) {
    const newRawToken = generateSessionToken();
    const tokenHash = hashToken(newRawToken);
    const citizenId = `c_${crypto2.randomBytes(12).toString("hex")}`;
    try {
      const citizenRes = await query(
        `INSERT INTO citizens (
           id, session_token_hash, display_name, avatar_id, custom_avatar_data,
           tagline, website_url, github_url, twitter_url, facebook_url,
           instagram_url, youtube_url, linkedin_url, github_id, email, avatar_url, ip_address
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
        [
          citizenId,
          tokenHash,
          displayName,
          input.avatarId,
          input.customAvatarData || null,
          input.tagline || null,
          input.websiteUrl || null,
          input.githubUrl || null,
          input.twitterUrl || null,
          input.facebookUrl || null,
          input.instagramUrl || null,
          input.youtubeUrl || null,
          input.linkedinUrl || null,
          input.githubId || null,
          input.email || null,
          input.avatarUrl || null,
          clientIp(req)
        ]
      );
      citizen = citizenRes.rows[0];
      rawToken = newRawToken;
      res.cookie(COOKIE_NAME, newRawToken, COOKIE_OPTIONS);
    } catch (err) {
      console.error("Error creating citizen during claim:", err);
      res.status(500).json({ error: "InternalServerError", message: "Failed to create citizen profile" });
      return;
    }
  } else if (input.avatarId || input.customAvatarData || input.tagline) {
    try {
      const { assignments, params } = buildCitizenProfileUpdate({
        avatarId: input.avatarId,
        customAvatarData: input.customAvatarData,
        tagline: input.tagline,
        websiteUrl: input.websiteUrl,
        githubUrl: input.githubUrl,
        twitterUrl: input.twitterUrl,
        facebookUrl: input.facebookUrl,
        instagramUrl: input.instagramUrl,
        youtubeUrl: input.youtubeUrl,
        linkedinUrl: input.linkedinUrl
      });
      if (assignments.length > 0) {
        params.push(citizen.id);
        await query(
          `UPDATE citizens SET ${assignments.join(", ")}, updated_at = NOW() WHERE id = $${params.length} RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
          params
        );
      }
    } catch (err) {
      console.error("Error updating citizen profile during claim:", err);
    }
  }
  if (!citizen) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const existingOwnership = await query(
    `SELECT id, x, y FROM spots WHERE owner_id = $1 LIMIT 1`,
    [citizen.id]
  );
  if (existingOwnership.rows.length > 0 && existingOwnership.rows[0].id !== spotId) {
    res.status(409).json({
      error: "CitizenAlreadyOwnsSpot",
      message: `You already own spot (${existingOwnership.rows[0].x}, ${existingOwnership.rows[0].y}). Each person gets exactly one spot.`,
      ownedSpotId: existingOwnership.rows[0].id
    });
    return;
  }
  try {
    const updateRes = await query(
      `UPDATE spots
       SET owner_id = $1, claimed_at = COALESCE(claimed_at, NOW())
       WHERE id = $2 AND (owner_id IS NULL OR owner_id = $1)
       RETURNING id, x, y, owner_id as "ownerId", claimed_at as "claimedAt"`,
      [citizen.id, spotId]
    );
    if (updateRes.rows.length === 0) {
      const currentOwner = await query(`SELECT owner_id FROM spots WHERE id = $1`, [spotId]);
      res.status(409).json({
        error: "SpotAlreadyOccupied",
        message: "This spot was already claimed by another citizen.",
        spotId
      });
      return;
    }
    const claimedSpot = updateRes.rows[0];
    broadcastRealtimeEvent({
      type: "spot_claimed",
      spot: claimedSpot,
      citizen: {
        id: citizen.id,
        displayName: citizen.displayName,
        avatarId: citizen.avatarId,
        tagline: citizen.tagline,
        websiteUrl: citizen.websiteUrl,
        githubUrl: citizen.githubUrl
      }
    });
    res.status(200).json({
      success: true,
      spot: claimedSpot,
      citizen,
      sessionToken: rawToken || void 0
    });
  } catch (err) {
    if (err?.code === "23505" || String(err?.message || "").includes("duplicate key")) {
      res.status(409).json({
        error: "CitizenAlreadyOwnsSpot",
        message: "You already own a spot \u2014 each citizen gets exactly one."
      });
      return;
    }
    console.error("Error executing claim query:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to claim spot" });
  }
});
apiRouter.get("/citizens/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json({ results: [] });
    return;
  }
  try {
    const searchPattern = `%${q}%`;
    const searchRes = await query(
      `SELECT 
         c.id, c.display_name as "displayName", c.avatar_id as "avatarId",
         c.custom_avatar_data as "customAvatarData", c.tagline,
         c.website_url as "websiteUrl", c.github_url as "githubUrl",
         c.twitter_url as "twitterUrl", c.facebook_url as "facebookUrl",
         c.instagram_url as "instagramUrl", c.youtube_url as "youtubeUrl",
         c.linkedin_url as "linkedinUrl",
         s.id as "spotId", s.x, s.y
       FROM citizens c
       INNER JOIN spots s ON s.owner_id = c.id
       WHERE c.display_name ILIKE $1 
          OR c.tagline ILIKE $1 
          OR c.github_url ILIKE $1
          OR s.id = $2
       ORDER BY c.created_at DESC
       LIMIT 20`,
      [searchPattern, q]
    );
    res.json({ results: searchRes.rows });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to execute search" });
  }
});
apiRouter.get("/citizens/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const citizenRes = await query(
      `SELECT ${CITIZEN_PROFILE_COLUMNS}
       FROM citizens
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (citizenRes.rows.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Citizen not found" });
      return;
    }
    const spotRes = await query(
      `SELECT id, x, y, claimed_at as "claimedAt" FROM spots WHERE owner_id = $1 LIMIT 1`,
      [id]
    );
    res.json({
      citizen: citizenRes.rows[0],
      spot: spotRes.rows[0] || null
    });
  } catch (err) {
    console.error("Error fetching citizen profile:", err);
    res.status(500).json({ error: "InternalServerError" });
  }
});
apiRouter.patch("/citizens/me", requireAuthMiddleware, async (req, res) => {
  const parsed = UpdateCitizenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", details: parsed.error.format() });
    return;
  }
  const {
    displayName,
    avatarId,
    customAvatarData,
    tagline,
    websiteUrl,
    githubUrl,
    twitterUrl,
    facebookUrl,
    instagramUrl,
    youtubeUrl,
    linkedinUrl
  } = parsed.data;
  const citizen = req.citizen;
  try {
    let finalName = citizen.displayName;
    if (displayName !== void 0) {
      try {
        finalName = await enforceServerProfanity(displayName, tagline, req);
      } catch (err) {
        if (err?.status === 403) {
          res.status(403).json({ error: "Blocked", message: err.message });
          return;
        }
        throw err;
      }
    }
    const fields = {
      displayName: displayName !== void 0 ? finalName : void 0,
      avatarId,
      customAvatarData,
      tagline: tagline !== void 0 ? tagline : void 0,
      websiteUrl: websiteUrl !== void 0 ? websiteUrl : void 0,
      githubUrl: githubUrl !== void 0 ? githubUrl : void 0,
      twitterUrl: twitterUrl !== void 0 ? twitterUrl : void 0,
      facebookUrl: facebookUrl !== void 0 ? facebookUrl : void 0,
      instagramUrl: instagramUrl !== void 0 ? instagramUrl : void 0,
      youtubeUrl: youtubeUrl !== void 0 ? youtubeUrl : void 0,
      linkedinUrl: linkedinUrl !== void 0 ? linkedinUrl : void 0
    };
    const { assignments, params } = buildCitizenProfileUpdate(fields);
    if (assignments.length === 0) {
      res.json({ success: true, citizen });
      return;
    }
    params.push(citizen.id);
    const updateRes = await query(
      `UPDATE citizens SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING ${CITIZEN_PROFILE_COLUMNS}`,
      params
    );
    const updatedCitizen = updateRes.rows[0];
    broadcastRealtimeEvent({
      type: "profile_updated",
      citizen: updatedCitizen
    });
    res.json({ success: true, citizen: updatedCitizen });
  } catch (err) {
    console.error("Error updating citizen profile:", err);
    res.status(500).json({ error: "InternalServerError" });
  }
});
apiRouter.delete("/citizens/me", requireAuthMiddleware, async (req, res) => {
  const citizen = req.citizen;
  try {
    const spotRes = await query(`SELECT id, x, y FROM spots WHERE owner_id = $1 LIMIT 1`, [citizen.id]);
    const releasedSpot = spotRes.rows[0];
    if (releasedSpot) {
      await query(`UPDATE spots SET owner_id = NULL, claimed_at = NULL WHERE owner_id = $1`, [citizen.id]);
    }
    await query(`DELETE FROM citizens WHERE id = $1`, [citizen.id]);
    res.clearCookie(COOKIE_NAME, { path: "/" });
    if (releasedSpot) {
      broadcastRealtimeEvent({
        type: "spot_released",
        spotId: releasedSpot.id,
        x: releasedSpot.x,
        y: releasedSpot.y,
        citizenId: citizen.id
      });
    }
    res.json({ success: true, message: "Account and spot successfully deleted." });
  } catch (err) {
    console.error("Error deleting citizen account:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to delete account" });
  }
});
apiRouter.get("/stats", async (_req, res) => {
  try {
    const statsRes = await query(`
      SELECT 
        count(*) as total_spots,
        count(owner_id) as claimed_spots,
        (SELECT count(*) FROM citizens) as total_citizens
      FROM spots
    `);
    res.json({
      totalSpots: parseInt(statsRes.rows[0].total_spots, 10),
      claimedSpots: parseInt(statsRes.rows[0].claimed_spots, 10),
      totalCitizens: parseInt(statsRes.rows[0].total_citizens, 10)
    });
  } catch (err) {
    res.status(500).json({ error: "InternalServerError" });
  }
});

// apps/server/src/app.ts
var app = express();
app.set("trust proxy", 1);
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object" && !req._body) {
    req._body = true;
  }
  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith("http://localhost") || origin === config.corsOrigin) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true
  })
);
app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: "64kb" }));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api", apiRouter);
app.use((err, _req, res, _next) => {
  console.error("Unhandled Server Error:", err);
  res.status(500).json({ error: "InternalServerError", message: "An unexpected error occurred" });
});
export {
  app
};
