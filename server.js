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
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  // Empêche toute remontée hors du dossier.
  const file = path.join(ROOT, path.normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 — introuvable'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

/* ── Serveur WebSocket : partage le même port HTTP ────────────────────── */
const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> { code, players:[ws], names:[], ready:[], countries:[] }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code6() { let s = ''; for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; return s; }
function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
function roomOf(ws) { return ws._room && rooms.get(ws._room); }
function peer(room, ws) { return room.players.find((p) => p !== ws); }

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }

    if (m.type === 'host') {
      let code; do { code = code6(); } while (rooms.has(code));
      const room = { code, players: [ws], names: [m.name || 'Joueur 1', ''], ready: [false, false], countries: [null, null] };
      rooms.set(code, room); ws._room = code; ws._idx = 0;
      send(ws, { type: 'hosted', code, idx: 0, names: room.names });

    } else if (m.type === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room) { send(ws, { type: 'error', error: 'Code invalide ou partie introuvable.' }); return; }
      if (room.players.length >= 2) { send(ws, { type: 'error', error: 'Cette partie est déjà complète.' }); return; }
      room.players.push(ws); room.names[1] = m.name || 'Joueur 2'; ws._room = room.code; ws._idx = 1;
      send(ws, { type: 'joined', code: room.code, idx: 1, names: room.names });
      const host = room.players[0]; if (host) send(host, { type: 'peerJoined', names: room.names });

    } else if (m.type === 'ready') {
      const room = roomOf(ws); if (!room) return;
      room.ready[ws._idx] = !!m.ready;
      const o = peer(room, ws); if (o) send(o, { type: 'peerReady', ready: room.ready[ws._idx] });
      if (room.ready[0] && room.ready[1] && room.players.length === 2) {
        room.players.forEach((p) => send(p, { type: 'start', names: room.names }));
      }

    } else if (m.type === 'country') {
      const room = roomOf(ws); if (!room) return;
      const otherIdx = ws._idx === 0 ? 1 : 0;
      if (room.countries[otherIdx] && room.countries[otherIdx] === m.country) { send(ws, { type: 'countryRejected', country: m.country }); return; }
      room.countries[ws._idx] = m.country;
      send(ws, { type: 'countryOk', country: m.country });
      const o = peer(room, ws); if (o) send(o, { type: 'peerCountry', country: m.country });

    } else if (m.type === 'relay') {
      const room = roomOf(ws); if (!room) return;
      const o = peer(room, ws); if (o) send(o, m);
    }
  });

  ws.on('close', () => {
    const room = roomOf(ws); if (!room) return;
    const o = peer(room, ws);
    if (o) send(o, { type: 'peerLeft' });
    rooms.delete(room.code);
  });
});

server.listen(PORT, () => {
  console.log(`🎰 Royal Night Casino — jeu + multijoueur sur le port ${PORT}`);
  console.log(`   Local : http://localhost:${PORT}`);
});
