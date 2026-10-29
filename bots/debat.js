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

const CLE = process.env.OPENAI_API_KEY;
const MODELE = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TOURS = 3; // nombre d'échanges entre les deux bots par produit

const produits = [
  { nom: "Sérum Éclat Vitamine C", prix: "24,90 €", description: "Sérum visage à la vitamine C, illumine le teint et atténue les taches." },
  { nom: "Ghassoul aux Herbes", prix: "11,90 €", description: "Argile marocaine (rhassoul) aux plantes, 250 g, pour nettoyer la peau et les cheveux au hammam." },
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
  "1) les 3 à 5 points forts du produit, 2) les 2 à 3 objections à traiter, 3) une phrase d'accroche pour le site. " +
  "Réponds en Markdown, court et concret.";

async function demander(systeme, messages) {
  const reponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
    console.error("Clé OpenAI manquante. Crée le fichier bots/.env avec la ligne : OPENAI_API_KEY=sk-...");
    process.exit(1);
  }

  let rapport = `# Points forts des produits — ${new Date().toLocaleDateString("fr-FR")}\n\n`;
  for (const produit of produits) rapport += (await debattre(produit)) + "\n";

  const sortie = path.join(__dirname, "points-forts.md");
  fs.writeFileSync(sortie, rapport, "utf8");
  console.log(`\nRapport enregistré : ${sortie}`);
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exit(1);
});
