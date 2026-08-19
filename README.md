# 🎰 Royal Night Casino

Casino virtuel **100 % fictif** + empire du commerce (négoce de véhicules import/export)
— avec un **mode 2 joueurs en ligne**. Aucun argent réel.

## ▶️ Jouer en local (solo + multijoueur sur le même réseau)

```bash
cd royal-night-casino
npm install
node server.js
```
Puis ouvre **http://localhost:8787**. Le serveur `node` sert **le jeu ET le multijoueur** sur le même port.

*(Pour du solo pur sans multijoueur, tu peux aussi juste ouvrir `index.html` en double-cliquant.)*

## 🌐 Déployer en ligne (jouable partout dans le monde) — Render

Le jeu + le serveur multijoueur sont **un seul service**. L'URL du serveur est détectée automatiquement (en `wss://` sur ton domaine Render), rien à configurer côté client.

### Étapes (avec ton compte Render)

1. **Mets le dossier sur GitHub** (une seule fois) :
   ```bash
   cd royal-night-casino
   git init && git add -A && git commit -m "Royal Night Casino"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/royal-night-casino.git
   git push -u origin main
   ```
   *(Crée d'abord le dépôt vide `royal-night-casino` sur github.com.)*

2. **Sur Render** :
   - Clique **New +  →  Blueprint**, choisis ton dépôt `royal-night-casino`, puis **Apply**.
   - *(Render lit le fichier `render.yaml` : build `npm install`, start `node server.js`, plan gratuit.)*
   - **OU** sans blueprint : **New +  →  Web Service** → connecte le dépôt →
     Build Command `npm install` · Start Command `node server.js` · Instance **Free**.

3. Render te donne une URL du type **`https://royal-night-casino.onrender.com`**.
   Ouvre-la : le jeu **et** le multijoueur sont en ligne. Partage cette URL et le **code de partie** avec un ami à l'autre bout du monde 🌍.

> ⚠️ Le plan **gratuit** de Render s'endort après ~15 min d'inactivité (le 1er chargement peut prendre ~30 s le temps du réveil). Pour un serveur toujours actif, prends un plan payant.

## 🎮 Contenu

- **Casino** : Dés, Blackjack, Poker (Texas Hold'em vs IA), Machine à rouleaux — débloqués en montant de niveau.
- **Négoce** : achète des véhicules (Concession, prix réels, choix du pays), stocke-les au garage, revends-les à l'export vers le meilleur marché mondial.
- **Employés** (niv 35) : ton entreprise achète/revend toute seule.
- **Roue quotidienne**, **recharge de secours**, **3 sauvegardes**, niveau illimité.
- **Mode 2 joueurs en ligne** : héberge/rejoins via un code à 6 caractères ; pays uniques et commerce réduit entre les 2 pays du duo.

## 🗂️ Fichiers

```
royal-night-casino/
├── index.html      # structure du jeu
├── style.css       # thème casino premium
├── app.js          # toute la logique (jeu + client multijoueur)
├── world.js        # carte du monde (données Natural Earth)
├── server.js       # serveur unique : sert le jeu + WebSocket multijoueur
├── package.json    # dépendance : ws
├── render.yaml     # déploiement Render (Blueprint)
├── Dockerfile      # déploiement alternatif (Docker)
└── music/          # (optionnel) déposez votre musique de fond ici
```

> ⚠️ Divertissement uniquement. Les crédits n'ont aucune valeur monétaire.
