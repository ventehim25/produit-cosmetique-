// Liste des produits (modifie ici pour ajouter tes propres produits)
const produits = [
  { id: 1, nom: "Sérum Éclat Vitamine C", categorie: "soin", prix: 24.9, icone: "🍊", couleur: "#fff1e0", description: "Illumine le teint et atténue les taches." },
  { id: 4, nom: "Ghassoul aux Herbes", categorie: "hammam", prix: 11.9, icone: "🌿", couleur: "#efe6d8", description: "Argile marocaine aux plantes (250 g) : nettoie la peau et les cheveux en douceur. Aussi appelé rhassoul, غاسول, Lavaerde." },
  { id: 3, nom: "Eau de Parfum Fleur d'Oranger", categorie: "parfum", prix: 49.0, icone: "🌸", couleur: "#fdf0f5", description: "Note florale fraîche et élégante." },
];

const nomsCategories = {
  soin: "Soins visage",
  hammam: "Hammam",
  parfum: "Parfums",
};

let panier = JSON.parse(localStorage.getItem("panier") || "{}");
// Retire du panier les produits qui n'existent plus
for (const id in panier) {
  if (!produits.some((p) => p.id === Number(id))) delete panier[id];
}

const grille = document.getElementById("grille");
const panierListe = document.getElementById("panierListe");
const compteur = document.getElementById("compteur");
const total = document.getElementById("total");
const panierEl = document.getElementById("panier");
const voile = document.getElementById("voile");

function formaterPrix(valeur) {
  return valeur.toFixed(2).replace(".", ",") + " €";
}

function afficherProduits(categorie) {
  const liste = categorie === "tous" ? produits : produits.filter((p) => p.categorie === categorie);
  grille.innerHTML = liste
    .map(
      (p) => `
      <article class="carte">
        <div class="carte-image" style="background:${p.couleur}">${p.icone}</div>
        <div class="carte-corps">
          <span class="carte-categorie">${nomsCategories[p.categorie]}</span>
          <h3 class="carte-nom">${p.nom}</h3>
          <p class="carte-description">${p.description}</p>
          <div class="carte-bas">
            <span class="prix">${formaterPrix(p.prix)}</span>
            <button class="ajouter" data-id="${p.id}">Ajouter</button>
          </div>
        </div>
      </article>`
    )
    .join("");
}

function sauvegarderPanier() {
  localStorage.setItem("panier", JSON.stringify(panier));
}

function afficherPanier() {
  const ids = Object.keys(panier);
  let somme = 0;
  let nombre = 0;

  if (ids.length === 0) {
    panierListe.innerHTML = '<li class="vide">Votre panier est vide.</li>';
  } else {
    panierListe.innerHTML = ids
      .map((id) => {
        const p = produits.find((x) => x.id === Number(id));
        const q = panier[id];
        somme += p.prix * q;
        nombre += q;
        return `
        <li>
          <span>${p.icone} ${p.nom}</span>
          <span class="quantite">
            <button data-moins="${id}">−</button>
            <span>${q}</span>
            <button data-plus="${id}">+</button>
          </span>
        </li>`;
      })
      .join("");
  }

  compteur.textContent = nombre;
  total.textContent = formaterPrix(somme);
  sauvegarderPanier();
}

function ouvrirPanier(ouvert) {
  panierEl.classList.toggle("ouvert", ouvert);
  voile.classList.toggle("visible", ouvert);
}

// Filtres par catégorie
document.getElementById("filtres").addEventListener("click", (e) => {
  if (!e.target.matches(".filtre")) return;
  document.querySelectorAll(".filtre").forEach((b) => b.classList.remove("actif"));
  e.target.classList.add("actif");
  afficherProduits(e.target.dataset.categorie);
});

// Ajouter au panier
grille.addEventListener("click", (e) => {
  if (!e.target.matches(".ajouter")) return;
  const id = e.target.dataset.id;
  panier[id] = (panier[id] || 0) + 1;
  afficherPanier();
  e.target.textContent = "Ajouté ✓";
  setTimeout(() => (e.target.textContent = "Ajouter"), 900);
});

// Modifier les quantités
panierListe.addEventListener("click", (e) => {
  const plus = e.target.dataset.plus;
  const moins = e.target.dataset.moins;
  if (plus) panier[plus]++;
  if (moins) {
    panier[moins]--;
    if (panier[moins] <= 0) delete panier[moins];
  }
  afficherPanier();
});

document.getElementById("ouvrirPanier").addEventListener("click", () => ouvrirPanier(true));
document.getElementById("fermerPanier").addEventListener("click", () => ouvrirPanier(false));
voile.addEventListener("click", () => ouvrirPanier(false));

document.getElementById("commander").addEventListener("click", () => {
  if (Object.keys(panier).length === 0) {
    alert("Votre panier est vide.");
    return;
  }
  alert("Merci pour votre commande ! Total : " + total.textContent);
  panier = {};
  afficherPanier();
  ouvrirPanier(false);
});

afficherProduits("tous");
afficherPanier();
