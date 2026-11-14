import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { login, requireStaff, type StaffSession } from "./auth.js";
import { isDatabaseDown, pool } from "./db.js";
import {
  CountError,
  FILTER_TAGS,
  getStaffShelter,
  listShelters,
  lookupZip,
  updateCounts,
  type Count,
  type Point,
} from "./shelters.js";

const app = express();
app.use(cors());
app.use(express.json());
// No request logging on purpose: client location arrives in query strings and must not be stored.

// Every API route lives under /api, so the same server can also serve the web app.
const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Public: anyone can read shelters and live counts.
api.get("/shelters", async (req, res) => {
  const filters = String(req.query.filters ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const unknown = filters.filter((f) => !(FILTER_TAGS as readonly string[]).includes(f));
  if (unknown.length > 0) {
    res.status(400).json({ error: `Unknown filter: ${unknown.join(", ")}` });
    return;
  }

  let origin: Point | null = null;
  let locationLabel: string | null = null;

  const zip = String(req.query.zip ?? "").trim();
  if (zip) {
    const found = await lookupZip(zip);
    if (!found) {
      res.status(404).json({
        error: `We don't have ZIP code ${zip} yet. This demo covers Birmingham, AL (for example 35203).`,
      });
      return;
    }
    origin = { lat: found.lat, lng: found.lng };
    locationLabel = found.label;
  } else if (req.query.lat !== undefined || req.query.lng !== undefined) {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      res.status(400).json({ error: "Location is not valid." });
      return;
    }
    origin = { lat, lng };
    locationLabel = "your location";
  }

  const shelters = await listShelters(origin, filters);
  res.json({ locationLabel, shelters });
});

api.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ error: "Enter your email and password." });
    return;
  }
  const token = await login(email, password);
  if (!token) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  res.json({ token });
});

api.get("/staff/shelter", requireStaff, async (_req, res) => {
  const staff = res.locals.staff as StaffSession;
  const shelter = await getStaffShelter(staff.shelterId);
  if (!shelter) {
    res.status(404).json({ error: "Your shelter record was not found." });
    return;
  }
  res.json({ shelter });
});

api.put("/shelters/:id/counts", requireStaff, async (req, res) => {
  const staff = res.locals.staff as StaffSession;
  const shelterId = Number(req.params.id);
  if (!Number.isInteger(shelterId) || shelterId !== staff.shelterId) {
    res.status(403).json({ error: "You can only update counts for your own shelter." });
    return;
  }

  const shelter = await getStaffShelter(shelterId);
  if (!shelter) {
    res.status(404).json({ error: "Shelter not found." });
    return;
  }
  if (!shelter.approved) {
    res.status(403).json({ error: "This shelter is not approved to post counts yet." });
    return;
  }

  const raw = req.body?.counts;
  if (!Array.isArray(raw) || raw.length === 0) {
    res.status(400).json({ error: "Send at least one count." });
    return;
  }
  const counts: Count[] = [];
  for (const c of raw) {
    const openBeds = c?.openBeds;
    if (typeof c?.category !== "string" || !Number.isInteger(openBeds) || openBeds < 0 || openBeds > 999) {
      res.status(400).json({ error: "Each count needs a category and a whole number from 0 to 999." });
      return;
    }
    counts.push({ category: c.category, openBeds });
  }

  try {
    await updateCounts(shelterId, counts);
  } catch (err) {
    if (err instanceof CountError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  res.json({ shelter: await getStaffShelter(shelterId) });
});

app.use("/api", api);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// When the web app has been built (npm run build in app/), serve it from this server too.
// One address for the app and the API means one link to share and nothing cross-origin.
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/dist");
if (existsSync(path.join(webDir, "index.html"))) {
  app.use(express.static(webDir));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(webDir, "index.html")); // client-side routes such as /staff
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isDatabaseDown(err)) {
    console.error("Database is not reachable. Start it with: docker compose up -d");
    res.status(503).json({ error: "Shelter data is unavailable right now. Try again in a moment." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Try again." });
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`Open Beds is running at http://localhost:${port}`);
  // Say plainly what is wrong at startup, so a demo does not begin with a broken list.
  pool
    .query("select count(*)::int as n from shelters")
    .then((result) => console.log(`Database OK: ${result.rows[0].n} shelters.`))
    .catch((err) => {
      if (isDatabaseDown(err)) {
        console.error("Database is not reachable. Start it with: docker compose up -d");
      } else {
        console.error("Database has no shelter data. Load it with: npm run seed");
      }
    });
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Another copy of this server is probably running. Stop it, or set PORT in .env.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
