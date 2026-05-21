const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { URL } = require("url");
const STORE_DIRECTORY = require("./store-config.json");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const RESPONSES_FILE = path.join(DATA_DIR, "survey-responses.json");
const ADMIN_PASSWORD_FILE = path.join(DATA_DIR, "admin-password.txt");
const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "survey_responses";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_SECRET = crypto.randomBytes(32).toString("hex");
const LOCAL_HOST_NAME = getLocalHostName();
const FIXED_SURVEY_ORIGIN =
  process.env.SURVEY_PUBLIC_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://${LOCAL_HOST_NAME}.local:${PORT}`;
const FIXED_SURVEY_URL = `${FIXED_SURVEY_ORIGIN}/`;
const FIXED_QR_ASSET_PATH = "/assets/store-survey-qr.svg";
const IS_PUBLIC_HTTPS = FIXED_SURVEY_ORIGIN.startsWith("https://");
const DEFAULT_STORE_ID = STORE_DIRECTORY[0]?.id || "kitasenju";

let adminPasswordCache = null;
const META_PREFIX = "__meta__:";
const META_MARKER = "__meta__";

const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/qr.html": "qr.html",
  "/admin.html": "admin.html",
  "/style.css": "style.css",
  "/script.js": "script.js",
  "/admin.js": "admin.js",
  "/qr.js": "qr.js",
};

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

async function ensureDataFiles() {
  if (isSupabaseConfigured()) {
    return;
  }

  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.promises.access(RESPONSES_FILE);
  } catch (error) {
    await fs.promises.writeFile(RESPONSES_FILE, "[]\n", "utf8");
  }

  try {
    await fs.promises.access(ADMIN_PASSWORD_FILE);
  } catch (error) {
    const generatedPassword = crypto.randomBytes(8).toString("hex");
    await fs.promises.writeFile(ADMIN_PASSWORD_FILE, `${generatedPassword}\n`, "utf8");
  }
}

async function getAdminPassword() {
  const entries = await readStoredEntries();
  const passwordOverride = getLatestPasswordOverride(entries);
  if (passwordOverride) {
    return passwordOverride;
  }

  if (process.env.ADMIN_PASSWORD) {
    return {
      mode: "plain",
      value: String(process.env.ADMIN_PASSWORD),
    };
  }

  if (adminPasswordCache) {
    return {
      mode: "plain",
      value: adminPasswordCache,
    };
  }

  await ensureDataFiles();
  adminPasswordCache = (await fs.promises.readFile(ADMIN_PASSWORD_FILE, "utf8")).trim();
  return {
    mode: "plain",
    value: adminPasswordCache,
  };
}

async function readStoredEntries() {
  if (isSupabaseConfigured()) {
    return readEntriesFromSupabase();
  }

  await ensureDataFiles();
  const raw = await fs.promises.readFile(RESPONSES_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeStoredEntries(entries) {
  if (isSupabaseConfigured()) {
    throw new Error("direct_write_not_supported");
  }

  await ensureDataFiles();
  await fs.promises.writeFile(RESPONSES_FILE, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function readResponses() {
  const entries = await readStoredEntries();
  const resetAt = getLatestResetAt(entries);

  return entries
    .filter((entry) => !isMetaEntry(entry))
    .filter((entry) => !resetAt || new Date(entry.createdAt).getTime() >= new Date(resetAt).getTime())
    .map(hydrateResponse);
}

function normalizeSupabaseUrl(value) {
  const normalized = String(value || "").trim();
  return normalized.replace(/\/+$/, "");
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extraHeaders,
  };
}

async function readEntriesFromSupabase() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  url.searchParams.set("select", "id,createdAt,rating,reviewEligible,goodPoint,comment");
  url.searchParams.set("order", "createdAt.desc");

  const response = await fetch(url, {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`supabase_read_failed:${response.status}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function insertStoredEntry(entry) {
  if (!isSupabaseConfigured()) {
    const entries = await readStoredEntries();
    entries.push(entry);
    await writeStoredEntries(entries);
    return entry;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
    method: "POST",
    headers: getSupabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify([
      {
        id: entry.id,
        createdAt: entry.createdAt,
        rating: entry.rating,
        reviewEligible: entry.reviewEligible,
        goodPoint: entry.goodPoint,
        comment: entry.comment,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`supabase_insert_failed:${response.status}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("supabase_insert_empty");
  }

  return hydrateResponse(rows[0]);
}

async function insertResponse(entry) {
  const savedEntry = await insertStoredEntry({
    id: entry.id,
    createdAt: entry.createdAt,
    rating: entry.rating,
    reviewEligible: entry.reviewEligible,
    goodPoint: entry.goodPoint,
    comment: entry.comment,
  });

  return hydrateResponse({
    ...savedEntry,
    storeId: entry.storeId,
    storeName: entry.storeName,
  });
}

function getStoreById(storeId) {
  return (
    STORE_DIRECTORY.find((entry) => entry.id === storeId) ||
    STORE_DIRECTORY.find((entry) => entry.id === DEFAULT_STORE_ID) ||
    STORE_DIRECTORY[0]
  );
}

function getSurveyUrlForStore(storeId) {
  const store = getStoreById(storeId);
  if (!store || store.id === DEFAULT_STORE_ID) {
    return FIXED_SURVEY_URL;
  }

  return `${FIXED_SURVEY_URL}?store=${encodeURIComponent(store.id)}`;
}

function serializeStore(store) {
  return {
    id: store.id,
    name: store.name,
    reviewUrl: store.reviewUrl,
    surveyUrl: getSurveyUrlForStore(store.id),
  };
}

function inferStoreIdFromEntry(entry) {
  if (entry.storeId && getStoreById(entry.storeId)) {
    return entry.storeId;
  }

  const rawId = String(entry.id || "");
  const matchedStore = STORE_DIRECTORY.find((store) => rawId.startsWith(`${store.id}-`));
  return matchedStore?.id || DEFAULT_STORE_ID;
}

function hydrateResponse(entry) {
  const storeId = inferStoreIdFromEntry(entry);
  const store = getStoreById(storeId);

  return {
    ...entry,
    storeId: store.id,
    storeName: entry.storeName || store.name,
  };
}

function isMetaEntry(entry) {
  return String(entry.id || "").startsWith(META_PREFIX) || entry.goodPoint === META_MARKER;
}

function parseMetaEntry(entry) {
  if (!isMetaEntry(entry)) {
    return null;
  }

  try {
    const payload = JSON.parse(String(entry.comment || "{}"));
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      type: payload.type,
      payload: payload.payload || {},
    };
  } catch (error) {
    return null;
  }
}

function buildMetaEntry(type, payload) {
  return {
    id: `${META_PREFIX}${type}:${Date.now()}`,
    createdAt: new Date().toISOString(),
    rating: 1,
    reviewEligible: false,
    goodPoint: META_MARKER,
    comment: JSON.stringify({
      type,
      payload,
    }),
  };
}

function getLatestMeta(entries, type) {
  return entries
    .map(parseMetaEntry)
    .filter((entry) => entry && entry.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}

function getLatestResetAt(entries) {
  return getLatestMeta(entries, "monthly_reset")?.payload?.effectiveFrom || null;
}

function getLatestPasswordOverride(entries) {
  const latest = getLatestMeta(entries, "password_override");
  if (!latest?.payload?.hash || !latest?.payload?.salt) {
    return null;
  }

  return {
    mode: "hash",
    hash: latest.payload.hash,
    salt: latest.payload.salt,
  };
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: crypto.scryptSync(String(password), salt, 64).toString("hex"),
  };
}

function getTokyoMonthStartISOString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return new Date(`${year}-${month}-01T00:00:00+09:00`).toISOString();
}

function summarizeResponses(responses) {
  const totalCount = responses.length;
  const totalRating = responses.reduce((sum, entry) => sum + Number(entry.rating || 0), 0);
  const reviewEligibleCount = responses.filter((entry) => entry.reviewEligible).length;
  const averageRating = totalCount ? Number((totalRating / totalCount).toFixed(1)) : null;

  const storeMap = new Map();
  STORE_DIRECTORY.forEach((store) => {
    storeMap.set(store.id, {
      storeId: store.id,
      storeName: store.name,
      totalCount: 0,
      totalRating: 0,
    });
  });

  responses.forEach((entry) => {
    const key = entry.storeId || DEFAULT_STORE_ID;
    if (!storeMap.has(key)) {
      storeMap.set(key, {
        storeId: key,
        storeName: entry.storeName || key,
        totalCount: 0,
        totalRating: 0,
      });
    }

    const summary = storeMap.get(key);
    summary.totalCount += 1;
    summary.totalRating += Number(entry.rating || 0);
  });

  const storeSummaries = Array.from(storeMap.values()).map((summary) => ({
    storeId: summary.storeId,
    storeName: summary.storeName,
    totalCount: summary.totalCount,
    averageRating: summary.totalCount
      ? Number((summary.totalRating / summary.totalCount).toFixed(1))
      : null,
  }));

  return {
    overall: {
      totalCount,
      averageRating,
      reviewEligibleCount,
    },
    stores: storeSummaries,
  };
}

function getLocalHostName() {
  try {
    return execFileSync("scutil", ["--get", "LocalHostName"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    return os.hostname().replace(/[^a-zA-Z0-9-]/g, "") || "survey-host";
  }
}

function buildHeaders(contentType, extraHeaders = {}) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    "Content-Type": contentType,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extraHeaders,
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, buildHeaders(CONTENT_TYPES[".json"], extraHeaders));
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text, contentType, extraHeaders = {}) {
  response.writeHead(statusCode, buildHeaders(contentType, extraHeaders));
  response.end(text);
}

async function serveStatic(response, pathname) {
  if (pathname.startsWith("/assets/")) {
    await serveAsset(response, pathname);
    return;
  }

  const fileName = STATIC_FILES[pathname];
  if (!fileName) {
    sendText(response, 404, "Not Found", "text/plain; charset=utf-8");
    return;
  }

  await serveFile(response, path.join(ROOT_DIR, fileName));
}

async function serveAsset(response, pathname) {
  const filePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!filePath.startsWith(path.join(ROOT_DIR, "assets"))) {
    sendText(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  await serveFile(response, filePath);
}

async function serveFile(response, filePath) {
  const extension = path.extname(filePath);

  try {
    const file = await fs.promises.readFile(filePath);
    response.writeHead(
      200,
      buildHeaders(CONTENT_TYPES[extension] || "application/octet-stream"),
    );
    response.end(file);
  } catch (error) {
    sendText(response, 500, "File Error", "text/plain; charset=utf-8");
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("too_large"));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeResponse(payload) {
  const rating = Number(payload.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  const store = getStoreById(String(payload.storeId || DEFAULT_STORE_ID));

  return {
    id: `${store.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storeId: store.id,
    storeName: store.name,
    rating,
    goodPoint: String(payload.goodPoint || "").slice(0, 120).trim(),
    comment: String(payload.comment || "").slice(0, 500).trim(),
    createdAt: new Date().toISOString(),
    reviewEligible: rating >= 4,
  };
}

function escapeCsv(value) {
  const normalized = String(value ?? "");
  if (normalized.includes('"') || normalized.includes(",") || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

async function buildCsv() {
  const responses = await readResponses();
  const rows = [
    ["id", "storeId", "storeName", "createdAt", "rating", "reviewEligible", "goodPoint", "comment"],
    ...responses.map((entry) => [
      entry.id,
      entry.storeId || DEFAULT_STORE_ID,
      entry.storeName || getStoreById(entry.storeId || DEFAULT_STORE_ID)?.name || "",
      entry.createdAt,
      entry.rating,
      entry.reviewEligible ? "yes" : "no",
      entry.goodPoint,
      entry.comment,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function parseCookies(request) {
  const cookieHeader = request.headers.cookie || "";
  const cookies = {};

  cookieHeader.split(";").forEach((part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) {
      return;
    }
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  });

  return cookies;
}

function signValue(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createAdminSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
  ).toString("base64url");

  return `${payload}.${signValue(payload)}`;
}

function verifyAdminSessionToken(token) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signValue(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.role === "admin" && Number(decoded.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function isAdminAuthenticated(request) {
  const cookies = parseCookies(request);
  return verifyAdminSessionToken(cookies.survey_admin_session);
}

function clearAdminSession(response) {
  return {
    "Set-Cookie": buildAdminSessionCookie("", 0),
  };
}

function buildAdminSessionCookie(token, maxAgeSeconds) {
  const secureFlag = IS_PUBLIC_HTTPS ? "; Secure" : "";
  return `survey_admin_session=${token}; HttpOnly; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Strict${secureFlag}`;
}

function requireAdmin(request, response) {
  if (isAdminAuthenticated(request)) {
    return true;
  }

  sendJson(response, 401, { error: "unauthorized" });
  return false;
}

function getClientAddress(request) {
  return String(request.socket.remoteAddress || "");
}

function isValidAdminPassword(input, actualPassword) {
  if (actualPassword?.mode === "hash") {
    const candidateHash = crypto
      .scryptSync(String(input || ""), actualPassword.salt, 64)
      .toString("hex");
    const actual = Buffer.from(actualPassword.hash, "hex");
    const received = Buffer.from(candidateHash, "hex");

    if (actual.length !== received.length) {
      return false;
    }

    return crypto.timingSafeEqual(actual, received);
  }

  const actual = Buffer.from(String(actualPassword?.value || ""));
  const received = Buffer.from(String(input || ""));

  if (actual.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, received);
}

async function handleApi(request, response, requestUrl) {
  const pathname = requestUrl.pathname;

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/api/config") {
    const selectedStore = getStoreById(requestUrl.searchParams.get("store") || DEFAULT_STORE_ID);
    sendJson(response, 200, {
      fixedSurveyUrl: getSurveyUrlForStore(selectedStore.id),
      fixedSurveyOrigin: FIXED_SURVEY_ORIGIN,
      fixedQrAssetPath: FIXED_QR_ASSET_PATH,
      localHostName: `${LOCAL_HOST_NAME}.local`,
      selectedStore: serializeStore(selectedStore),
      stores: STORE_DIRECTORY.map(serializeStore),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/login") {
    try {
      const payload = JSON.parse((await readBody(request)) || "{}");
      const adminPassword = await getAdminPassword();

      if (!isValidAdminPassword(payload.password, adminPassword)) {
        sendJson(response, 401, { error: "invalid_password" });
        return;
      }

      const token = createAdminSessionToken();
      sendJson(
        response,
        200,
        { ok: true },
        {
          "Set-Cookie": buildAdminSessionCookie(token, SESSION_MAX_AGE_SECONDS),
        },
      );
      return;
    } catch (error) {
      sendJson(response, 400, { error: "invalid_payload" });
      return;
    }
  }

  if (request.method === "POST" && pathname === "/api/admin/logout") {
    sendJson(response, 200, { ok: true }, clearAdminSession(response));
    return;
  }

  if (request.method === "GET" && pathname === "/api/surveys") {
    if (!requireAdmin(request, response)) {
      return;
    }

    const responses = await readResponses();
    const rawEntries = await readStoredEntries();
    sendJson(response, 200, {
      responses: responses.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      summary: summarizeResponses(responses),
      activePeriodStart: getLatestResetAt(rawEntries),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/change-password") {
    if (!requireAdmin(request, response)) {
      return;
    }

    try {
      const payload = JSON.parse((await readBody(request)) || "{}");
      const currentPassword = await getAdminPassword();

      if (!isValidAdminPassword(payload.currentPassword, currentPassword)) {
        sendJson(response, 401, { error: "invalid_password" });
        return;
      }

      const nextPassword = String(payload.newPassword || "").trim();
      if (nextPassword.length < 8) {
        sendJson(response, 400, { error: "password_too_short" });
        return;
      }

      const passwordHash = createPasswordHash(nextPassword);
      await insertStoredEntry(
        buildMetaEntry("password_override", {
          hash: passwordHash.hash,
          salt: passwordHash.salt,
        }),
      );
      sendJson(response, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(response, 400, { error: "invalid_payload" });
      return;
    }
  }

  if (request.method === "POST" && pathname === "/api/admin/reset-month") {
    if (!requireAdmin(request, response)) {
      return;
    }

    const effectiveFrom = getTokyoMonthStartISOString();
    await insertStoredEntry(
      buildMetaEntry("monthly_reset", {
        effectiveFrom,
      }),
    );

    sendJson(response, 200, { ok: true, effectiveFrom });
    return;
  }

  if (request.method === "GET" && pathname === "/api/surveys.csv") {
    if (!requireAdmin(request, response)) {
      return;
    }

    const csv = await buildCsv();
    response.writeHead(
      200,
      buildHeaders(CONTENT_TYPES[".csv"], {
        "Content-Disposition": 'attachment; filename="survey-responses.csv"',
      }),
    );
    response.end(csv);
    return;
  }

  if (request.method === "POST" && pathname === "/api/surveys") {
    try {
      const rawBody = await readBody(request);
      const payload = JSON.parse(rawBody || "{}");
      const entry = normalizeResponse(payload);

      if (!entry) {
        sendJson(response, 400, { error: "invalid_payload" });
        return;
      }

      const savedEntry = await insertResponse(entry);
      sendJson(response, 201, { ok: true, entry: savedEntry });
      return;
    } catch (error) {
      sendJson(response, 500, { error: "save_failed" });
      return;
    }
  }

  sendJson(response, 404, { error: "not_found" });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl);
      return;
    }

    await serveStatic(response, pathname);
  } catch (error) {
    sendJson(response, 500, {
      error: "server_error",
      requestId: crypto.createHash("sha1").update(getClientAddress(request)).digest("hex").slice(0, 8),
    });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureDataFiles();
  const adminPassword = await getAdminPassword();

  console.log(`Survey app running at http://127.0.0.1:${PORT}`);
  console.log(`Fixed survey URL: ${FIXED_SURVEY_URL}`);
  console.log(`QR reference page: ${FIXED_SURVEY_ORIGIN}/qr.html`);
  console.log(`Admin page: ${FIXED_SURVEY_ORIGIN}/admin.html`);
  if (isSupabaseConfigured()) {
    console.log(`Data backend: Supabase (${SUPABASE_TABLE})`);
  } else {
    console.log(`Data backend: local file (${RESPONSES_FILE})`);
  }
  if (process.env.ADMIN_PASSWORD) {
    console.log("Admin password source: ADMIN_PASSWORD env");
  } else {
    console.log(`Admin password file: ${ADMIN_PASSWORD_FILE}`);
    if (adminPassword.mode === "plain") {
      console.log(`Admin password: ${adminPassword.value}`);
    } else {
      console.log("Admin password source: stored override");
    }
  }
});
