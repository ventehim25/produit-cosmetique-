// NAYRA Prospection — tableau de bord des commerces collectés par le robot OpenStreetMap.
// Données : /api/prospects (robot) + /api/suivi (visites, échantillons, relances : donnees/suivi.json).
"use strict";

const STATUTS = {
  nouveau: "Nouveau",
  a_visiter: "À visiter",
  visite: "Visité",
  echantillon: "Échantillon remis",
  interesse: "Intéressé",
  commande: "Première commande",
  revendeur: "Revendeur actif",
  relancer: "À relancer plus tard",
  refus: "Refusé / ne plus contacter",
};
// Raccourcis du journal : texte noté + statut qui en découle
const RAPIDES = [
  ["Appel / WhatsApp", null],
  ["Visite faite", "visite"],
  ["Échantillon remis", "echantillon"],
  ["Intéressé", "interesse"],
  ["Commande", "commande"],
];
// Message WhatsApp proposé (modifiable dans WhatsApp avant l'envoi, un commerce à la fois)
const MSG_WA = "السلام عليكم 👋 معاك نيّرة NAYRA، ماركة مغربية ديال الصابون البلدي والغاسول بالأعشاب فساشيات صغار (3، 5 و10 دراهم). واش نقدر نجيب ليك عينات بلاش تجربهم فالمحل ديالك؟\nBonjour, ici NAYRA : savon noir et ghassoul aux herbes en petits sachets (3, 5 et 10 DH). Puis-je vous déposer des échantillons gratuits ?\n(Pour ne plus recevoir de message : STOP)";
const CLASSES = { A: "Priorité A · 8 à 10", B: "Priorité B · 6 à 7,5", C: "Priorité C · 4 à 5,5", D: "Priorité D · moins de 4" };
// Types de commerce dans l'ordre de priorité du robot (plan validé avec ChatGPT)
const TYPES = ["Herboriste / attar", "Cosmétiques / parfumerie", "Hammam", "Institut de beauté / spa", "Coopérative / terroir", "Magasin bio / naturel",
  "Hanout / épicerie", "Souvenirs / artisanat", "Parapharmacie / droguerie", "Salon de coiffure", "Pharmacie"];
const rangType = (t) => (TYPES.indexOf(t) + 1 || 99);
const PAGE = 60;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => n.toLocaleString("fr-FR");
const jour = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("nayra:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("nayra:" + k, JSON.stringify(v)); } catch { /* navigation privée */ } },
};

let ALL = [];          // tous les commerces
let SUIVI = {};        // id -> { statut, note, relance, journal: [{date, texte}] }
let META = {};
let VUE = [];          // commerces après filtres
let shown = PAGE;
let map, layer, ficheId = null;

const statutDe = (p) => SUIVI[p.id]?.statut || "nouveau";
const color = (c) => getComputedStyle(document.documentElement).getPropertyValue("--c" + c).trim();
// Sur la carte (fond clair OSM) on garde toujours la rampe claire
const MAP_COLORS = { A: "#6E2B19", B: "#9C4A30", C: "#B8613D", D: "#D08A66" };

// ---------- Chargement ----------
async function charger() {
  let res;
  try {
    res = await fetch("/api/prospects", { cache: "no-store" });
  } catch {
    return vide("Cette application fonctionne sur ton PC",
      "Double-clique sur <b>« Ouvrir NAYRA Prospection.bat »</b> dans le dossier <code>prospection</code> : la page s'ouvrira dans Chromium avec tes données.");
  }
  if (res.status === 404 && !res.headers.get("content-type")?.includes("json")) {
    return vide("Cette application fonctionne sur ton PC",
      "Double-clique sur <b>« Ouvrir NAYRA Prospection.bat »</b> dans le dossier <code>prospection</code>.");
  }
  if (!res.ok) return vide("Pas encore de commerces", "Le robot n'a pas encore tourné. Clique sur « Mettre à jour » en haut à droite : il collecte les commerces de tout le Maroc (quelques minutes).");
  const data = await res.json();
  META = data;
  ALL = data.prospects;
  SUIVI = await (await fetch("/api/suivi", { cache: "no-store" })).json();
  $("#maj").textContent = "Données du " + new Date(data.genere_le).toLocaleDateString("fr-FR");
  $("#vide").hidden = true;
  remplirFiltres();
  appliquer();
}

function vide(titre, texte, log) {
  const v = $("#vide");
  v.hidden = false;
  v.innerHTML = `<h2>${titre}</h2><p>${texte}</p>${log ? `<pre>${esc(log)}</pre>` : ""}`;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("on"));
}

// ---------- Filtres ----------
function remplirFiltres() {
  const compte = (key) => {
    const m = new Map();
    for (const p of ALL) m.set(p[key], (m.get(p[key]) || 0) + 1);
    return [...m].filter(([k]) => k).sort((a, b) => b[1] - a[1]);
  };
  $("#f-ville").innerHTML = `<option value="">Toutes (${compte("ville").length})</option>` +
    compte("ville").map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${fmt(n)})</option>`).join("");
  $("#f-type").innerHTML = `<option value="">Tous</option>` +
    compte("type").sort((a, b) => rangType(a[0]) - rangType(b[0])).map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${fmt(n)})</option>`).join("");
  $("#f-statut").innerHTML = `<option value="">Tous</option><option value="suivi">Déjà en suivi</option>` +
    Object.entries(STATUTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  const saved = store.get("filtres") || {};
  for (const [k, v] of Object.entries(saved)) { const el = $("#f-" + k); if (el && [...(el.options || [])].some((o) => o.value === v) || el?.tagName === "INPUT") el.value = v; }
}

function filtres() {
  return { q: $("#f-q").value.trim(), ville: $("#f-ville").value, type: $("#f-type").value, classe: $("#f-classe").value, contact: $("#f-contact").value, statut: $("#f-statut").value };
}

function appliquer(refit = false) {
  const f = filtres();
  store.set("filtres", f);
  const q = f.q.toLowerCase();
  VUE = ALL.filter((p) => {
    if (f.ville && p.ville !== f.ville) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.classe && !f.classe.includes(p.classe)) return false;
    if (f.contact === "tel" && !p.telephone) return false;
    if (f.contact === "wa" && !p.whatsapp) return false;
    if (f.contact === "email" && !p.email) return false;
    if (f.contact === "nom" && !p.nom) return false;
    if (f.statut === "suivi" && !SUIVI[p.id]) return false;
    if (f.statut && f.statut !== "suivi" && statutDe(p) !== f.statut) return false;
    if (q && !`${p.nom} ${p.nom_ar} ${p.ville} ${p.adresse} ${p.telephone}`.toLowerCase().includes(q)) return false;
    return true;
  });
  shown = PAGE;
  $("#compte").textContent = `${fmt(VUE.length)} commerce${VUE.length > 1 ? "s" : ""} affiché${VUE.length > 1 ? "s" : ""} · classés par priorité`;
  kpis();
  dessinerCarte(refit);
  liste();
  relances();
  stats();
}

// ---------- Chiffres clés ----------
function kpis() {
  const v = VUE;
  const joignables = v.filter((p) => p.telephone || p.email).length;
  const suivis = v.filter((p) => SUIVI[p.id]);
  const visites = suivis.filter((p) => ["visite", "echantillon", "interesse", "commande", "revendeur"].includes(statutDe(p))).length;
  const revendeurs = suivis.filter((p) => ["commande", "revendeur"].includes(statutDe(p))).length;
  const nouveaux = v.filter((p) => p.premiere_vue === META.genere_le?.slice(0, 10)).length;
  const pct = (n) => (v.length ? Math.round((n / v.length) * 1000) / 10 : 0).toLocaleString("fr-FR") + " %";
  const tuiles = [
    ["Commerces trouvés", fmt(v.length), nouveaux && nouveaux !== v.length ? `dont ${fmt(nouveaux)} nouveaux` : "par le robot OpenStreetMap"],
    ["Joignables", fmt(joignables), `${pct(joignables)} ont un tél. ou un e-mail`],
    ["Priorité A", fmt(v.filter((p) => p.classe === "A").length), "note de 8 à 10, à voir d'abord"],
    ["Villes", fmt(new Set(v.map((p) => p.ville)).size), "couvertes"],
    ["Visités", fmt(visites), `${fmt(suivis.length)} commerces en suivi`],
    ["Revendeurs", fmt(revendeurs), visites ? `${Math.round((revendeurs / visites) * 100)} % des visités` : "première commande ou plus"],
  ];
  $("#kpis").innerHTML = tuiles.map(([l, val, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${val}</div><div class="s">${s}</div></div>`).join("");
}

// ---------- Carte ----------
function initCarte() {
  map = L.map("carte", { preferCanvas: true }).setView([31.8, -7.1], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
  layer = L.layerGroup().addTo(map);
  $("#legende").innerHTML = ["A", "B", "C", "D"].map((c) => `<span><i style="background:${MAP_COLORS[c]}"></i>${CLASSES[c]}</span>`).join("") +
    `<span class="muted">Cercle plus gros = priorité plus haute. Clique sur un point pour ouvrir la fiche.</span>`;
}

function dessinerCarte(refit) {
  if (!map) return;
  layer.clearLayers();
  // Les moins prioritaires d'abord : les A restent au-dessus
  const pts = [...VUE].reverse();
  const rayon = { A: 8, B: 6.5, C: 5, D: 4 };
  for (const p of pts) {
    L.circleMarker([p.lat, p.lon], { radius: rayon[p.classe], color: "#fff", weight: 1.2, fillColor: MAP_COLORS[p.classe], fillOpacity: 0.92 })
      .bindTooltip(`<b>${esc(p.nom || "(sans nom)")}</b><br>${esc(p.type)} · ${esc(p.ville)}<br>Note ${p.score}/10 · ${STATUTS[statutDe(p)]}`, { direction: "top" })
      .on("click", () => ouvrirFiche(p.id))
      .addTo(layer);
  }
  if (refit && VUE.length) map.fitBounds(L.latLngBounds(VUE.map((p) => [p.lat, p.lon])).pad(0.1), { maxZoom: 15 });
}

// ---------- Liste ----------
function ligne(p, extra = "") {
  const st = statutDe(p);
  return `<button class="ligne" data-id="${esc(p.id)}">
    <span class="note ${p.classe}"><b>${String(p.score).replace(".", ",")}</b><small>${p.classe}</small></span>
    <div><div class="nom">${esc(p.nom || "(sans nom)")}${p.nom_ar ? ` <span class="ar">· ${esc(p.nom_ar)}</span>` : ""}</div>
    <div class="sous">${esc(p.type)} · ${esc(p.ville || "?")}${p.telephone ? " · " + esc(p.telephone) : ""}${extra}</div></div>
    ${st !== "nouveau" ? `<span class="statut ${st}">${STATUTS[st]}</span>` : "<span></span>"}
  </button>`;
}

function liste() {
  const html = VUE.slice(0, shown).map((p) => ligne(p)).join("");
  $("#liste").innerHTML = (html || `<p class="muted">Aucun commerce avec ces filtres.</p>`) +
    (VUE.length > shown ? `<button class="btn plus" id="plus">Afficher plus (${fmt(VUE.length - shown)} restants)</button>` : "");
}

// ---------- Relances ----------
function relances() {
  const auj = jour();
  const avec = ALL.filter((p) => SUIVI[p.id]?.relance && !["refus", "revendeur"].includes(statutDe(p)))
    .sort((a, b) => SUIVI[a.id].relance.localeCompare(SUIVI[b.id].relance));
  const retard = avec.filter((p) => SUIVI[p.id].relance < auj);
  const today = avec.filter((p) => SUIVI[p.id].relance === auj);
  const apres = avec.filter((p) => SUIVI[p.id].relance > auj);
  const nb = retard.length + today.length;
  $("#nb-relances").hidden = !nb;
  $("#nb-relances").textContent = nb;
  const derniers = ALL.filter((p) => SUIVI[p.id]?.journal?.length)
    .sort((a, b) => (SUIVI[b.id].journal.at(-1).date).localeCompare(SUIVI[a.id].journal.at(-1).date)).slice(0, 15);
  const bloc = (titre, arr, cls = "") => `<div class="bloc"><h2>${titre} <span class="muted">(${arr.length})</span></h2>${
    arr.length ? arr.map((p) => ligne(p, ` · <span class="${cls}">relance le ${fmtDate(SUIVI[p.id].relance)}</span>`)).join("") : `<p class="muted">Rien pour l'instant.</p>`}</div>`;
  $("#relances").innerHTML = bloc("En retard", retard, "retard") + bloc("Aujourd'hui", today) + bloc("À venir", apres) +
    `<div class="bloc"><h2>Derniers contacts</h2>${derniers.length ? derniers.map((p) => {
      const j = SUIVI[p.id].journal.at(-1);
      return ligne(p, ` · ${fmtDate(j.date)} : ${esc(j.texte)}`);
    }).join("") : `<p class="muted">Ouvre une fiche et note ta visite ou ton appel : il apparaîtra ici.</p>`}</div>`;
}

// ---------- Statistiques ----------
function barres(titre, rows, cols, cle) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const tete = `<span class="tete">${cols[0]}</span><span class="tete"></span>` + cols.slice(1).map((c, i) => `<span class="tete ${i ? "opt" : ""}">${c}</span>`).join("");
  const corps = rows.map(([lib, n, ...autres]) =>
    `<span class="lib" data-filtre="${cle}" data-val="${esc(lib)}" title="Filtrer sur ${esc(lib)}">${esc(lib)}</span>
     <span class="piste" data-bulle="${esc(lib)} : ${fmt(n)} ${cols[1].toLowerCase()}${autres.map((a, i) => ` · ${fmt(a)} ${cols[i + 2].toLowerCase()}`).join("")}"><span style="width:${(n / max) * 100}%"></span></span>
     <span class="nb">${fmt(n)}</span>${autres.map((a) => `<span class="nb opt">${fmt(a)}</span>`).join("")}`).join("");
  return `<div class="bloc ${cols.length > 2 ? "large" : ""}"><h2>${titre}</h2><div class="barres ${cols.length > 2 ? "" : "simple"}">${tete}${corps}</div></div>`;
}

function stats() {
  const group = (key) => {
    const m = new Map();
    for (const p of VUE) {
      const g = m.get(p[key]) || [p[key], 0, 0, 0];
      g[1]++; if (p.telephone || p.email) g[2]++; if (p.classe === "A") g[3]++;
      m.set(p[key], g);
    }
    return [...m.values()].sort((a, b) => b[1] - a[1]);
  };
  const parStatut = Object.entries(STATUTS).map(([k, v]) => [v, VUE.filter((p) => statutDe(p) === k).length]).filter(([, n]) => n);
  $("#stats").innerHTML =
    barres("Par type de commerce (du plus prometteur au moins prometteur)", group("type").sort((a, b) => rangType(a[0]) - rangType(b[0])), ["Type", "Commerces", "Joignables", "Priorité A"], "type") +
    barres("Les 15 villes qui en ont le plus", group("ville").slice(0, 15).map((r) => r.slice(0, 2)), ["Ville", "Commerces"], "ville") +
    barres("Suivi commercial", parStatut, ["Étape", "Commerces"], "statut") +
    `<p class="astuce">Clique sur un nom pour filtrer dessus. Les chiffres suivent les filtres du haut.</p>`;
}

// ---------- Fiche commerce ----------
function ouvrirFiche(id) {
  const p = ALL.find((x) => x.id === id);
  if (!p) return;
  ficheId = id;
  const s = SUIVI[id] || {};
  const st = s.statut || "nouveau";
  const refus = st === "refus";
  const tel = (p.telephone || "").split("/")[0].replace(/\s/g, "");
  const wa = p.whatsapp ? `${p.whatsapp}?text=${encodeURIComponent(MSG_WA)}` : "";
  const infos = [
    ["Ville", p.ville], ["Adresse", p.adresse], ["Téléphone", p.telephone],
    ["E-mail", p.email && `${p.email}${p.email_type ? ` (${p.email_type})` : ""}`],
    ["Horaires", p.horaires], ["Site", p.site], ["Facebook", p.facebook], ["Instagram", p.instagram],
    ["Trouvé le", fmtDate(p.premiere_vue)],
  ].filter(([, v]) => v);
  $("#fiche").innerHTML = `
    <button class="fermer" aria-label="Fermer">×</button>
    <h2>${esc(p.nom || "(sans nom)")}</h2>
    ${p.nom_ar ? `<div class="ar" lang="ar">${esc(p.nom_ar)}</div>` : ""}
    <div class="type">${esc(p.type)}</div>
    <div class="entete"><span class="note ${p.classe}"><b>${String(p.score).replace(".", ",")}</b><small>${p.classe}</small></span>
      <div class="detail">${esc(p.score_detail)}</div></div>
    ${refus ? `<div class="alerte">Ce commerce a demandé à ne plus être contacté : on ne le relance pas.</div>` : ""}
    <div class="actions">
      ${wa ? `<a class="btn wa" href="${refus ? "#" : esc(wa)}" target="_blank" rel="noreferrer" ${refus ? "aria-disabled='true' onclick='return false'" : ""}>WhatsApp</a>` : ""}
      ${tel ? `<a class="btn" href="${refus ? "#" : "tel:" + esc(tel)}">Appeler</a>` : ""}
      ${p.email ? `<a class="btn" href="${refus ? "#" : "mailto:" + esc(p.email)}">E-mail</a>` : ""}
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}" target="_blank" rel="noreferrer">Itinéraire</a>
      ${p.site ? `<a class="btn" href="${esc(p.site)}" target="_blank" rel="noreferrer">Site</a>` : ""}
      <a class="btn btn-ghost" href="${esc(p.osm)}" target="_blank" rel="noreferrer">Fiche OSM</a>
    </div>
    <dl class="infos">${infos.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div class="suivi">
      <h3>Mon suivi</h3>
      <div class="duo">
        <label>Étape<select id="s-statut">${Object.entries(STATUTS).map(([k, v]) => `<option value="${k}" ${k === st ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Prochaine relance<input id="s-relance" type="date" value="${esc(s.relance || "")}"></label>
      </div>
      <label>Notes (produits vendus, prix demandés, personne à voir…)<textarea id="s-note" rows="3">${esc(s.note || "")}</textarea></label>
      <div class="rapides">${RAPIDES.map(([t], i) => `<button class="btn" data-rapide="${i}">+ ${t}</button>`).join("")}</div>
      <div class="enregistre" id="s-ok"></div>
    </div>
    <div class="journal"><h3>Historique</h3>
      <ol>${(s.journal || []).slice().reverse().map((j) => `<li><time>${fmtDate(j.date)}</time>${esc(j.texte)}</li>`).join("") || `<li class="muted">Aucune action notée.</li>`}</ol>
    </div>`;
  $("#fiche").hidden = false;
  $("#voile").hidden = false;
}

function fermerFiche() {
  $("#fiche").hidden = true;
  $("#voile").hidden = true;
  ficheId = null;
}

async function sauver(id, maj, texteJournal) {
  const s = { statut: "nouveau", note: "", relance: "", journal: [], ...(SUIVI[id] || {}), ...maj };
  if (texteJournal) s.journal = [...s.journal, { date: jour(), texte: texteJournal }];
  const vide = s.statut === "nouveau" && !s.note && !s.relance && !s.journal.length;
  if (vide) delete SUIVI[id]; else SUIVI[id] = s;
  let msg;
  try {
    const r = await fetch("/api/suivi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, data: vide ? null : s }) });
    if (!r.ok) throw new Error();
    msg = "Enregistré ✓";
  } catch {
    msg = "Pas enregistré : la fenêtre noire du serveur est-elle ouverte ?";
  }
  return msg;
}

// Enregistre puis redessine la fiche et les vues, en gardant le message de confirmation
async function sauverEtAfficher(id, maj, texteJournal) {
  const msg = await sauver(id, maj, texteJournal);
  if (ficheId === id) ouvrirFiche(id);
  appliquer();
  if ($("#s-ok")) $("#s-ok").textContent = msg;
}

// ---------- Export Excel (CSV ; avec le suivi) ----------
function exporter() {
  const cols = ["classe", "score", "type", "nom", "nom_ar", "ville", "adresse", "telephone", "whatsapp", "email", "email_type", "site", "facebook", "horaires", "lat", "lon", "osm", "premiere_vue"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lignes = VUE.map((p) => {
    const s = SUIVI[p.id] || {};
    return [...cols.map((c) => q(p[c])), q(STATUTS[statutDe(p)]), q(s.relance), q(s.note), q((s.journal || []).map((j) => `${j.date} ${j.texte}`).join(" | "))].join(";");
  });
  const csv = "﻿" + [[...cols, "suivi", "relance", "notes", "historique"].join(";"), ...lignes].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `nayra-prospects-${jour()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Robot ----------
async function robot() {
  const b = $("#btn-robot");
  b.disabled = true;
  b.textContent = "Robot en cours…";
  let etat = await (await fetch("/api/robot", { method: "POST" })).json();
  while (etat.running) {
    await new Promise((r) => setTimeout(r, 4000));
    etat = await (await fetch("/api/robot")).json();
    const derniere = etat.log.trim().split("\n").filter((l) => !l.startsWith("|")).at(-1) || "";
    b.textContent = "Robot : " + derniere.slice(0, 40);
  }
  b.disabled = false;
  b.textContent = "Mettre à jour";
  if (etat.fin === "ok") await charger();
  else vide("Le robot n'a pas pu finir", "Le serveur OpenStreetMap est peut-être occupé. Réessaie dans quelques minutes.", etat.log);
}

// ---------- Onglets et événements ----------
function onglet(nom) {
  document.querySelectorAll(".onglets [role=tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === nom));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === "tab-" + nom));
  store.set("onglet", nom);
  if (nom === "carte" && map) setTimeout(() => map.invalidateSize(), 50);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab],[data-id],[data-rapide],[data-filtre],#plus,.fermer,#voile");
  if (!t) return;
  if (t.dataset.tab) return onglet(t.dataset.tab);
  if (t.dataset.id) return ouvrirFiche(t.dataset.id);
  if (t.id === "plus") { shown += PAGE; return liste(); }
  if (t.classList.contains("fermer") || t.id === "voile") return fermerFiche();
  if (t.dataset.filtre) {
    const sel = t.dataset.filtre === "statut" ? "#f-statut" : "#f-" + t.dataset.filtre;
    const val = t.dataset.filtre === "statut" ? Object.keys(STATUTS).find((k) => STATUTS[k] === t.dataset.val) : t.dataset.val;
    $(sel).value = val;
    return appliquer(true);
  }
  if (t.dataset.rapide && ficheId) {
    const [texte, statut] = RAPIDES[+t.dataset.rapide];
    sauverEtAfficher(ficheId, statut ? { statut } : {}, texte);
  }
});

document.addEventListener("change", async (e) => {
  if (!ficheId) return;
  const id = ficheId;
  if (e.target.id === "s-statut") sauverEtAfficher(id, { statut: e.target.value }, "Étape : " + STATUTS[e.target.value]);
  if (e.target.id === "s-relance") { $("#s-ok").textContent = await sauver(id, { relance: e.target.value }); relances(); }
  if (e.target.id === "s-note") $("#s-ok").textContent = await sauver(id, { note: e.target.value });
});

// Bulle d'information au survol des barres
document.addEventListener("mousemove", (e) => {
  const t = e.target.closest("[data-bulle]");
  const b = $("#bulle");
  if (!t) { b.hidden = true; return; }
  b.textContent = t.dataset.bulle;
  b.hidden = false;
  b.style.left = Math.min(e.clientX + 14, innerWidth - b.offsetWidth - 8) + "px";
  b.style.top = e.clientY + 14 + "px";
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerFiche(); });
let minuterie;
$("#f-q").addEventListener("input", () => { clearTimeout(minuterie); minuterie = setTimeout(() => appliquer(), 250); });
["#f-ville", "#f-type", "#f-classe", "#f-contact", "#f-statut"].forEach((s) => $(s).addEventListener("change", () => appliquer(s === "#f-ville" || s === "#f-type")));
$("#f-reset").addEventListener("click", () => { document.querySelectorAll(".filtres input, .filtres select").forEach((el) => (el.value = "")); appliquer(true); });
$("#btn-export").addEventListener("click", exporter);
$("#btn-robot").addEventListener("click", robot);

initCarte();
onglet(store.get("onglet") || "carte");
charger();
