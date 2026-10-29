// Deux bots ChatGPT discutent de chaque produit, puis un troisième en tire les points forts.
// Lancer : node bots/debat.js        (ou double-clic sur bots/lancer-debat.bat)

const fs = require("fs");
const path = require("path");

// Lit la clé dans bots/.env (OPENAI_API_KEY=sk-...) si elle n'est pas déjà dans l'environnement
const fichierEnv = path.join(__dirname, ".env");
if (fs.existsSync(fichierEnv)) {
  for (const ligne of fs.readFileSync(fichierEnv, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// Sans clé OpenAI payante, on passe par GitHub Models (gratuit) avec le compte GitHub connecté
function jetonGitHub() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return require("child_process").execSync("gh auth token", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const CLE_OPENAI = process.env.OPENAI_API_KEY;
const AVEC_OPENAI = CLE_OPENAI && !CLE_OPENAI.startsWith("colle-");
const CLE = AVEC_OPENAI ? CLE_OPENAI : jetonGitHub();
const ADRESSE = AVEC_OPENAI
  ? "https://api.openai.com/v1/chat/completions"
  : "https://models.github.ai/inference/chat/completions";
const MODELE = AVEC_OPENAI ? process.env.OPENAI_MODEL || "gpt-4o-mini" : "openai/gpt-4o-mini";
const TOURS = 3; // nombre d'échanges entre les deux bots par produit

const produits = [
  { nom: "Ghassoul aux Herbes", prix: "11,90 €", description: "Argile marocaine (rhassoul) aux plantes, 250 g, pour nettoyer la peau et les cheveux au hammam." },
  { nom: "Sérum Éclat Vitamine C", prix: "24,90 €", description: "Sérum visage à la vitamine C, illumine le teint et atténue les taches." },
  { nom: "Eau de Parfum Fleur d'Oranger", prix: "49,00 €", description: "Parfum floral frais et élégant." },
];

const contexte =
  "Marque : Beauté Éclat. Marchés visés : Maroc d'abord, puis pays du Golfe (Arabie saoudite, Émirats), puis Europe. " +
  "Concurrents : Garnier, The Ordinary, La Roche-Posay, Najel, Aroma-Zone, Atelier Cologne, Le Labo.";

const vendeuse =
  "Tu es Sara, experte marketing en cosmétiques. Tu défends le produit avec des arguments concrets et honnêtes " +
  "(ingrédients, prix face aux concurrents, usage). Réponds en français, en 3 à 4 phrases maximum.";

const cliente =
  "Tu es Leïla, cliente exigeante qui compare tout avant d'acheter. Tu poses des questions précises et tu pointes " +
  "les faiblesses (prix, efficacité, concurrence). Réponds en français, en 3 à 4 phrases maximum.";

const analyste =
  "Tu es analyste. À partir d'une discussion entre une experte marketing et une cliente, liste en français : " +
  "1) les 5 points les plus attirants pour donner envie d'acheter, 2) les 3 objections à traiter et la réponse à chacune, " +
  "3) l'argument principal pour le Maroc, le Golfe et l'Europe, 4) 3 phrases d'accroche en français et en arabe. " +
  "Aucune promesse médicale. Réponds en Markdown, court et concret.";

async function demander(systeme, messages) {
  const reponse = await fetch(ADRESSE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CLE}` },
    body: JSON.stringify({ model: MODELE, messages: [{ role: "system", content: systeme }, ...messages] }),
  });
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.error?.message || `Erreur HTTP ${reponse.status}`);
  return donnees.choices[0].message.content.trim();
}

// Chaque bot voit ses propres répliques comme "assistant" et celles de l'autre comme "user"
function vuePour(qui, historique) {
  return historique.map((r) => ({ role: r.qui === qui ? "assistant" : "user", content: r.texte }));
}

async function debattre(produit) {
  const presentation = `${contexte}\nProduit : ${produit.nom} (${produit.prix}). ${produit.description}`;
  const historique = [];

  console.log(`\n===== ${produit.nom} =====`);
  for (let i = 0; i < TOURS; i++) {
    const texteCliente = await demander(cliente, [
      { role: "user", content: presentation + (i === 0 ? "\nPose ta première question sur ce produit." : "") },
      ...vuePour("Leïla", historique),
    ]);
    historique.push({ qui: "Leïla", texte: texteCliente });
    console.log(`\nLeïla (cliente) : ${texteCliente}`);

    const texteVendeuse = await demander(vendeuse, [
      { role: "user", content: presentation },
      ...vuePour("Sara", historique),
    ]);
    historique.push({ qui: "Sara", texte: texteVendeuse });
    console.log(`\nSara (marketing) : ${texteVendeuse}`);
  }

  const transcription = historique.map((r) => `${r.qui} : ${r.texte}`).join("\n\n");
  const pointsForts = await demander(analyste, [{ role: "user", content: `${presentation}\n\nDiscussion :\n${transcription}` }]);
  console.log(`\n--- Points forts ---\n${pointsForts}`);

  return `## ${produit.nom} (${produit.prix})\n\n### Discussion\n\n${transcription}\n\n### Points forts\n\n${pointsForts}\n`;
}

async function main() {
  if (!CLE) {
    console.error("Aucun accès : connecte-toi avec « gh auth login », ou mets GITHUB_TOKEN=... dans bots/.env");
    process.exit(1);
  }
  console.log(AVEC_OPENAI ? "Connexion : OpenAI" : "Connexion : GitHub Models (gratuit)");

  // node debat.js ghassoul  → analyse seulement les produits dont le nom contient "ghassoul"
  const filtre = (process.argv[2] || "").toLowerCase();
  const choisis = produits.filter((p) => p.nom.toLowerCase().includes(filtre));
  if (choisis.length === 0) {
    console.error(`Aucun produit ne correspond à "${filtre}".`);
    process.exit(1);
  }

  let rapport = `# Points forts des produits — ${new Date().toLocaleDateString("fr-FR")}\n\n`;
  for (const produit of choisis) rapport += (await debattre(produit)) + "\n";

  const sortie = path.join(__dirname, "points-forts.md");
  fs.writeFileSync(sortie, rapport, "utf8");
  console.log(`\nRapport enregistré : ${sortie}`);
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
