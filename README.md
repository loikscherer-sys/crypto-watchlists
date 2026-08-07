# Synchronisation des watchlists DexScreener

Ce dépôt lit automatiquement tes watchlists DexScreener **toutes les heures** et
publie leur contenu dans `watchlist.json`. Le Dashboard Crypto Investor lit ce
fichier : quand tu ajoutes ou retires une crypto sur DexScreener, la liste du
dashboard suit toute seule.

## Pourquoi un robot plutôt qu'un simple lien

DexScreener n'expose aucune API pour les watchlists, et la page d'une watchlist
partagée ne contient pas la liste dans son code : elle est construite par
JavaScript après le chargement. Un navigateur ne peut donc pas lire ce lien
depuis un autre site — ni techniquement, ni au regard des règles d'origine
croisée. Il faut ouvrir la page dans un vrai navigateur, ce que fait ce robot.

## Mise en place — environ dix minutes, une seule fois

### 1. Créer le dépôt

Sur [github.com](https://github.com) → **New repository**.
Nom au choix (par exemple `crypto-watchlists`), visibilité **Public** — c'est
indispensable pour que le dashboard puisse lire le fichier — puis **Create**.

### 2. Envoyer les fichiers

Sur la page du dépôt vide : **uploading an existing file**, puis glisse le
contenu de ce dossier en conservant l'arborescence :

```
.github/workflows/watchlist.yml
scripts/lire-watchlists.mjs
listes.json
watchlist.json
README.md
```

Si le glisser-déposer ne conserve pas les dossiers, crée les fichiers un par un
avec **Add file → Create new file** en tapant le chemin complet dans le champ du
nom (`.github/workflows/watchlist.yml` crée les dossiers automatiquement).

### 3. Autoriser le robot à écrire

**Settings → Actions → General → Workflow permissions** →
cocher **Read and write permissions** → **Save**.

### 4. Premier lancement

Onglet **Actions** → si GitHub demande confirmation, clique sur
**I understand my workflows, go ahead and enable them**.
Puis **Mise à jour des watchlists DexScreener** → **Run workflow** → **Run workflow**.

Compte deux à trois minutes. À la fin, le fichier `watchlist.json` doit contenir
tes paires. Ouvre-le pour vérifier.

### 5. Brancher le dashboard

L'adresse du fichier est :

```
https://raw.githubusercontent.com/TON-COMPTE/TON-DEPOT/main/watchlist.json
```

Dans le dashboard, onglet **Listes**, choisis une liste PRO. Sous les onglets,
une ligne indique la source ; clique sur **renseigner l'adresse de
synchronisation** et colle cette adresse. C'est terminé.

Cette adresse est mémorisée dans le navigateur. Pour qu'elle s'applique à tous
les visiteurs sans manipulation, redonne-la-moi et je l'intègre directement dans
le code du dashboard.

## Ajouter ou modifier une watchlist

Édite `listes.json` :

```json
{
  "2": { "nom": "PRO : Radar",        "url": "https://dexscreener.com/watchlist/…" },
  "3": { "nom": "PRO : Top memecoin", "url": "https://dexscreener.com/watchlist/…" }
}
```

Les clés `"2"` et `"3"` correspondent aux listes du dashboard : `2` = Radar,
`3` = Top memecoin. La liste `1` (Crypto EDGE) est gérée à part, dans le code du
dashboard, parce qu'elle repose sur des cryptos cotées et non sur des paires DEX.

## Fréquence

Le robot tourne à la 7ᵉ minute de chaque heure. Pour changer, modifie la ligne
`cron` dans `.github/workflows/watchlist.yml` :

- `"7 * * * *"` — toutes les heures (par défaut)
- `"*/30 * * * *"` — toutes les demi-heures
- `"7 */6 * * *"` — toutes les six heures

GitHub applique parfois un retard de quelques minutes sur les tâches planifiées,
et met en pause les tâches d'un dépôt resté inactif 60 jours — un simple commit
ou un lancement manuel les réactive.

## Sécurités

- Si une liste revient vide (page qui n'a pas chargé, DexScreener en panne,
  changement de mise en page), le robot **conserve la version précédente** au
  lieu de vider ton dashboard, et note une alerte dans le fichier.
- Chaque liste est tentée trois fois avant d'abandonner.
- Si aucune liste ne peut être lue, le fichier n'est pas modifié du tout.
- Côté dashboard, la dernière version lue est gardée en mémoire locale : si
  GitHub est injoignable, la liste reste affichée avec la mention « hors ligne ».

## Si ça casse un jour

Le robot lit la page telle qu'elle s'affiche. Si DexScreener change sa mise en
page, l'extraction peut ne plus rien trouver — tu le verras dans l'onglet
**Actions** (exécution en échec) et dans le dashboard, où la date de
synchronisation cessera d'avancer. La correction tient en général en une ligne
dans `scripts/lire-watchlists.mjs` : c'est l'expression `ADRESSE` qui reconnaît
les liens de paires.
