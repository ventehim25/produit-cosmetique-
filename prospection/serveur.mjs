// Application locale NAYRA Prospection : sert l'appli (dossier app/) et garde le suivi commercial
// dans donnees/suivi.json. N'écoute que sur ce PC (127.0.0.1) : les contacts ne sortent pas.
//
// Lancer : node prospection/serveur.mjs   (ou double-clic sur « Ouvrir NAYRA Prospection.bat »)
// Puis ouvrir http://localhost:8787 dans Chromium.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP = join(ROOT, "app");
const DATA = join(ROOT, "donnees");
const SUIVI = join(DATA, "suivi.json");
const PORT = 8787;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8" };

mkdirSync(DATA, { recursive: true });
const readSuivi = () => (existsSync(SUIVI) ? JSON.parse(readFileSync(SUIVI, "utf8")) : {});

// Robot lancé depuis l'appli (bouton « Mettre à jour ») : un seul à la fois, journal gardé en mémoire
const robot = { running: false, log: "", fin: null };
function lancerRobot() {
  if (robot.running) return;
  Object.assign(robot, { running: true, log: "", fin: null });
  const p = spawn(process.execPath, [join(ROOT, "robot-osm.mjs")], { cwd: ROOT });
  p.stdout.on("data", (d) => (robot.log += d));
  p.stderr.on("data", (d) => (robot.log += d));
  p.on("close", (code) => Object.assign(robot, { running: false, fin: code === 0 ? "ok" : "erreur" }));
}

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((ok, ko) => {
    let s = "";
    req.on("data", (d) => { s += d; if (s.length > 2e6) ko(new Error("trop gros")); });
    req.on("end", () => ok(s));
  });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/api/prospects") {
      const f = join(DATA, "prospects.json");
      return existsSync(f) ? send(res, 200, readFileSync(f)) : send(res, 404, { erreur: "Aucune donnée : lance le robot." });
    }

    if (url.pathname === "/api/suivi" && req.method === "GET") return send(res, 200, readSuivi());

    // Suivi d'un commerce : { id, data } ; data = null efface le suivi de ce commerce
    if (url.pathname === "/api/suivi" && req.method === "POST") {
      const { id, data } = JSON.parse(await readBody(req));
      if (typeof id !== "string") return send(res, 400, { erreur: "id manquant" });
      const all = readSuivi();
      if (data) all[id] = data; else delete all[id];
      writeFileSync(SUIVI, JSON.stringify(all, null, 1));
      return send(res, 200, { ok: true });
    }

    if (url.pathname === "/api/robot") {
      if (req.method === "POST") lancerRobot();
      return send(res, 200, { running: robot.running, fin: robot.fin, log: robot.log.slice(-4000) });
    }

    // Fichiers de l'appli (rien en dehors du dossier app/)
    const file = normalize(join(APP, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
    if (!file.startsWith(APP) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, "Introuvable", "text/plain; charset=utf-8");
    return send(res, 200, readFileSync(file), TYPES[extname(file)] || "application/octet-stream");
  } catch (e) {
    send(res, 500, { erreur: String(e.message || e) });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`NAYRA Prospection : http://localhost:${PORT}  (laisse cette fenêtre ouverte)`));
