/* =====================================================================
   Lecture automatique des watchlists DexScreener
   ---------------------------------------------------------------------
   DexScreener n'expose aucune API pour les watchlists, et le contenu de
   la page est construit par JavaScript une fois la page chargée. On
   ouvre donc la page dans un vrai navigateur (Chromium sans interface),
   on lit les lignes affichées, et on écrit le résultat dans
   watchlist.json — que GitHub sert ensuite en HTTPS, lisible par le
   dashboard.

   Règle de sécurité : si une liste revient vide (page qui n'a pas
   chargé, DexScreener en panne, changement de mise en page), on garde
   l'ancienne version plutôt que de vider le dashboard.
   ===================================================================== */
import { chromium } from "playwright";
import fs from "node:fs/promises";

const LISTES = JSON.parse(await fs.readFile("listes.json", "utf8"));

/* Premiers segments d'URL qui ne sont pas des chaînes : ce sont les
   rubriques du site, à ne pas confondre avec une paire. */
const PAS_UNE_CHAINE = new Set([
  "watchlist", "watchlists", "multicharts", "new-pairs", "gainers", "losers",
  "portfolio", "trending", "advertise", "api", "docs", "terms", "privacy",
  "support", "moonshot", "tokens", "pairs", "profile", "alerts", "cex",
  "leaderboard", "settings", "login", "signup", "u", "s", "chart", "search"
]);

/* Une adresse de paire : hexadécimal EVM, base58 Solana, ou base64url TON. */
const ADRESSE = /^\/([a-z0-9-]{2,20})\/([A-Za-z0-9_-]{25,72})\/?(?:[?#].*)?$/;

async function lireListe(nav, url, nom) {
  const ctx = await nav.newContext({
    viewport: { width: 1600, height: 1400 },
    locale: "fr-FR",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    /* on attend qu'au moins une ligne de paire soit rendue */
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("a[href]")].some((a) =>
            /^\/[a-z0-9-]{2,20}\/[A-Za-z0-9_-]{25,72}\/?$/.test(
              a.getAttribute("href") || ""
            )
          ),
        { timeout: 25000 }
      )
      .catch(() => {});
    await page.waitForTimeout(5000);   /* laisse le temps aux dernières lignes */

    const brut = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || "")
    );

    const vues = new Set();
    const paires = [];
    for (const h of brut) {
      const m = h.match(ADRESSE);
      if (!m) continue;
      const chaine = m[1].toLowerCase();
      const adresse = m[2].toLowerCase();
      if (PAS_UNE_CHAINE.has(chaine)) continue;
      const cle = chaine + "|" + adresse;
      if (vues.has(cle)) continue;
      vues.add(cle);
      paires.push([chaine, adresse]);
    }
    console.log(`  ${nom} : ${paires.length} paire(s)`);
    return paires;
  } finally {
    await ctx.close();
  }
}

/* ---- ancien fichier : sert de filet si une lecture échoue ---- */
let ancien = { listes: {} };
try {
  ancien = JSON.parse(await fs.readFile("watchlist.json", "utf8"));
} catch (e) {
  console.log("Pas de watchlist.json existant — première exécution.");
}

const nav = await chromium.launch({ args: ["--no-sandbox"] });
const sortie = { maj: new Date().toISOString(), listes: {} };
let echecs = 0;

for (const [id, cfg] of Object.entries(LISTES)) {
  console.log(`Lecture de ${cfg.nom} …`);
  let paires = [];
  for (let essai = 1; essai <= 2 && !paires.length; essai++) {
    try {
      paires = await lireListe(nav, cfg.url, cfg.nom);
    } catch (e) {
      console.log(`  tentative ${essai} en échec : ${e.message.slice(0, 120)}`);
    }
    if (!paires.length && essai < 2) await new Promise((r) => setTimeout(r, 6000));
  }

  const avant = (ancien.listes && ancien.listes[id] && ancien.listes[id].paires) || [];
  if (!paires.length && avant.length) {
    console.log(`  ⚠ lecture vide — on conserve les ${avant.length} paires précédentes`);
    echecs++;
    sortie.listes[id] = {
      nom: cfg.nom, url: cfg.url, paires: avant,
      maj: (ancien.listes[id] && ancien.listes[id].maj) || null,
      alerte: "lecture impossible le " + new Date().toISOString().slice(0, 16).replace("T", " ")
    };
  } else {
    sortie.listes[id] = { nom: cfg.nom, url: cfg.url, paires, maj: sortie.maj };
  }
}

await nav.close();

const total = Object.values(sortie.listes).reduce((a, l) => a + l.paires.length, 0);
if (!total) {
  console.error("Aucune paire lue sur aucune liste — fichier laissé intact.");
  process.exit(1);
}

await fs.writeFile("watchlist.json", JSON.stringify(sortie, null, 2) + "\n", "utf8");
console.log(`\nÉcrit : ${total} paire(s) au total${echecs ? ` (${echecs} liste(s) conservée(s) telles quelles)` : ""}.`);
