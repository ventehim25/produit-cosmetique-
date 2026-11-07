// Robot de prospection NAYRA — OpenStreetMap (API Overpass, licence ODbL = réutilisation légale).
// Collecte les commerces marocains qui pourraient revendre le savon noir et le ghassoul NAYRA :
// herboristes/attarine, cosmétiques, hammams, instituts de beauté, hanouts, coopératives, bio,
// souvenirs, coiffeurs, parapharmacies, pharmacies. Priorités validées avec ChatGPT le 07/11/2026.
// Uniquement les données publiées dans OSM — rien n'est inventé ; champ vide = inconnu.
//
// Lancer : node prospection/robot-osm.mjs   (ou double-clic sur « Mettre a jour les prospects.bat »)
// Sortie  : prospection/donnees/prospects.json (lu par l'application) + prospects.csv (Excel) + RESUME.md
//           Le dossier donnees/ n'est PAS envoyé sur GitHub (dépôt public = pas de contacts en ligne).
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "NAYRA-prospection/1.0";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "donnees");
const JSON_FILE = join(OUT_DIR, "prospects.json");
const today = new Date().toISOString().slice(0, 10);

// Passage suivant : on garde la date de première détection de chaque commerce (= « nouveaux »)
const firstSeen = new Map();
if (existsSync(JSON_FILE)) {
  for (const p of JSON.parse(readFileSync(JSON_FILE, "utf8")).prospects) firstSeen.set(p.id, p.premiere_vue);
}

// Type de commerce -> balises OSM. L'ordre compte : un point déjà pris n'est pas repris plus bas
// (ex. une pharmacie nommée « Para… » reste une parapharmacie).
const SEGMENTS = [
  { label: "Herboriste / attar", pts: 4.5, tags: ['["shop"="herbalist"]', '["shop"="spices"]'] },
  { label: "Cosmétiques / parfumerie", pts: 4.5, tags: ['["shop"="cosmetics"]', '["shop"="perfumery"]'] },
  { label: "Hammam", pts: 4, tags: ['["amenity"="public_bath"]', '["bath:type"="hammam"]'] },
  { label: "Institut de beauté / spa", pts: 3.5, tags: ['["shop"="beauty"]', '["shop"="massage"]', '["leisure"="spa"]', '["amenity"="spa"]'] },
  { label: "Coopérative / terroir", pts: 3, tags: ['["shop"]["name"~"coop|تعاونية",i]', '["craft"]["name"~"coop|تعاونية",i]', '["shop"]["name"~"argan|أركان",i]'] },
  { label: "Magasin bio / naturel", pts: 3, tags: ['["shop"="health_food"]', '["shop"="organic"]'] },
  { label: "Hanout / épicerie", pts: 3, tags: ['["shop"="convenience"]', '["shop"="grocery"]', '["shop"="general"]', '["shop"="supermarket"][!"brand"]'] },
  { label: "Souvenirs / artisanat", pts: 2.5, tags: ['["shop"="gift"]', '["shop"="souvenir"]', '["shop"="craft"]'] },
  { label: "Parapharmacie / droguerie", pts: 2.5, tags: ['["shop"="chemist"]', '["amenity"="pharmacy"]["name"~"para",i]'] },
  { label: "Salon de coiffure", pts: 2, tags: ['["shop"="hairdresser"]'] },
  { label: "Pharmacie", pts: 1, tags: ['["amenity"="pharmacy"]'] },
];

// Mots qui montrent que le commerce vend déjà des produits proches de NAYRA
const KEYWORDS = /gh?a?ss?oul|rhassoul|savon|sabon|beldi|hamm?am|argan|herbo|attar|naturel|nature|bio\b|tradition|beaut|cosm|عطار|غاسول|صابون|بلدي|حمام|أركان|اركان|أعشاب|اعشاب|طبيعي|تجميل/i;
// Grandes villes et villes touristiques (plus de passage, villes test conseillées : Marrakech, Casablanca, Fès)
const BIG = /casablanca|rabat|sal[ée]|marrakech|f[eè]s|tanger|agadir|mekn[eè]s|t[ée]touan|oujda|k[ée]nitra|el jadida|essaouira|chefchaouen|ouarzazate|nador|mohammedia|t[ée]mara/i;

async function overpass(query) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
    });
    if (res.ok) return (await res.json()).elements;
    console.warn(`Overpass HTTP ${res.status} (essai ${attempt})`);
    await new Promise((r) => setTimeout(r, 15000 * attempt));
  }
  throw new Error("Overpass indisponible, réessaie plus tard.");
}

const AREA = 'area["ISO3166-1"="MA"][admin_level=2]->.ma;';

// Villes/bourgs pour rattacher chaque point à la ville la plus proche.
// Nom en français seulement (« Tanger طنجة » -> « Tanger »).
console.log("Villes…");
const cleanName = (n) => n.split(/\s*[؀-ۿⴰ-⵿]/)[0].trim() || n;
const places = (await overpass(`[out:json][timeout:120];${AREA}node["place"~"^(city|town)$"](area.ma);out tags center;`))
  .filter((p) => p.tags?.name)
  .map((p) => ({ name: cleanName(p.tags["name:fr"] || p.tags.name), city: p.tags.place === "city", lat: p.lat, lon: p.lon }));

const km = (a, lat, lon) => 111.2 * Math.hypot(a.lat - lat, (a.lon - lon) * Math.cos((lat * Math.PI) / 180));
// Une grande ville à moins de 15 km l'emporte : les quartiers (Touarga, Méchouar Fès Jdid…) restent dans leur ville
function nearestCity(lat, lon) {
  let best = null, bd = Infinity, bestCity = null, bc = Infinity;
  for (const p of places) {
    const d = km(p, lat, lon);
    if (d < bd) { bd = d; best = p; }
    if (p.city && d < bc) { bc = d; bestCity = p; }
  }
  return (bc <= 15 ? bestCity : best)?.name || "";
}

// Normalise un numéro marocain -> "06 xx xx xx xx" ; lien WhatsApp si c'est un mobile
function normPhone(raw) {
  const out = [];
  for (const part of String(raw || "").split(/[;,/]| ou /)) {
    let d = part.replace(/[^\d+]/g, "");
    if (!d) continue;
    if (d.startsWith("+212")) d = d.slice(4);
    else if (d.startsWith("00212")) d = d.slice(5);
    else if (d.startsWith("212") && d.length === 12) d = d.slice(3);
    if (d.startsWith("0")) d = d.slice(1);
    if (d.length !== 9) { out.push({ tel: part.trim(), wa: "" }); continue; }
    out.push({ tel: "0" + d.replace(/(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5"), wa: /^[67]/.test(d) ? `https://wa.me/212${d}` : "" });
  }
  return out;
}

// E-mail générique (contact@, info@…) = adresse de société ; nominatif = donnée personnelle (loi 09-08)
const GENERIC = /^(contact|info|infos|commercial|vente|ventes|sales|service|services|admin|direction|accueil|bonjour|hello|support|reservation|reservations|booking|spa|hammam|boutique|shop|magasin|office|mail)[\d._-]*@/i;

// Note d'intérêt /10, barème lisible dans score_detail (à corriger après les premières visites)
function scoreProspect(p, segPts) {
  const parts = [];
  const add = (pts, why) => { if (pts) parts.push([pts, why]); };
  add(segPts, p.type);
  if (KEYWORDS.test(`${p.nom} ${p.nom_ar}`)) add(1.5, "Nom proche de nos produits");
  if (p.whatsapp) add(2, "Mobile/WhatsApp");
  else if (p.telephone) add(1.5, "Téléphone fixe");
  if (p.email) add(p.email_type === "générique" ? 0.5 : 0.25, "E-mail");
  if (p.nom) add(0.5, "Nom connu");
  if (p.horaires || p.site || p.facebook) add(0.5, "Horaires ou site");
  if (BIG.test(p.ville)) add(1, "Grande ville / touristique");
  const score = Math.min(10, Math.round(parts.reduce((s, [n]) => s + n, 0) * 2) / 2);
  return { score, classe: score >= 8 ? "A" : score >= 6 ? "B" : score >= 4 ? "C" : "D", score_detail: parts.map(([n, w]) => `${w} +${n}`).join(" · ") };
}

const seen = new Set();
const rows = [];
for (const seg of SEGMENTS) {
  console.log(`${seg.label}…`);
  const body = seg.tags.map((t) => `nwr${t}(area.ma);`).join("");
  const els = await overpass(`[out:json][timeout:180];${AREA}(${body});out tags center;`);
  let n = 0;
  for (const e of els) {
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = e.tags || {};
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat == null) continue;
    const nom = t.name || t["name:fr"] || t["name:ar"] || t.brand || "";
    const phones = normPhone([t.phone, t["contact:phone"], t["contact:mobile"], t.mobile, t["contact:whatsapp"]].filter(Boolean).join(";"));
    const email = t.email || t["contact:email"] || "";
    const p = {
      id,
      type: seg.label,
      nom,
      nom_ar: t["name:ar"] && t["name:ar"] !== nom ? t["name:ar"] : "",
      ville: nearestCity(lat, lon), // addr:city est écrit de mille façons (Fes, Fès Médina…) : on garde la ville la plus proche
      adresse: [t["addr:housenumber"], t["addr:street"], t["addr:suburb"] || t["addr:district"], t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" "),
      telephone: [...new Set(phones.map((x) => x.tel))].join(" / "),
      whatsapp: phones.find((x) => x.wa)?.wa || "",
      email,
      email_type: email ? (GENERIC.test(email) ? "générique" : "nominatif ? (09-08)") : "",
      site: t.website || t["contact:website"] || "",
      facebook: t["contact:facebook"] || t.facebook || "",
      instagram: t["contact:instagram"] || "",
      horaires: t.opening_hours || "",
      lat: +lat.toFixed(6),
      lon: +lon.toFixed(6),
      osm: `https://www.openstreetmap.org/${id}`,
      premiere_vue: firstSeen.get(id) || today,
    };
    Object.assign(p, scoreProspect(p, seg.pts));
    rows.push(p);
    n++;
  }
  console.log(`  ${n} commerces`);
  await new Promise((r) => setTimeout(r, 5000)); // politesse envers le serveur public
}

rows.sort((a, b) => b.score - a.score || a.ville.localeCompare(b.ville));
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(JSON_FILE, JSON.stringify({ genere_le: new Date().toISOString(), source: "© OpenStreetMap contributors (ODbL)", prospects: rows }));

// Copie Excel (séparateur « ; », BOM pour les accents)
const cols = Object.keys(rows[0]);
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync(join(OUT_DIR, "prospects.csv"), "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));

// Résumé par type de commerce
const byType = {};
for (const r of rows) {
  const s = (byType[r.type] ??= { total: 0, nom: 0, tel: 0, wa: 0, email: 0, A: 0, villes: {} });
  s.total++; if (r.nom) s.nom++; if (r.telephone) s.tel++; if (r.whatsapp) s.wa++; if (r.email) s.email++; if (r.classe === "A") s.A++;
  s.villes[r.ville] = (s.villes[r.ville] || 0) + 1;
}
let md = `# Prospects NAYRA — résumé\n\n> Généré le ${today} par \`prospection/robot-osm.mjs\` (OpenStreetMap, ODbL). Données telles que publiées dans OSM : à **vérifier** avant de démarcher.\n\n`;
md += `| Type | Commerces | Avec nom | Téléphone | WhatsApp | E-mail | Priorité A | Top villes |\n|---|---|---|---|---|---|---|---|\n`;
for (const [type, s] of Object.entries(byType)) {
  const top = Object.entries(s.villes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, n]) => `${v} (${n})`).join(", ");
  md += `| ${type} | ${s.total} | ${s.nom} | ${s.tel} | ${s.wa} | ${s.email} | ${s.A} | ${top} |\n`;
}
const nouveaux = firstSeen.size ? rows.filter((r) => !firstSeen.has(r.id)).length : rows.length;
md += `\n**Total : ${rows.length} commerces · ${rows.filter((r) => r.telephone).length} avec téléphone · ${rows.filter((r) => r.email).length} avec e-mail · ${nouveaux} nouveaux.**\n`;
writeFileSync(join(OUT_DIR, "RESUME.md"), md);
console.log(md);
