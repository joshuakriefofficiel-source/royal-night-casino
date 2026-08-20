/* ═══════════════════════════════════════════════════════════════════════
   ROYAL NIGHT CASINO — Serveur unique (jeu + multijoueur)
   Sert les fichiers du jeu (index.html, app.js, …) ET le WebSocket
   multijoueur sur le MÊME port → un seul service à déployer.

   Local :   npm install   puis   node server.js
             → jeu sur http://localhost:8787  (WS auto sur le même hôte)
   En ligne: déployer ce dossier sur Render / Railway / Fly.io (voir README)
             → le jeu ET le multijoueur sont accessibles à l'URL publique.
   Port : variable d'env PORT (fournie par l'hébergeur) ou 8787.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

/* ── Serveur HTTP : sert les fichiers statiques du jeu ─────────────────── */
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  // Heure serveur (anti-triche roue quotidienne) — non falsifiable côté client.
  if ((req.url || '').split('?')[0] === '/time') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ now: Date.now() })); return;
  }
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  // Empêche toute remontée hors du dossier.
  const file = path.join(ROOT, path.normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 — introuvable'); return; }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Le code (html/js/css) n'est jamais mis en cache → toujours la dernière
    // version après un simple rafraîchissement. Les médias peuvent être cachés.
    if (['.html', '.js', '.css', '.json'].includes(ext)) headers['Cache-Control'] = 'no-store, must-revalidate';
    else headers['Cache-Control'] = 'public, max-age=86400';
    res.writeHead(200, headers);
    res.end(data);
  });
});

/* ── Serveur WebSocket : partage le même port HTTP ────────────────────── */
const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> { code, players:[ws], names[], ready[], countries[], started }
const MAX = 10, MIN = 2;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code6() { let s = ''; for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; return s; }
function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
function roomOf(ws) { return ws._room && rooms.get(ws._room); }
function broadcast(room, obj, except) { room.players.forEach((p) => { if (p !== except) send(p, obj); }); }
function freeSlot(room) { const used = new Set(room.players.map((p) => p._idx)); for (let i = 0; i < MAX; i++) if (!used.has(i)) return i; return -1; }
// Liste des membres CONNECTÉS (idx, nom, prêt) — envoyée à tout le groupe.
function members(room) {
  return room.players.map((p) => ({ idx: p._idx, name: room.names[p._idx] || ('Joueur ' + (p._idx + 1)), ready: !!room.ready[p._idx], country: room.countries[p._idx] || null }))
    .sort((a, b) => a.idx - b.idx);
}
function newRoom(code) { return { code, players: [], names: [], ready: [], countries: [], started: false }; }

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }

    if (m.type === 'host') {
      let code; do { code = code6(); } while (rooms.has(code));
      const room = newRoom(code);
      room.players.push(ws); room.names[0] = m.name || 'Joueur 1'; ws._room = code; ws._idx = 0;
      rooms.set(code, room);
      send(ws, { type: 'hosted', code, idx: 0, members: members(room), max: MAX, min: MIN });

    } else if (m.type === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room) { send(ws, { type: 'error', error: 'Code invalide ou groupe introuvable.' }); return; }
      if (room.players.length >= MAX) { send(ws, { type: 'error', error: `Groupe complet (${MAX} joueurs max).` }); return; }
      const idx = freeSlot(room);
      room.players.push(ws); room.names[idx] = m.name || ('Joueur ' + (idx + 1)); ws._room = room.code; ws._idx = idx;
      send(ws, { type: 'joined', code: room.code, idx, members: members(room), max: MAX, min: MIN });
      broadcast(room, { type: 'peerJoined', members: members(room) }, ws);

    } else if (m.type === 'ready') {
      const room = roomOf(ws); if (!room) return;
      room.ready[ws._idx] = !!m.ready;
      broadcast(room, { type: 'lobby', members: members(room) }, null);   // état à tous
      const allReady = room.players.length >= MIN && room.players.every((p) => room.ready[p._idx]);
      if (allReady && !room.started) {
        room.started = true;
        broadcast(room, { type: 'start', members: members(room) }, null);
      }

    } else if (m.type === 'country') {
      const room = roomOf(ws); if (!room) return;
      const taken = room.players.some((p) => p._idx !== ws._idx && room.countries[p._idx] === m.country);
      if (taken) { send(ws, { type: 'countryRejected', country: m.country }); return; }
      room.countries[ws._idx] = m.country;
      send(ws, { type: 'countryOk', country: m.country });
      broadcast(room, { type: 'peerCountry', idx: ws._idx, country: m.country }, ws);

    } else if (m.type === 'resume') {
      const code = String(m.code || '').toUpperCase();
      if (!code) { send(ws, { type: 'error', error: 'Code manquant.' }); return; }
      let room = rooms.get(code);
      if (!room) {                                   // groupe disparu → on le RECRÉE
        room = newRoom(code); room.started = true;
        room.players.push(ws); room.names[0] = m.name || 'Joueur 1'; room.ready[0] = true; ws._room = code; ws._idx = 0;
        rooms.set(code, room);
        send(ws, { type: 'resumed', code, idx: 0, members: members(room), max: MAX, min: MIN });
      } else if (room.players.length < MAX) {
        const idx = freeSlot(room);
        room.players.push(ws); room.names[idx] = m.name || room.names[idx] || ('Joueur ' + (idx + 1)); room.ready[idx] = true;
        ws._room = code; ws._idx = idx;
        send(ws, { type: 'resumed', code, idx, members: members(room), max: MAX, min: MIN });
        broadcast(room, { type: 'peerResumed', members: members(room) }, ws);
      } else {
        send(ws, { type: 'error', error: `Groupe complet (${MAX} joueurs max).` });
      }

    } else if (m.type === 'relay') {
      const room = roomOf(ws); if (!room) return;
      m.from = ws._idx;                              // qui a envoyé (pour cibler/afficher)
      broadcast(room, m, ws);                        // diffusé à TOUT le groupe
    }
  });

  ws.on('close', () => {
    const room = roomOf(ws); if (!room) return;
    room.players = room.players.filter((p) => p !== ws);
    room.ready[ws._idx] = false;                     // libère l'état prêt de ce joueur
    broadcast(room, { type: 'peerLeft', idx: ws._idx, members: members(room), code: room.code }, null);
    if (room.players.length === 0) {
      room.emptyAt = Date.now();
      setTimeout(() => { const r = rooms.get(room.code); if (r && r.players.length === 0) rooms.delete(room.code); }, 15 * 60 * 1000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎰 Royal Night Casino — jeu + multijoueur sur le port ${PORT}`);
  console.log(`   Local : http://localhost:${PORT}`);
});
