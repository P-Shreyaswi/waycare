const express = require("express"), path = require("path"), Database = require("better-sqlite3"),
  bcrypt = require("bcryptjs"), jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Hs = require("./public/hospital.js");
const app = express(), PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
if (SECRET === "dev-secret-change-me") console.warn("WARNING: set JWT_SECRET before deploying");
app.set("trust proxy", 1);
app.use(express.json());
// Anonymous visitor id: random code in a cookie. No name, email or sign-in for patients.
app.use((req, res, next) => {
  let v = cookies(req).vid;
  if (!/^[a-f0-9]{12}$/.test(v || "")) { v = crypto.randomBytes(6).toString("hex");
    res.cookie("vid", v, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 365 * 864e5 }); }
  req.vid = v; next();
});

// ---------- Database ----------
const db = new Database(process.env.DB_PATH || path.join(__dirname, "waycare.db"));
db.exec(`
create table if not exists users(id integer primary key, name text not null, email text unique not null,
  pass text not null, role text not null default 'user', created_at text default current_timestamp);
create table if not exists visitor_searches(id integer primary key, visitor_id text not null, from_id text, to_id text,
  step_free integer, created_at text default current_timestamp);
create table if not exists closures(a text, b text, created_by integer, created_at text default current_timestamp, primary key(a,b));`);
if (!db.prepare("select 1 from users where role='admin'").get()) {
  const e = process.env.ADMIN_EMAIL || "admin@waycare.local", p = process.env.ADMIN_PASSWORD || "admin123";
  db.prepare("insert into users(name,email,pass,role) values(?,?,?,'admin')").run("Hospital Admin", e, bcrypt.hashSync(p, 10));
  console.log("Seeded admin account:", e);
}

// ---------- Helpers ----------
const place = id => Hs.L[id] ? Hs.L[id] + " (" + Hs.FN[Hs.fl[id]] + ")" : id;
const closures = () => db.prepare("select a,b from closures").all().map(r => [r.a, r.b]);
const closedSet = () => new Set(closures().flatMap(([a, b]) => [a + "|" + b, b + "|" + a]));
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(c => c.trim().split("="))
  .filter(c => c[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
const sign = (res, id) => res.cookie("token", jwt.sign({ id }, SECRET, { expiresIn: "7d" }),
  { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 864e5 });
function getUser(req) {
  try { const p = jwt.verify(cookies(req).token, SECRET);
    return db.prepare("select id,name,email,role from users where id=?").get(p.id) || null; } catch (e) { return null; }
}
const auth = (req, res, next) => { req.user = getUser(req); req.user ? next() : res.status(401).json({ error: "Please log in" }); };
const adminOnly = (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Admins only" });
const hits = new Map();
const limit = (req, res, next) => { const n = Date.now(), a = (hits.get(req.ip) || []).filter(t => n - t < 60000); a.push(n); hits.set(req.ip, a);
  a.length > 20 ? res.status(429).json({ error: "Too many attempts, wait a minute" }) : next(); };

// ---------- Auth ----------
app.post("/api/auth/login", limit, (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare("select * from users where email=?").get((email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(password || "", u.pass)) return res.status(401).json({ error: "Wrong email or password" });
  sign(res, u.id); res.json({ ok: true });
});
app.post("/api/auth/logout", (q, res) => { res.clearCookie("token"); res.json({ ok: true }); });
app.get("/api/me/history", (req, res) => res.json(
  db.prepare("select from_id,to_id,step_free,created_at from visitor_searches where visitor_id=? order by id desc limit 8").all(req.vid)));

// ---------- Navigation (logged-in users) ----------
app.get("/api/health", (q, s) => s.json({ ok: true }));
app.get("/api/route", (req, res) => {
  const { from, to, stepFree, auto } = req.query;
  if (!Hs.pos[from] || !Hs.pos[to]) return res.status(400).json({ error: "Unknown location" });
  const sf = stepFree === "true", r = Hs.path(from, to, sf, closedSet());
  if (auto !== "1") db.prepare("insert into visitor_searches(visitor_id,from_id,to_id,step_free) values(?,?,?,?)").run(req.vid, from, to, sf ? 1 : 0);
  if (r.t >= 1e9) return res.status(404).json({ error: "No route available right now (closures or no step-free path)" });
  res.json({ p: r.p, t: r.t, steps: Hs.directions(r.p) });
});
app.get("/api/closures", (q, s) => s.json(closures()));
app.get("/api/appointments/:id", (q, s) => s.json({ patient: "Demo Patient", clinicName: "Orthopedics", time: "10:30", roomId: Hs.byName("Orthopedics") }));

// ---------- Admin only ----------
const label = v => "Visitor " + v.slice(0, 6);
app.get("/api/admin/stats", auth, adminOnly, (q, s) => {
  const one = sql => db.prepare(sql).get().c;
  s.json({ visitors: one("select count(distinct visitor_id) c from visitor_searches"), searches: one("select count(*) c from visitor_searches"),
    today: one("select count(*) c from visitor_searches where date(created_at)=date('now')"),
    stepFree: one("select count(*) c from visitor_searches where step_free=1"),
    top: db.prepare("select to_id,count(*) c from visitor_searches group by to_id order by c desc limit 5").all().map(r => ({ name: place(r.to_id), count: r.c })) });
});
app.get("/api/admin/searches", auth, adminOnly, (req, res) => {
  const v = /^[a-f0-9]{12}$/.test(req.query.visitor || "") ? req.query.visitor : null;
  const rows = db.prepare("select id,created_at,visitor_id,from_id,to_id,step_free from visitor_searches where (? is null or visitor_id=?) order by id desc limit 200").all(v, v);
  res.json(rows.map(r => ({ ...r, label: label(r.visitor_id), from: place(r.from_id), to: place(r.to_id) })));
});
app.get("/api/admin/visitors", auth, adminOnly, (q, s) => s.json(db.prepare(
  "select visitor_id id,count(*) searches,sum(step_free) stepFree,max(created_at) last_seen from visitor_searches group by visitor_id order by max(id) desc limit 100")
  .all().map(r => ({ ...r, label: label(r.id) }))));
const isCorridor = (a, b) => a && b && a[0] === "c" && b[0] === "c" && Hs.adj[a] && Hs.adj[a].some(e => e[0] === b);
app.post("/api/admin/closures", auth, adminOnly, (req, res) => {
  const { a, b } = req.body || {};
  if (!isCorridor(a, b)) return res.status(400).json({ error: "Not a corridor segment" });
  const k = [a, b].sort();
  db.prepare("insert or ignore into closures(a,b,created_by) values(?,?,?)").run(k[0], k[1], req.user.id); res.json(closures());
});
app.delete("/api/admin/closures", auth, adminOnly, (req, res) => {
  const k = [req.query.a, req.query.b].sort();
  db.prepare("delete from closures where a=? and b=?").run(k[0], k[1]); res.json(closures());
});

// Privacy: delete search history older than RETAIN_DAYS (default 30)
const KEEP = parseInt(process.env.RETAIN_DAYS || "30");
const purge = () => db.prepare("delete from visitor_searches where created_at < datetime('now', ?)").run("-" + KEEP + " days");
purge(); setInterval(purge, 36e5);

// ---------- Pages ----------
app.get("/admin", (req, res) => { const u = getUser(req);
  res.sendFile(path.join(__dirname, "admin", u && u.role === "admin" ? "admin.html" : "login.html")); });
app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, () => console.log("WayCare running on http://localhost:" + PORT));
