# NAYRA Prospection

Robot + application pour trouver les commerces marocains qui pourraient revendre le savon noir et le ghassoul NAYRA, puis suivre les visites jusqu'à la première commande.

## Utilisation

| Je veux… | Je fais… |
|---|---|
| Voir les résultats | Double-clic sur **Ouvrir NAYRA Prospection.bat** : la page s'ouvre dans Chromium (http://localhost:8787). Une petite fenêtre noire réduite doit rester ouverte. |
| Chercher de nouveaux commerces | Bouton **Mettre à jour** dans la page, ou double-clic sur **Mettre a jour les prospects.bat** (quelques minutes). |
| Travailler dans Excel | Bouton **Exporter (Excel)** : la liste filtrée, avec mon suivi. |
| Laisser une fiche au commerçant | Bouton **Fiche revendeur** : feuille A4 en arabe et en français (gamme, prix revendeur, gain, carte présentoir, QR WhatsApp). Je règle mon numéro et mes prix en haut, puis **Imprimer ou enregistrer en PDF**. |

Dans la page :
- **Carte** : tous les commerces ; cercles foncés et gros = priorité A. Clic = fiche.
- **Liste** : classée par note sur 10.
- **Relances** : les commerces à rappeler (en retard, aujourd'hui, à venir) et les derniers contacts.
- **Statistiques** : par type de commerce, par ville, et par étape du suivi.
- **Fiche** : WhatsApp (message prêt, en darija et en français, avec « STOP »), appel, itinéraire, étape du suivi, date de relance, notes, historique.

## Où sont les données ?

- `donnees/prospects.json` et `donnees/prospects.csv` : les commerces collectés (le CSV s'ouvre dans Excel).
- `donnees/suivi.json` : mon suivi (étapes, notes, relances).
- Le dossier `donnees/` **n'est pas envoyé sur GitHub** (dépôt public) : les contacts restent sur ce PC. Pense à le copier sur une clé USB de temps en temps.

## Plan établi avec ChatGPT (07/11/2026)

**Cibles, par potentiel** (balises OpenStreetMap) :

| # | Type de commerce | Balises OSM | Note de départ |
|---|---|---|---|
| 1 | Herboristes / attarine | `shop=herbalist`, `shop=spices` | 4,5 |
| 2 | Cosmétiques / parfumeries | `shop=cosmetics`, `shop=perfumery` | 4,5 |
| 3 | Hammams | `amenity=public_bath`, `bath:type=hammam` | 4 |
| 4 | Instituts de beauté / spas | `shop=beauty`, `shop=massage`, `leisure=spa` | 3,5 |
| 5 | Coopératives / terroir | nom contenant « coop », « تعاونية » ou « argan » | 3 |
| 6 | Magasins bio / naturels | `shop=health_food`, `shop=organic` | 3 |
| 7 | Hanouts / épiceries | `shop=convenience`, `grocery`, `general`, supérettes sans enseigne | 3 |
| 8 | Souvenirs / artisanat | `shop=gift`, `souvenir`, `craft` | 2,5 |
| 9 | Parapharmacies | `shop=chemist`, pharmacies nommées « para… » | 2,5 |
| 10 | Salons de coiffure | `shop=hairdresser` | 2 |
| 11 | Pharmacies | `amenity=pharmacy` | 1 |

**Note sur 10** = type de commerce + nom proche de nos produits (ghassoul, savon, beldi, hammam, argan, عطار…) +1,5 + mobile/WhatsApp +2 (fixe +1,5) + e-mail +0,5 + nom connu +0,5 + horaires/site +0,5 + grande ville ou ville touristique +1.
Classes : **A** 8 à 10 · **B** 6 à 7,5 · **C** 4 à 5,5 · **D** moins de 4.
C'est une hypothèse de départ : après les premières visites, on corrige les points selon les commandes réelles.

**Étapes du suivi** : Nouveau → À visiter → Visité → Échantillon remis → Intéressé → Première commande → Revendeur actif (et À relancer plus tard, Refusé / ne plus contacter).

**Conseils de ChatGPT** :
- Ne pas viser tout le Maroc d'un coup : tester d'abord **Marrakech** (hammams, herboristes, touristes), **Casablanca** (cosmétiques, hanouts) et **Fès** (herboristes, commerces traditionnels).
- Commencer par 4 types : herboristes, cosmétiques, hammams, hanouts.
- Kit revendeur : quelques sachets de 15 à 30 g, un présentoir de comptoir, une fiche avec les prix revendeur.
- Exemple de prix revendeur à vérifier avec les vrais coûts : 3 DH → 2 DH ; 5 DH → 3,50 DH ; 10 DH → 7 DH.
- But : 500 revendeurs qui recommandent, pas 10 000 lignes dans un fichier.

**Plus tard** : PWA sur téléphone, gestion des échantillons, tournées optimisées, historique des commandes, Golfe et Europe.

## Règles à respecter

- **Loi 09-08 / CNDP** : pas d'envoi en masse. Un message à la fois, en disant qui on est, avec « STOP ». Un commerce marqué « Refusé / ne plus contacter » n'est plus relancé. Un e-mail ou un mobile au nom d'une personne est une donnée personnelle : à utiliser avec prudence. Avant de grossir le fichier, vérifier auprès de la CNDP la déclaration à faire.
- **OpenStreetMap (ODbL)** : citer « © OpenStreetMap contributors ». On utilise les données en interne ; on ne republie pas le fichier.
- Les données OSM peuvent être anciennes : **vérifier sur place** avant de compter un commerce.
