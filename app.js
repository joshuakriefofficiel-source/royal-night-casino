/* ═══════════════════════════════════════════════════════════════════════
   ROYAL NIGHT CASINO — Logique applicative
   Un seul fichier, plusieurs modules. Argent 100 % virtuel & fictif.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

/* ======================================================================
   0. UTILITAIRES GÉNÉRAUX
   ====================================================================== */
const APP_VERSION = '68';   // ← doit correspondre au ?v= dans index.html (repère de cache)
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/** Entier aléatoire dans [min, max] inclus. */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
/** Formatage FR des nombres (séparateur de milliers). */
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
/** Libellé lisible d'un jeu. */
const GAME_LABELS = { dice: 'Dés', blackjack: 'Blackjack', poker: 'Poker', slot: 'Machine à rouleaux' };
const gameLabel = (g) => GAME_LABELS[g] || g;

/** Alias (villes / noms alternatifs) → nom de pays (FR) pour la recherche. */
const COUNTRY_ALIASES = {
  'dubai': 'Émirats arabes unis', 'dubaï': 'Émirats arabes unis', 'abu dhabi': 'Émirats arabes unis', 'uae': 'Émirats arabes unis', 'emirats': 'Émirats arabes unis',
  'londres': 'Royaume-Uni', 'london': 'Royaume-Uni', 'angleterre': 'Royaume-Uni', 'uk': 'Royaume-Uni', 'england': 'Royaume-Uni', 'grande-bretagne': 'Royaume-Uni',
  'new york': 'États-Unis', 'los angeles': 'États-Unis', 'usa': 'États-Unis', 'america': 'États-Unis', 'amerique': 'États-Unis', 'etats-unis': 'États-Unis', 'etats unis': 'États-Unis',
  'germany': 'Allemagne', 'berlin': 'Allemagne', 'munich': 'Allemagne',
  'tokyo': 'Japon', 'japan': 'Japon',
  'pekin': 'Chine', 'pékin': 'Chine', 'beijing': 'Chine', 'shanghai': 'Chine', 'china': 'Chine',
  'moscou': 'Russie', 'moscow': 'Russie', 'russia': 'Russie',
  'rome': 'Italie', 'milan': 'Italie', 'italy': 'Italie',
  'madrid': 'Espagne', 'barcelone': 'Espagne', 'spain': 'Espagne',
  'amsterdam': 'Pays-Bas', 'holland': 'Pays-Bas', 'hollande': 'Pays-Bas', 'netherlands': 'Pays-Bas',
  'geneve': 'Suisse', 'genève': 'Suisse', 'zurich': 'Suisse', 'switzerland': 'Suisse',
  'seoul': 'Corée du Sud', 'séoul': 'Corée du Sud', 'coree': 'Corée du Sud', 'corée': 'Corée du Sud',
  'paris': 'France', 'france': 'France',
  'ryad': 'Arabie saoudite', 'riyad': 'Arabie saoudite', 'saudi': 'Arabie saoudite',
  'rio': 'Brésil', 'sao paulo': 'Brésil', 'brazil': 'Brésil', 'bresil': 'Brésil',
  'montreal': 'Canada', 'montréal': 'Canada', 'toronto': 'Canada',
  'sydney': 'Australie', 'melbourne': 'Australie',
  'bombay': 'Inde', 'mumbai': 'Inde', 'delhi': 'Inde', 'india': 'Inde',
  'istanbul': 'Turquie', 'ankara': 'Turquie',
  'lisbonne': 'Portugal', 'lisbon': 'Portugal',
  'stockholm': 'Suède', 'sweden': 'Suède',
  'oslo': 'Norvège', 'norway': 'Norvège',
  'bangkok': 'Thaïlande', 'hanoi': 'Vietnam', 'hô-chi-minh': 'Vietnam',
  'le caire': 'Égypte', 'cairo': 'Égypte', 'egypt': 'Égypte',
  'casablanca': 'Maroc', 'morocco': 'Maroc',
};
/** Recherche de pays par nom OU alias, jusqu'à `limit` résultats. */
const matchCountries = (q, all, limit = 12) => {
  const res = [], seen = new Set();
  for (const n of all) { if (n.toLowerCase().includes(q)) { res.push(n); seen.add(n); } }
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.includes(q) && all.includes(country) && !seen.has(country)) { res.push(country); seen.add(country); }
  }
  return res.slice(0, limit);
};

/* ======================================================================
   1. AUDIO — synthèse WebAudio (aucun fichier requis)
      Architecture extensible : brancher des fichiers plus tard est trivial.
   ====================================================================== */
const Sound = (() => {
  let ctx = null;
  let musicOn = true, sfxOn = true;
  let musicNodes = null;
  let sfxVol = 1;      // 0..1 multiplicateur des effets
  let musVol = 0.55;   // 0..1 volume musique (cible du master)

  /* ── Musique de fond : fichier audio local ──────────────────────────
     Morceau principal : « Midnight Velvet » (composé sur Suno par le joueur).
     On tente plusieurs noms/extensions ; si aucun fichier n'est trouvé,
     on retombe sur l'ambiance synthétisée d'origine.               */
  const MUSIC_SOURCES = [
    'music/midnight-velvet.mp3',
    'music/friendly-pressure.mp3',
    'music/friendly-pressure.ogg',
    'music/friendly-pressure.m4a',
  ];
  let musicEl = null;          // HTMLAudioElement si un fichier existe
  let musicElReady = false;    // true = fichier chargé et utilisable
  let usingFile = false;
  let musicFileFailed = false;   // true = aucune source lisible → repli synthé
  let userGestured = false;      // true après le 1er geste (autorise la lecture audio)

  /** Prépare l'élément <audio> ; bascule musicElReady si un fichier charge. */
  const initMusicFile = () => {
    if (musicEl) return;
    musicEl = new window.Audio();
    musicEl.loop = true;
    musicEl.preload = 'auto';
    musicEl.volume = 0.55;
    let srcIdx = 0;
    const tryNext = () => {
      if (srcIdx >= MUSIC_SOURCES.length) {
        // Aucune source lisible : on autorise (enfin) l'ambiance synthétisée.
        musicElReady = false; musicFileFailed = true;
        if (musicOn && !usingFile) startSynth();
        return;
      }
      musicEl.src = encodeURI(MUSIC_SOURCES[srcIdx++]);
      musicEl.load();
    };
    musicEl.addEventListener('canplaythrough', () => {
      musicElReady = true;
      // On ne LANCE la chanson que si l'utilisateur a déjà interagi (règle
      // d'autoplay). Avant le 1er geste, on se contente de bufferiser.
      if (userGestured && musicOn && !usingFile) {
        if (musicNodes) {
          clearInterval(musicNodes.timer);
          try { musicNodes.master.gain.linearRampToValueAtTime(0.0001, (ctx?.currentTime || 0) + 0.4); } catch (e) {}
          try { musicNodes.lfo && musicNodes.lfo.stop((ctx?.currentTime || 0) + 0.5); } catch (e) {}
          musicNodes = null;
        }
        usingFile = true;
        const p = musicEl.play(); if (p && p.catch) p.catch(() => {});
      }
    }, { once: false });
    musicEl.addEventListener('error', tryNext);
    tryNext();
  };

  const ensure = () => {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const tone = (freq, dur, { type = 'sine', vol = 0.2, when = 0, glideTo = null } = {}) => {
    const c = ensure(); if (!c || !sfxOn) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const vv = Math.max(0.0001, vol * sfxVol);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vv, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  };

  const noise = (dur, { vol = 0.15, when = 0, hp = 800 } = {}) => {
    const c = ensure(); if (!c || !sfxOn) return;
    const t = c.currentTime + when;
    const buf = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp;
    const g = c.createGain(); g.gain.value = vol * sfxVol;
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t);
  };

  // ── Sons SOUTENUS (durée variable) — renvoient une fonction stop() ────────
  // Whirr mécanique de rouleaux de machine à sous (rotation + tic-tic rapides).
  const reelSpin = (ms = 2000) => {
    const c = ensure(); if (!c || !sfxOn) return () => {};
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, t);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 4.5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06 * sfxVol, t + 0.09);
    // Trémolo rapide = les crans du rouleau qui défilent.
    const trem = c.createOscillator(); trem.type = 'square'; trem.frequency.value = 24;
    const tremAmt = c.createGain(); tremAmt.gain.value = 0.045 * sfxVol;
    trem.connect(tremAmt).connect(g.gain);
    osc.connect(bp).connect(g).connect(c.destination);
    osc.start(t); trem.start(t);
    let stopped = false;
    const stop = (fade = 0.14) => {
      if (stopped) return; stopped = true;
      const now = c.currentTime;
      try { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now); g.gain.linearRampToValueAtTime(0.0001, now + fade); } catch (e) {}
      try { osc.stop(now + fade + 0.03); trem.stop(now + fade + 0.03); } catch (e) {}
    };
    const timer = setTimeout(() => stop(0.2), ms);
    return () => { clearTimeout(timer); stop(0.06); };
  };
  // Dés qui roulent/tumbent : petits chocs boisés répétés et aléatoires.
  const diceTumble = (ms = 1200) => {
    const c = ensure(); if (!c || !sfxOn) return () => {};
    let stopped = false;
    const knock = () => {
      if (stopped) return;
      noise(0.045, { vol: 0.12, hp: 350 });
      tone(150 + Math.random() * 140, 0.05, { type: 'triangle', vol: 0.06 });
    };
    knock();
    const iv = setInterval(() => { if (!stopped && Math.random() < 0.85) knock(); }, 65);
    const timer = setTimeout(() => { stopped = true; clearInterval(iv); }, ms);
    return () => { stopped = true; clearInterval(iv); clearTimeout(timer); };
  };

  const sfx = {
    click:   () => tone(520, 0.06, { type: 'triangle', vol: 0.1 }),
    select:  () => { tone(660, 0.05, { vol: 0.11 }); tone(880, 0.07, { vol: 0.09, when: 0.05 }); },
    chip:    () => { noise(0.05, { vol: 0.1, hp: 2000 }); tone(1200, 0.04, { type: 'square', vol: 0.05 }); },
    card:    () => { noise(0.06, { vol: 0.14, hp: 1600 }); tone(2200, 0.03, { type: 'triangle', vol: 0.04 }); },
    dice:    () => { noise(0.05, { vol: 0.13, hp: 400 }); tone(170 + Math.random() * 120, 0.05, { type: 'triangle', vol: 0.06 }); },
    lever:   () => tone(200, 0.25, { type: 'sawtooth', vol: 0.12, glideTo: 90 }),
    reel:    () => { noise(0.02, { vol: 0.05, hp: 3200 }); tone(720, 0.02, { type: 'square', vol: 0.035 }); },
    launch:  () => { tone(330, 0.1, { type: 'triangle', vol: 0.13 }); tone(494, 0.14, { type: 'triangle', vol: 0.11, when: 0.09 }); },
    win:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.15, when: i * 0.1 })),
    jackpot: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, { type: 'square', vol: 0.13, when: i * 0.09 })),
    lose:    () => { tone(300, 0.3, { type: 'sawtooth', vol: 0.11, glideTo: 120 }); tone(220, 0.35, { vol: 0.09, when: 0.12, glideTo: 90 }); },
    tie:     () => tone(440, 0.2, { vol: 0.11 }),
  };

  const startMusic = () => {
    if (!musicOn) return;
    // Priorité ABSOLUE au fichier audio (ta chanson « Midnight Velvet »).
    initMusicFile();
    if (musicFileFailed) { startSynth(); return; }   // secours seulement si aucun fichier
    if (musicEl && (musicElReady || musicEl.readyState >= 2)) {
      usingFile = true;
      const p = musicEl.play();
      if (p && p.catch) p.catch(() => { /* autoplay bloqué : réessai au prochain geste */ });
    }
    // Sinon : le fichier charge encore → on attend « canplaythrough » qui lancera
    // la chanson. On ne démarre PAS le synthé (évite la superposition des 2 musiques).
  };

  // Ambiance lounge nocturne générée en direct — uniquement en secours.
  const startSynth = () => {
    if (!musicOn) return;
    const c = ensure(); if (!c || musicNodes) return;

    // Chaîne maître : passe-bas chaleureux + écho spatial + fondu d'entrée.
    const master = c.createGain(); master.gain.value = 0.0001;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
    master.connect(lp);
    lp.connect(c.destination);                                   // signal direct
    // Écho feutré (impression de grande salle / réverbération).
    const delay = c.createDelay(); delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.34;
    const wet = c.createGain(); wet.gain.value = 0.32;
    lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(c.destination);
    // Filtre qui « respire » très lentement (mouvement de nappe).
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.045;
    const lfoAmt = c.createGain(); lfoAmt.gain.value = 700;
    lfo.connect(lfoAmt).connect(lp.frequency); lfo.start();
    master.gain.linearRampToValueAtTime(Math.max(0.0001, musVol), c.currentTime + 3);

    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const nodes = [];

    // Voix simple avec enveloppe douce + panoramique + détune léger.
    const voice = (freq, t0, dur, { type = 'sine', vol = 0.12, attack = 0.4, release = 0.9, pan = 0, detune = 0 } = {}) => {
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + attack);
      g.gain.setValueAtTime(vol, Math.max(t0 + attack, t0 + dur - release));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let out = g; o.connect(g);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      out.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05); nodes.push(o);
    };
    // Nappe large : deux oscillateurs détunés pour l'épaisseur stéréo.
    const pad = (freq, t0, dur, { vol = 0.05, pan = 0 } = {}) => {
      voice(freq, t0, dur, { type: 'triangle', vol, attack: 1.6, release: 2.2, pan: pan - 0.15, detune: -6 });
      voice(freq, t0, dur, { type: 'sine', vol: vol * 0.85, attack: 1.8, release: 2.2, pan: pan + 0.15, detune: +6 });
    };

    // Progression rêveuse (Am9 – Fmaj9 – Cmaj9 – G13) + basse grave.
    const chords = [
      { notes: [57, 60, 64, 67, 71], bass: 33 },
      { notes: [53, 57, 60, 64, 67], bass: 29 },
      { notes: [60, 64, 67, 71, 74], bass: 36 },
      { notes: [55, 59, 62, 66, 69], bass: 31 },
    ];
    const penta = [72, 74, 76, 79, 81, 84, 88];
    const BAR = 4.6;   // tempo lent → plus atmosphérique
    let bar = 0;

    const scheduleBar = () => {
      if (!musicNodes) return;
      const t0 = c.currentTime + 0.06;
      const ch = chords[bar % chords.length];
      // Nappe d'accord large et évolutive
      ch.notes.forEach((m, i) => pad(midi(m), t0, BAR + 1.4, { vol: 0.042, pan: (i - 2) * 0.22 }));
      // Basse grave et ronde (sub)
      voice(midi(ch.bass), t0, BAR + 0.4, { type: 'sine', vol: 0.16, attack: 0.4, release: 0.9 });
      voice(midi(ch.bass + 12), t0, BAR, { type: 'sine', vol: 0.06, attack: 0.3, release: 0.7 });
      // Cloches / celesta clairsemées et rêveuses
      if (Math.random() < 0.7) {
        const off = 0.8 + Math.random() * (BAR - 2);
        const note = penta[Math.floor(Math.random() * penta.length)];
        voice(midi(note), t0 + off, 1.6, { type: 'sine', vol: 0.045, attack: 0.01, release: 1.4, pan: (Math.random() * 2 - 1) * 0.6 });
      }
      bar++;
    };
    scheduleBar();
    const timer = setInterval(scheduleBar, BAR * 1000);
    musicNodes = { master, timer, nodes, lfo };
  };
  const stopMusic = () => {
    // Coupe le fichier audio s'il joue…
    if (usingFile && musicEl) { try { musicEl.pause(); } catch (e) {} usingFile = false; }
    // …et l'ambiance synthétisée le cas échéant.
    if (musicNodes) {
      clearInterval(musicNodes.timer);
      try { musicNodes.master.gain.linearRampToValueAtTime(0.0001, (ctx?.currentTime || 0) + 0.4); } catch (e) {}
      try { musicNodes.lfo && musicNodes.lfo.stop((ctx?.currentTime || 0) + 0.5); } catch (e) {}
      musicNodes = null;
    }
  };

  // ── Coupure temporaire de la musique pendant une action de jeu ────────────
  let ducked = false, duckWasFile = false;
  const duck = () => {
    if (ducked) return; ducked = true;
    duckWasFile = !!(usingFile && musicEl && !musicEl.paused);
    if (musicEl && !musicEl.paused) { try { musicEl.pause(); } catch (e) {} }
    if (musicNodes && ctx) { try { musicNodes.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06); } catch (e) {} }
  };
  const unduck = () => {
    if (!ducked) return; ducked = false;
    if (!musicOn) return;
    if (duckWasFile && musicEl) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
    else if (musicNodes && ctx) { try { musicNodes.master.gain.setTargetAtTime(Math.max(0.0001, musVol), ctx.currentTime, 0.4); } catch (e) {} }
    else { startMusic(); }
  };

  return {
    play: (name) => { if (sfx[name]) sfx[name](); },
    reelSpin: (ms) => reelSpin(ms),
    diceTumble: (ms) => diceTumble(ms),
    duck, unduck,
    toggleMusic() { userGestured = true; musicOn = !musicOn; musicOn ? startMusic() : stopMusic(); return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; if (sfxOn) sfx.select(); return sfxOn; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    get musicVolume() { return musVol; },
    get sfxVolume() { return sfxVol; },
    setMusicVolume(x) {
      musVol = clamp(x, 0, 1);
      if (musicNodes) { try { musicNodes.master.gain.setTargetAtTime(Math.max(0.0001, musVol), ctx.currentTime, 0.1); } catch (e) {} }
      if (musicEl) musicEl.volume = clamp(musVol / 0.55, 0, 1);
    },
    setSfxVolume(x) { sfxVol = clamp(x, 0, 1); },
    kick: () => { userGestured = true; ensure(); },
    // Précharge le fichier musique dès l'ouverture (sans geste) → démarrage
    // instantané au tout premier contact avec l'écran de lancement.
    preload: () => { try { initMusicFile(); } catch (e) {} },
    ensureMusic: () => { userGestured = true; if (musicOn) startMusic(); },
    // Coupe TOUT le son et libère l'AudioContext (à l'abandon d'une page)
    // → empêche une « page fantôme » de continuer à jouer après un refresh.
    shutdown: () => {
      try { stopMusic(); } catch (e) {}
      if (musicEl) { try { musicEl.pause(); } catch (e) {} }
      if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
    },
    get musicStatus() {
      return {
        musicOn,
        usingFile,
        synthPlaying: !!musicNodes,
        fileReady: musicElReady,
        fileFailed: musicFileFailed,
        fileSrc: musicEl ? musicEl.currentSrc || musicEl.src : null,
        fileReadyState: musicEl ? musicEl.readyState : null,
        filePaused: musicEl ? musicEl.paused : null,
      };
    },
  };
})();

/* ======================================================================
   2. BANQUE — solde centralisé, transactions, historique, persistance
   ====================================================================== */
const Bank = (() => {
  const BASE = 'royalNightCasino_v4';        // 3 emplacements : BASE_s1, BASE_s2, BASE_s3
  const SLOT_PTR = 'royalNightCasino_slot';  // emplacement actif (1–3)
  const slot = () => localStorage.getItem(SLOT_PTR) || '1';
  const KEY = () => BASE + '_s' + slot();
  const START = 500;
  const MAX_LEVEL = 50;   // niveau où le changement d'emploi se débloque (plus un plafond)
  // Niveau requis pour débloquer chaque jeu (identique dans les deux emplois).
  const GAME_UNLOCK = { slot: 1, blackjack: 20, poker: 35, dice: 50 };

  const freshMode = () => ({
    balance: START, history: [], stats: { games: 0, wins: 0, biggest: 0 },
    level: 1, xp: 0, org: null, inventory: {}, shipments: [],
    employees: {}, autoOn: true,   // employés embauchés {role: niveau} + interrupteur
  });
  // Deux « emplois » = deux sauvegardes indépendantes.
  const state = { mode: 'commerce', immoUnlocked: false, lastWheel: 0, commerce: freshMode(), immobilier: freshMode() };
  const RESCUE_FLOOR = 200, DAY = 86400000;
  const cur = () => state[state.mode];

  const listeners = [], xpListeners = [], levelListeners = [], maxListeners = [], modeListeners = [];

  /** XP requise pour passer du niveau L au niveau L+1.
      50 × L : 50 au niveau 1, puis +50 à chaque palier (50, 100, 150, … 2450 au niv 49).
      Croissant à chaque niveau, et le niveau max 50 reste atteignable. */
  const xpForLevel = (L) => 50 * L;

  const sanitize = (m) => {
    const f = freshMode();
    if (typeof m.balance === 'number' && m.balance >= 0) f.balance = m.balance;
    if (Array.isArray(m.history)) f.history = m.history.slice(0, 40);
    if (m.stats) Object.assign(f.stats, m.stats);
    if (Number.isFinite(m.level) && m.level >= 1) f.level = m.level;   // pas de plafond
    if (Number.isFinite(m.xp) && m.xp >= 0) f.xp = m.xp;
    if (m.org && typeof m.org.name === 'string') f.org = m.org;
    if (m.inventory && typeof m.inventory === 'object') f.inventory = m.inventory;
    if (Array.isArray(m.shipments)) f.shipments = m.shipments;
    if (m.employees && typeof m.employees === 'object') f.employees = m.employees;
    f.autoOn = m.autoOn !== false;
    return f;
  };
  // Réinitialise l'état en mémoire (avant de charger un emplacement).
  const resetState = () => {
    state.mode = 'commerce'; state.immoUnlocked = false; state.lastWheel = 0;
    state.commerce = freshMode(); state.immobilier = freshMode();
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY());
      if (raw) {
        const d = JSON.parse(raw);
        if (d.mode === 'commerce' || d.mode === 'immobilier') state.mode = d.mode;
        state.immoUnlocked = !!d.immoUnlocked;
        if (Number.isFinite(d.lastWheel)) state.lastWheel = d.lastWheel;
        if (d.commerce) state.commerce = sanitize(d.commerce);
        if (d.immobilier) state.immobilier = sanitize(d.immobilier);
        if (state.mode === 'immobilier' && !state.immoUnlocked) state.mode = 'commerce';
      }
    } catch (e) {}
  };
  const save = () => { try { localStorage.setItem(KEY(), JSON.stringify(state)); } catch (e) {} };
  // Aperçu d'un emplacement (pour l'écran de sélection).
  const slotPreview = (n) => {
    try {
      const raw = localStorage.getItem(BASE + '_s' + n);
      if (!raw) return { empty: true };
      const d = JSON.parse(raw);
      const m = d[d.mode || 'commerce'] || {};
      return { empty: false, name: m.org ? m.org.name : '—', country: m.org ? m.org.country : '',
        level: m.level || 1, balance: m.balance || 0, mode: d.mode || 'commerce' };
    } catch (e) { return { empty: true }; }
  };
  const emit = () => listeners.forEach((fn) => fn(cur().balance));
  const emitXp = () => xpListeners.forEach((fn) => fn(cur().level, cur().xp, xpForLevel(cur().level)));

  const isValidBet = (a) => Number.isFinite(a) && a > 0 && a <= cur().balance;

  return {
    START, MAX_LEVEL, GAME_UNLOCK,
    // Emplacements de sauvegarde
    get currentSlot() { return slot(); },
    slotPreview,
    setSlot(n) { localStorage.setItem(SLOT_PTR, String(n)); resetState(); load(); emit(); emitXp(); },
    deleteSlot(n) { localStorage.removeItem(BASE + '_s' + n); if (slot() === String(n)) { resetState(); emit(); emitXp(); } },
    get balance() { return cur().balance; },
    get history() { return cur().history; },
    get stats() { return cur().stats; },
    get level() { return cur().level; },
    get xp() { return cur().xp; },
    get xpNeeded() { return xpForLevel(cur().level); },
    get company() { return cur().org; },   // « org » = entreprise ou agence
    get inventory() { return cur().inventory; },
    get shipments() { return cur().shipments; },
    persist() { save(); },
    get mode() { return state.mode; },
    get immoUnlocked() { return state.immoUnlocked; },
    get immoStarted() { return !!state.immobilier.org; },
    isMaxed() { return cur().level >= MAX_LEVEL; },
    isGameUnlocked(g) { return cur().level >= (GAME_UNLOCK[g] || 1); },
    unlockLevel(g) { return GAME_UNLOCK[g] || 1; },

    onChange(fn) { listeners.push(fn); fn(cur().balance); },
    onXp(fn) { xpListeners.push(fn); fn(cur().level, cur().xp, xpForLevel(cur().level)); },
    onLevelUp(fn) { levelListeners.push(fn); },
    onMaxLevel(fn) { maxListeners.push(fn); },
    onModeChange(fn) { modeListeners.push(fn); },

    setCompany(org) { cur().org = org; save(); },
    get employees() { return cur().employees; },
    get autoOn() { return cur().autoOn; },
    setEmployee(role, tier) { cur().employees[role] = tier; save(); },
    toggleAuto() { cur().autoOn = !cur().autoOn; save(); return cur().autoOn; },

    // Roue quotidienne
    wheelReady() { return Date.now() - state.lastWheel >= DAY; },
    wheelWaitMs() { return Math.max(0, DAY - (Date.now() - state.lastWheel)); },
    markWheel() { state.lastWheel = Date.now(); save(); },
    // Filet de sécurité : remonte le solde au minimum garanti si on est à sec.
    get rescueFloor() { return RESCUE_FLOOR; },
    // Disponible uniquement quand on n'a plus d'argent du tout.
    canRescue() { return cur().balance <= 0; },
    rescue() { if (cur().balance > 0) return 0; const add = RESCUE_FLOOR - cur().balance; cur().balance = RESCUE_FLOOR; save(); emit(); return add; },

    addXp(amount) {
      amount = Math.round(amount);
      if (amount <= 0) return;
      const c = cur();
      const wasBelow = c.level < MAX_LEVEL;   // avant de franchir le niveau 50
      c.xp += amount;
      while (c.xp >= xpForLevel(c.level)) {   // aucune limite de niveau
        c.xp -= xpForLevel(c.level);
        c.level++;
        levelListeners.forEach((fn) => fn(c.level));
      }
      save(); emitXp();
      // Au franchissement du niveau 50 : changement d'emploi possible (une seule fois).
      if (wasBelow && c.level >= MAX_LEVEL) {
        if (state.mode === 'commerce') { state.immoUnlocked = true; save(); }
        maxListeners.forEach((fn) => fn(state.mode));
      }
    },
    isValidBet,

    placeBet(a) { if (!isValidBet(a)) return false; cur().balance -= a; cur().stats.games++; save(); emit(); return true; },
    addWinnings(a) { a = Math.round(a); if (a <= 0) return; cur().balance += a; save(); emit(); },
    debit(a) { a = Math.round(a); if (a <= 0 || a > cur().balance) return false; cur().balance -= a; save(); emit(); return true; },
    credit(a) { a = Math.round(a); if (a <= 0) return; cur().balance += a; save(); emit(); },
    countGame() { cur().stats.games++; save(); },
    record(net, game) {
      net = Math.round(net);
      const c = cur();
      c.history.unshift({ amount: net, game, ts: Date.now() });
      if (c.history.length > 40) c.history.pop();
      if (net > 0) { c.stats.wins++; c.stats.biggest = Math.max(c.stats.biggest, net); }
      save(); emit();
      // Les jeux du casino ne donnent PAS d'XP (l'XP vient uniquement des ventes).
    },
    /** Réinitialisation totale de l'emploi courant : solde, niveau, XP,
        historique ET entreprise/agence (org remis à null → nouvel onboarding). */
    /** Journalise une transaction (import/export) : historique + XP modérée,
        sans re-débiter/créditer (le mouvement d'argent est fait à part). */
    logTx(net, game) {
      net = Math.round(net);
      const c = cur();
      c.history.unshift({ amount: net, game, ts: Date.now() });
      if (c.history.length > 40) c.history.pop();
      if (net > 0) { c.stats.wins++; c.stats.biggest = Math.max(c.stats.biggest, net); }
      save(); emit();
      // Pas d'XP ici : seules les ventes terminées (export encaissé) rapportent de l'XP.
    },
    reset() {
      state[state.mode] = freshMode();   // org = null
      save(); emit(); emitXp();
    },
    /** Bascule vers une sauvegarde existante (via Paramètres). */
    switchMode(m) {
      if (m !== 'commerce' && m !== 'immobilier') return false;
      if (m === 'immobilier' && !state.immoUnlocked) return false;
      state.mode = m; save(); emit(); emitXp();
      modeListeners.forEach((fn) => fn(m));
      return true;
    },
    /** Démarre (ou redémarre) l'emploi immobilier avec une agence. */
    startImmobilier(org) {
      state.immobilier = freshMode();
      state.immobilier.org = org;
      state.immoUnlocked = true;
      state.mode = 'immobilier';
      save(); emit(); emitXp();
      modeListeners.forEach((fn) => fn('immobilier'));
    },
    load,
  };
})();

/* ======================================================================
   3. INTERFACE PARTAGÉE — toast, modal, particules, coins, solde
   ====================================================================== */
const UI = (() => {
  const toastEl = $('#toast');
  let toastTimer = null;

  const toast = (msg, kind = '') => {
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast ' + kind; }, 2300);
  };

  const confirm = (text) => new Promise((resolve) => {
    const modal = $('#modal');
    $('#modalText').textContent = text;
    modal.classList.remove('hidden');
    const done = (val) => {
      modal.classList.add('hidden');
      $('#modalOk').onclick = null; $('#modalCancel').onclick = null;
      resolve(val);
    };
    $('#modalOk').onclick = () => done(true);
    $('#modalCancel').onclick = () => done(false);
  });

  const coinRain = (count = 18) => {
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'coin-burst';
      c.textContent = Math.random() > 0.5 ? '🪙' : '✨';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
      c.style.animationDelay = (Math.random() * 0.4) + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3200);
    }
  };

  const syncBalance = (bal) => {
    $('#navBalanceVal').textContent = fmt(bal);
    const pb = $('#profileBalance'); if (pb) pb.textContent = fmt(bal);
    const rb = $('#rescueBtn'); if (rb) rb.classList.toggle('hidden', !Bank.canRescue());
    const pill = $('#navBalance');
    pill.classList.remove('flash'); void pill.offsetWidth; pill.classList.add('flash');
    renderHistory();
  };

  // Verrouille/déverrouille les cartes de jeu selon le niveau courant.
  const renderCasino = () => {
    $$('.game-card[data-game]').forEach((card) => {
      const g = card.dataset.game;
      const need = Bank.unlockLevel(g);
      const unlocked = Bank.isGameUnlocked(g);
      card.classList.toggle('locked', !unlocked);
      let lock = card.querySelector('.gc-lock');
      if (!unlocked) {
        if (!lock) { lock = document.createElement('div'); lock.className = 'gc-lock'; card.appendChild(lock); }
        lock.innerHTML = `<span class="gc-lock-ico">🔒</span><span>Niveau&nbsp;${need}</span>`;
      } else if (lock) { lock.remove(); }
    });
  };

  // Verrouille/déverrouille les catégories de la Concession selon le niveau.
  const renderConcession = () => {
    $$('.game-card[data-vehicle]').forEach((card) => {
      const cat = card.dataset.vehicle;
      const need = Concession.unlockLevel(cat);
      const unlocked = Concession.isUnlocked(cat);
      card.classList.toggle('locked', !unlocked);
      let lock = card.querySelector('.gc-lock');
      if (!unlocked) {
        if (!lock) { lock = document.createElement('div'); lock.className = 'gc-lock'; card.appendChild(lock); }
        lock.innerHTML = `<span class="gc-lock-ico">🔒</span><span>Niveau&nbsp;${need}</span>`;
      } else if (lock) { lock.remove(); }
    });
  };

  const syncLevel = (level, xp, need) => {
    const pct = clamp(Math.round((xp / need) * 100), 0, 100);
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    set('navLevelNum', level);
    set('profileLevel', level);
    set('profileXpText', `${fmt(xp)} / ${fmt(need)} XP`);
    const navFill = $('#navXpFill'); if (navFill) navFill.style.width = pct + '%';
    const proFill = $('#profileXpFill'); if (proFill) proFill.style.width = pct + '%';
    const ring = $('#profileLevelRing'); if (ring) ring.style.setProperty('--pct', pct);
    renderCasino();
    renderConcession();
  };

  const levelUp = (level) => {
    Sound.play('jackpot'); coinRain(26);
    toast(`⭐ Niveau ${level} atteint !`, 'win');
    const pill = $('#navLevel');
    if (pill) { pill.classList.remove('flash'); void pill.offsetWidth; pill.classList.add('flash'); }
  };

  const renderGarage = () => {
    const grid = $('#garageGrid'); if (!grid) return;
    const items = Object.values(Bank.inventory).filter((v) => v && v.qty > 0);
    const count = items.reduce((a, v) => a + v.qty, 0);
    const value = items.reduce((a, v) => a + v.qty * v.price, 0);
    const cnt = $('#garageCount');
    if (cnt) cnt.textContent = count ? `— ${count} véhicule${count > 1 ? 's' : ''} · ${fmt(value)} €` : '';
    if (!items.length) { grid.innerHTML = '<p class="garage-empty">Garage vide — commandez un véhicule à la Concession.</p>'; return; }
    grid.innerHTML = items.map((v) => `<div class="garage-item">
      <div class="garage-img">${Concession.svg(v.cat, v.name)}${v.qty > 1 ? `<span class="garage-qty">×${v.qty}</span>` : ''}</div>
      <div class="garage-name">${v.name}</div>
      <div class="garage-val">${fmt(v.price)} €</div>
    </div>`).join('');
  };

  const renderCompany = () => {
    const c = Bank.company;
    const el = $('#profileCompany');
    if (el) el.textContent = c ? `🏢 ${c.name}  ·  🌍 ${c.country}` : '';
    const brandSub = $('#brandCompany');
    if (brandSub) brandSub.textContent = c ? c.name : '';
  };

  const renderHistory = () => {
    const list = $('#historyList'); if (!list) return;
    const h = Bank.history;
    if (!h.length) { list.innerHTML = '<li class="hist-empty">Aucune transaction pour l\'instant.</li>'; }
    else {
      list.innerHTML = h.slice(0, 12).map((t) => {
        const cls = t.amount >= 0 ? 'amt-pos' : 'amt-neg';
        const sign = t.amount >= 0 ? '+' : '';
        return `<li><span>${t.game}</span><span class="${cls}">${sign}${fmt(t.amount)}</span></li>`;
      }).join('');
    }
    $('#statGames').textContent = fmt(Bank.stats.games);
    $('#statWins').textContent = fmt(Bank.stats.wins);
    $('#statBig').textContent = fmt(Bank.stats.biggest);
  };

  const initParticles = () => {
    const cv = $('#particles'); const cx = cv.getContext('2d');
    let W, H, parts = [];
    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    const N = innerWidth < 700 ? 22 : 46;
    for (let i = 0; i < N; i++) parts.push({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.3 + 0.05,
      a: Math.random() * 0.5 + 0.1, drift: Math.random() * 0.4 - 0.2,
    });
    const loop = () => {
      cx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y -= p.s; p.x += p.drift;
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7);
        cx.fillStyle = `rgba(217,180,91,${p.a})`; cx.fill();
      }
      requestAnimationFrame(loop);
    };
    if (!window.matchMedia('(prefers-reduced-motion:reduce)').matches) loop();
  };

  return { toast, confirm, coinRain, syncBalance, renderHistory, initParticles, syncLevel, levelUp, renderCompany, renderCasino, renderConcession, renderGarage };
})();

/* ======================================================================
   4. NAVIGATION entre les vues (SPA simple)
   ====================================================================== */
const Nav = (() => {
  const views = {
    home: 'view-home', casino: 'view-casino', profile: 'view-profile', concession: 'view-concession',
    importexport: 'view-importexport', agence: 'view-agence', ventelocation: 'view-ventelocation',
    dice: 'view-dice', blackjack: 'view-blackjack', poker: 'view-poker', slot: 'view-slot',
  };
  let current = 'home';
  const onEnter = {};

  const go = (name) => {
    if (!views[name]) return;
    $$('.view').forEach((v) => v.classList.remove('active'));
    $('#' + views[name]).classList.add('active');
    current = name;
    // Les catégories de navigation ne s'affichent qu'une fois entré au casino
    // (masquées sur l'accueil).
    $('#navbar').classList.toggle('at-home', name === 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Sound.play('select');
    if (onEnter[name]) onEnter[name]();
  };

  return { go, register(name, cb) { onEnter[name] = cb; }, get current() { return current; } };
})();

/* ======================================================================
   5. CARTES — deck, mélange, valeurs, rendu
   ====================================================================== */
const Cards = (() => {
  const SUITS = [
    { s: '♠', c: 'black' }, { s: '♥', c: 'red' },
    { s: '♦', c: 'red' },   { s: '♣', c: 'black' },
  ];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const freshDeck = () => {
    const d = [];
    for (const su of SUITS) for (let i = 0; i < RANKS.length; i++)
      d.push({ rank: RANKS[i], suit: su.s, color: su.c, value: i + 2 }); // A=14
    return d;
  };
  const shuffle = (d) => {
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  };
  const el = (card, faceDown = false) => {
    const div = document.createElement('div');
    if (faceDown) { div.className = 'card back'; return div; }
    div.className = 'card ' + (card.color === 'red' ? 'red' : '');
    div.innerHTML =
      `<span class="corner-t"><span class="rank">${card.rank}</span><span class="suit-mini">${card.suit}</span></span>` +
      `<span class="suit-big">${card.suit}</span>` +
      `<span class="corner-b"><span class="rank">${card.rank}</span><span class="suit-mini">${card.suit}</span></span>`;
    return div;
  };
  return { freshDeck, shuffle, el, RANKS };
})();

/* ======================================================================
   6. ÉVALUATEUR DE MAINS DE POKER (meilleure main de 5 parmi 5..7)
   ====================================================================== */
const PokerEval = (() => {
  const NAMES = ['Carte haute', 'Paire', 'Deux paires', 'Brelan', 'Suite',
                 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];

  const eval5 = (cards) => {
    const vals = cards.map((c) => c.value).sort((a, b) => b - a);
    const suits = cards.map((c) => c.suit);
    const isFlush = suits.every((s) => s === suits[0]);

    const counts = {};
    vals.forEach((v) => counts[v] = (counts[v] || 0) + 1);
    const groups = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a);
    const pattern = groups.map((v) => counts[v]).join('');

    const uniq = [...new Set(vals)];
    let straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // roue A-2-3-4-5
    }
    const isStraight = straightHigh > 0;

    if (isStraight && isFlush) return { cat: straightHigh === 14 ? 9 : 8, ranks: [straightHigh] };
    if (pattern === '41')  return { cat: 7, ranks: groups };
    if (pattern === '32')  return { cat: 6, ranks: groups };
    if (isFlush)           return { cat: 5, ranks: vals };
    if (isStraight)        return { cat: 4, ranks: [straightHigh] };
    if (pattern === '311') return { cat: 3, ranks: groups };
    if (pattern === '221') return { cat: 2, ranks: groups };
    if (pattern === '2111')return { cat: 1, ranks: groups };
    return { cat: 0, ranks: vals };
  };

  const cmp = (a, b) => {
    if (a.cat !== b.cat) return a.cat - b.cat;
    const len = Math.max(a.ranks.length, b.ranks.length);
    for (let i = 0; i < len; i++) {
      const d = (a.ranks[i] || 0) - (b.ranks[i] || 0);
      if (d) return d;
    }
    return 0;
  };

  const combos = (arr, k) => {
    const res = [];
    const rec = (start, pick) => {
      if (pick.length === k) { res.push(pick.slice()); return; }
      for (let i = start; i < arr.length; i++) { pick.push(arr[i]); rec(i + 1, pick); pick.pop(); }
    };
    rec(0, []);
    return res;
  };

  const best = (cards) => {
    if (cards.length <= 5) { const r = eval5(cards); r.name = NAMES[r.cat]; return r; }
    let bestRes = null;
    for (const combo of combos(cards, 5)) {
      const r = eval5(combo);
      if (!bestRes || cmp(r, bestRes) > 0) bestRes = r;
    }
    bestRes.name = NAMES[bestRes.cat];
    return bestRes;
  };

  return { best, cmp, NAMES };
})();

/* ======================================================================
   7. COMPOSANT DE MISE réutilisable
   ====================================================================== */
function makeBetControls(container, { defaultBet = 100 } = {}) {
  container.innerHTML = `
    <div class="bet-field">
      <label>Mise</label>
      <input class="bet-input" type="number" inputmode="numeric" min="1" step="10" value="${defaultBet}" aria-label="Montant de la mise">
    </div>
    <div class="bet-quick">
      <button class="bet-chip" data-add="10">+10</button>
      <button class="bet-chip" data-add="50">+50</button>
      <button class="bet-chip" data-add="100">+100</button>
      <button class="bet-chip" data-set="500">500</button>
      <button class="bet-chip max" data-max="1">MAX</button>
    </div>`;
  const input = $('.bet-input', container);

  const clampVal = () => {
    let v = Math.floor(Number(input.value) || 0);
    v = clamp(v, 0, Bank.balance);
    input.value = v > 0 ? v : '';
  };
  input.addEventListener('blur', clampVal);

  container.addEventListener('click', (e) => {
    const b = e.target.closest('.bet-chip'); if (!b) return;
    Sound.play('chip');
    let v = Math.floor(Number(input.value) || 0);
    if (b.dataset.add) v += Number(b.dataset.add);
    else if (b.dataset.set) v = Number(b.dataset.set);
    else if (b.dataset.max) v = Bank.balance;
    input.value = clamp(v, 0, Bank.balance) || '';
  });

  return {
    read() {
      const v = Math.floor(Number(input.value) || 0);
      if (v <= 0) { UI.toast('Mise invalide : entrez un montant positif.', 'lose'); return null; }
      if (v > Bank.balance) { UI.toast('Solde insuffisant pour cette mise.', 'lose'); return null; }
      return v;
    },
    value: () => Math.floor(Number(input.value) || 0),
    set: (v) => { input.value = clamp(Math.floor(v), 0, Bank.balance) || ''; },
    input,
  };
}

/* ======================================================================
   8. JEU — DÉS
   ====================================================================== */
const DiceGame = (() => {
  let bet, busy = false;
  const els = {};

  const init = () => {
    bet = makeBetControls($('#diceBetDock'), { defaultBet: 100 });
    Object.assign(els, {
      p1: $('#pDie1'), p2: $('#pDie2'), h1: $('#hDie1'), h2: $('#hDie2'),
      pT: $('#pTotal'), hT: $('#hTotal'), res: $('#diceResult'),
      btn: $('#diceRollBtn'), vs: $('#diceVs'),
    });
    els.btn.addEventListener('click', roll);
  };

  const roll = async () => {
    if (busy) return;
    const stake = bet.read(); if (stake === null) return;
    if (!Bank.placeBet(stake)) { UI.toast('Mise refusée.', 'lose'); return; }

    busy = true; els.btn.disabled = true;
    els.res.textContent = ''; els.res.className = 'dice-result';
    els.vs.classList.add('hot');
    [els.p1, els.p2, els.h1, els.h2].forEach((d) => d.classList.add('rolling'));
    els.pT.textContent = els.hT.textContent = '—';

    const stopDice = Sound.diceTumble(1300);       // dés qui roulent (par-dessus la musique)
    for (let i = 0; i < 9; i++) {
      [els.p1, els.p2, els.h1, els.h2].forEach((d) => d.textContent = '⚀⚁⚂⚃⚄⚅'[randInt(0, 5)]);
      await wait(90 + i * 12);
    }
    stopDice();

    const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const p = [randInt(1, 6), randInt(1, 6)];
    const h = [randInt(1, 6), randInt(1, 6)];
    [els.p1, els.p2, els.h1, els.h2].forEach((d) => d.classList.remove('rolling'));
    els.p1.textContent = faces[p[0]]; els.p2.textContent = faces[p[1]];
    els.h1.textContent = faces[h[0]]; els.h2.textContent = faces[h[1]];
    const pt = p[0] + p[1], ht = h[0] + h[1];
    els.pT.textContent = pt; els.hT.textContent = ht;
    els.vs.classList.remove('hot');
    await wait(320);

    let net;
    if (pt > ht) {
      // On remporte le double de sa mise : sa propre mise + celle de l'adversaire.
      // La mise a déjà été débitée, on recrédite donc 3× la mise (net = +2× la mise).
      const gain = stake * 2;
      Bank.addWinnings(stake + gain); net = gain;
      els.res.textContent = `VICTOIRE  +${fmt(gain)}`; els.res.className = 'dice-result result-win';
      Sound.play('win'); UI.coinRain(); UI.toast(`Victoire ! +${fmt(gain)} crédits`, 'win');
    } else if (pt < ht) {
      net = -stake;
      els.res.textContent = `DÉFAITE  −${fmt(stake)}`; els.res.className = 'dice-result result-lose';
      Sound.play('lose'); UI.toast(`Défaite… −${fmt(stake)} crédits`, 'lose');
    } else {
      Bank.credit(stake); net = 0;
      els.res.textContent = 'ÉGALITÉ — mise remboursée'; els.res.className = 'dice-result result-tie';
      Sound.play('tie'); UI.toast('Égalité — mise remboursée');
    }
    Bank.record(net, 'Dés');
    busy = false; els.btn.disabled = false;
  };

  const onEnter = () => {
    els.res.textContent = ''; els.res.className = 'dice-result';
    ['?','?','?','?'].forEach((v, i) => [els.p1, els.p2, els.h1, els.h2][i].textContent = v);
    els.pT.textContent = els.hT.textContent = '—';
  };

  return { init, onEnter };
})();

/* ======================================================================
   9. JEU — BLACKJACK
   ====================================================================== */
const Blackjack = (() => {
  let deck = [], player = [], dealer = [], bet, stake = 0;
  let phase = 'idle', doubled = false, busy = false;
  const els = {};

  const init = () => {
    bet = makeBetControls($('#bjBetDock'), { defaultBet: 100 });
    Object.assign(els, {
      dHand: $('#bjDealerHand'), pHand: $('#bjPlayerHand'),
      dScore: $('#bjDealerScore'), pScore: $('#bjPlayerScore'),
      banner: $('#bjBanner'), deal: $('#bjDealBtn'),
      hit: $('#bjHit'), stand: $('#bjStand'), dbl: $('#bjDouble'),
    });
    els.deal.addEventListener('click', deal);
    els.hit.addEventListener('click', hit);
    els.stand.addEventListener('click', stand);
    els.dbl.addEventListener('click', double);
  };

  const score = (hand) => {
    let total = 0, aces = 0;
    for (const c of hand) {
      if (c.value === 14) { aces++; total += 11; }
      else total += Math.min(c.value, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  };
  const isBlackjack = (hand) => hand.length === 2 && score(hand) === 21;

  const drawCard = (hand, faceDown = false) => {
    const c = deck.pop(); c._down = faceDown; hand.push(c); return c;
  };

  const render = ({ revealDealer = false } = {}) => {
    els.pHand.innerHTML = '';
    player.forEach((c) => els.pHand.appendChild(Cards.el(c)));
    els.dHand.innerHTML = '';
    dealer.forEach((c) => els.dHand.appendChild(Cards.el(c, c._down && !revealDealer)));
    els.pScore.textContent = score(player);
    els.dScore.textContent = revealDealer ? score(dealer) : score(dealer.filter((c) => !c._down));
  };

  const setActions = ({ hit, stand, dbl }) => {
    els.hit.disabled = !hit; els.stand.disabled = !stand; els.dbl.disabled = !dbl;
  };

  const deal = async () => {
    if (busy || phase === 'player') return;
    const s = bet.read(); if (s === null) return;
    if (!Bank.placeBet(s)) { UI.toast('Mise refusée.', 'lose'); return; }
    stake = s; doubled = false; busy = true;
    els.deal.disabled = true; els.banner.textContent = ''; els.banner.className = 'bj-banner';

    deck = Cards.shuffle(Cards.freshDeck());
    player = []; dealer = [];
    drawCard(player); render(); Sound.play('card'); await wait(280);
    drawCard(dealer); render(); Sound.play('card'); await wait(280);
    drawCard(player); render(); Sound.play('card'); await wait(280);
    drawCard(dealer, true); render(); Sound.play('card'); await wait(220);

    phase = 'player';
    if (isBlackjack(player)) { await settle(); busy = false; return; }
    setActions({ hit: true, stand: true, dbl: Bank.balance >= stake });
    busy = false;
  };

  const hit = async () => {
    if (busy || phase !== 'player') return;
    busy = true; setActions({ hit: false, stand: false, dbl: false });
    drawCard(player); render(); Sound.play('card'); await wait(160);
    if (score(player) > 21) await settle();
    else setActions({ hit: true, stand: true, dbl: false });
    busy = false;
  };

  const double = async () => {
    if (busy || phase !== 'player' || doubled) return;
    if (!Bank.debit(stake)) { UI.toast('Solde insuffisant pour doubler.', 'lose'); return; }
    doubled = true; stake *= 2; busy = true;
    setActions({ hit: false, stand: false, dbl: false });
    Sound.play('chip'); UI.toast('Mise doublée');
    drawCard(player); render(); Sound.play('card'); await wait(320);
    if (score(player) > 21) await settle();
    else await dealerPlay();
    busy = false;
  };

  const stand = async () => {
    if (busy || phase !== 'player') return;
    busy = true; setActions({ hit: false, stand: false, dbl: false });
    await dealerPlay();
    busy = false;
  };

  const dealerPlay = async () => {
    dealer.forEach((c) => c._down = false);
    render({ revealDealer: true }); Sound.play('card'); await wait(520);
    while (score(dealer) < 17) {
      drawCard(dealer); render({ revealDealer: true }); Sound.play('card'); await wait(600);
    }
    await settle();
  };

  const settle = async () => {
    phase = 'done';
    dealer.forEach((c) => c._down = false);
    render({ revealDealer: true });
    setActions({ hit: false, stand: false, dbl: false });
    els.deal.disabled = false;

    const ps = score(player), ds = score(dealer);
    const pbj = isBlackjack(player), dbj = isBlackjack(dealer);
    let net, msg, cls;

    if (pbj && !dbj) {
      Bank.addWinnings(Math.round(stake * 2.5)); net = Math.round(stake * 1.5);
      msg = `BLACKJACK !  +${fmt(net)}`; cls = 'result-gold'; Sound.play('jackpot'); UI.coinRain(24);
    } else if (ps > 21) {
      net = -stake; msg = `BUST — Perdu  −${fmt(stake)}`; cls = 'result-lose'; Sound.play('lose');
    } else if (ds > 21 || ps > ds) {
      Bank.addWinnings(stake * 2); net = stake;
      msg = (ds > 21 ? 'Croupier bust ! ' : '') + `VICTOIRE  +${fmt(stake)}`; cls = 'result-win';
      Sound.play('win'); UI.coinRain();
    } else if (ps < ds) {
      net = -stake; msg = `DÉFAITE  −${fmt(stake)}`; cls = 'result-lose'; Sound.play('lose');
    } else {
      Bank.credit(stake); net = 0; msg = 'ÉGALITÉ — remboursé'; cls = 'result-tie'; Sound.play('tie');
    }

    els.banner.textContent = msg; els.banner.className = 'bj-banner ' + cls;
    UI.toast(msg.replace(/\s+/g, ' '), net > 0 ? 'win' : net < 0 ? 'lose' : '');
    Bank.record(net, 'Blackjack');
    phase = 'idle';
  };

  return { init };
})();

/* ======================================================================
   10. JEU — POKER (Texas Hold'em vs 3 IA)
       Modèle argent : le joueur mise DIRECTEMENT sur le solde global.
       On cumule ce qu'il a payé (contrib) et récupéré (retour) sur la main,
       et on journalise le net à la fin.
   ====================================================================== */
const Poker = (() => {
  const SMALL = 25, BIG = 50, AI_STACK = 3000;
  let deck, community, players, pot, currentBet, stage, dealerBtn;
  let busy = false, awaitingResolve = null;
  let humanContrib = 0, humanReturn = 0;
  const els = {};

  const init = () => {
    Object.assign(els, {
      seats: $('#pokerSeats'), pot: $('#pokerPot'), community: $('#pokerCommunity'),
      stage: $('#pokerStage'), newBtn: $('#pokerNewBtn'),
      check: $('#pkCheck'), call: $('#pkCall'), raise: $('#pkRaise'),
      fold: $('#pkFold'), allin: $('#pkAllin'),
      raiseRow: $('#pokerRaiseRow'), slider: $('#pokerRaiseSlider'),
      raiseAmt: $('#pokerRaiseAmt'), raiseOk: $('#pokerRaiseConfirm'), raiseCancel: $('#pokerRaiseCancel'),
    });
    players = [
      { name: 'Vous',     human: true,  chips: 0, cards: [], folded: false, allin: false, bet: 0, status: '', acted: false },
      { name: 'Léa',      human: false, chips: AI_STACK, cards: [], folded: false, allin: false, bet: 0, status: '', acted: false },
      { name: 'Marc',     human: false, chips: AI_STACK, cards: [], folded: false, allin: false, bet: 0, status: '', acted: false },
      { name: 'Nadia',    human: false, chips: AI_STACK, cards: [], folded: false, allin: false, bet: 0, status: '', acted: false },
    ];
    dealerBtn = 0; community = []; pot = 0;

    els.newBtn.addEventListener('click', newHand);
    els.check.addEventListener('click', () => human('check'));
    els.call.addEventListener('click', () => human('call'));
    els.fold.addEventListener('click', () => human('fold'));
    els.allin.addEventListener('click', () => human('allin'));
    els.raise.addEventListener('click', openRaise);
    els.raiseCancel.addEventListener('click', () => { els.raiseRow.hidden = true; });
    els.slider.addEventListener('input', () => { els.raiseAmt.textContent = fmt(Number(els.slider.value)); });
    els.raiseOk.addEventListener('click', () => { if (awaitingResolve) { Sound.play('chip'); awaitingResolve('raise', Number(els.slider.value)); } });

    renderSeats();
  };

  const human0 = () => players[0];
  /** Jetons disponibles d'un joueur (le joueur humain puise dans le solde). */
  const available = (p) => p.human ? Bank.balance : p.chips;
  const enableActions = (on) => ['check', 'call', 'raise', 'fold', 'allin'].forEach((k) => els[k].disabled = !on);

  const renderSeats = () => {
    els.seats.innerHTML = '';
    players.forEach((p, i) => {
      const seat = document.createElement('div');
      seat.className = 'seat' + (p.folded ? ' folded' : '') + (p.winner ? ' winner' : '');
      seat.innerHTML = `<div class="seat-name">${p.name}${i === dealerBtn ? ' Ⓓ' : ''}</div>`;
      const cardsWrap = document.createElement('div'); cardsWrap.className = 'seat-cards';
      p.cards.forEach((c) => cardsWrap.appendChild(Cards.el(c, !(p.human || p.reveal))));
      seat.appendChild(cardsWrap);
      const chipsShown = p.human ? Bank.balance : p.chips;
      const info = document.createElement('div');
      info.innerHTML = `<div class="seat-chips">🪙 ${fmt(chipsShown)}</div>`
        + `<div class="seat-status ${p.status ? 'act' : ''}">${p.status || (p.bet ? 'Mise ' + fmt(p.bet) : '&nbsp;')}</div>`;
      seat.appendChild(info);
      els.seats.appendChild(seat);
    });
    els.pot.textContent = fmt(pot || 0);
  };

  const renderCommunity = () => {
    els.community.innerHTML = '';
    community.forEach((c) => els.community.appendChild(Cards.el(c)));
  };

  /** Fait payer `amount` à `p` (borné par ses jetons dispo). Renvoie payé. */
  const pay = (p, amount) => {
    const paid = Math.min(amount, available(p));
    if (paid <= 0) return 0;
    if (p.human) { Bank.debit(paid); humanContrib += paid; }
    else p.chips -= paid;
    p.bet += paid; pot += paid;
    if (available(p) === 0) p.allin = true;
    return paid;
  };
  const award = (p, amount) => {
    if (amount <= 0) return;
    if (p.human) { Bank.credit(amount); humanReturn += amount; }
    else p.chips += amount;
  };

  const activePlayers = () => players.filter((p) => !p.folded);
  const canAct = () => players.filter((p) => !p.folded && !p.allin);

  const newHand = async () => {
    if (busy) return;
    if (Bank.balance < BIG) { UI.toast('Solde insuffisant pour vous asseoir (min. ' + fmt(BIG) + ').', 'lose'); return; }
    busy = true; els.newBtn.disabled = true;
    Bank.countGame();

    deck = Cards.shuffle(Cards.freshDeck());
    community = []; pot = 0; currentBet = 0; stage = 'preflop';
    humanContrib = 0; humanReturn = 0;
    players.forEach((p) => {
      p.cards = []; p.folded = false; p.allin = false; p.bet = 0; p.status = ''; p.winner = false; p.reveal = false; p.acted = false;
      if (!p.human && p.chips < BIG) p.chips = AI_STACK;
    });
    renderCommunity();

    dealerBtn = (dealerBtn + 1) % players.length;
    const sbPos = (dealerBtn + 1) % players.length;
    const bbPos = (dealerBtn + 2) % players.length;
    pay(players[sbPos], SMALL); players[sbPos].status = 'Petite blinde';
    pay(players[bbPos], BIG);   players[bbPos].status = 'Grosse blinde';
    currentBet = BIG;

    for (let r = 0; r < 2; r++) for (const p of players) p.cards.push(deck.pop());
    Sound.play('card'); renderSeats();
    els.stage.textContent = 'Pre-Flop';

    await bettingRound((bbPos + 1) % players.length);
  };

  const bettingRound = async (startIdx) => {
    players.forEach((p) => { if (!p.folded && !p.allin) p.acted = false; });
    let idx = startIdx, safety = 0;

    while (safety++ < 60) {
      if (activePlayers().length <= 1) break;
      if (canAct().length === 0) break;

      const p = players[idx];
      if (p.folded || p.allin) { idx = (idx + 1) % players.length; continue; }

      const toCall = currentBet - p.bet;
      if (p.acted && toCall === 0) {
        const pending = canAct().some((q) => !q.acted || (currentBet - q.bet) > 0);
        if (!pending) break;
      }

      renderSeats();
      if (p.human) {
        await humanTurn(p, toCall);
      } else {
        p.status = 'Réfléchit…'; renderSeats();
        await wait(680);
        aiAct(p, toCall);
        renderSeats();
        await wait(280);
      }
      p.acted = true;
      idx = (idx + 1) % players.length;
    }

    players.forEach((p) => { if (!p.folded) p.status = ''; });
    renderSeats();

    if (activePlayers().length <= 1) { await showdown(); return; }
    await nextStage();
  };

  const humanTurn = (p, toCall) => new Promise((resolve) => {
    const callAmt = Math.min(toCall, Bank.balance);
    els.check.disabled = toCall > 0;
    els.call.disabled = toCall === 0;
    els.call.textContent = toCall > 0 ? `CALL ${fmt(callAmt)}` : 'CALL';
    els.raise.disabled = Bank.balance <= toCall;
    els.fold.disabled = false;
    els.allin.disabled = Bank.balance === 0;
    els.stage.textContent = toCall > 0 ? `À vous — suivre : ${fmt(callAmt)}` : 'À vous — vous pouvez checker';

    awaitingResolve = (action, amount) => {
      awaitingResolve = null;
      enableActions(false); els.raiseRow.hidden = true;
      applyHuman(p, action, amount, toCall);
      resolve();
    };
  });

  const human = (action) => { if (awaitingResolve) { Sound.play('chip'); awaitingResolve(action); } };

  const openRaise = () => {
    const p = human0();
    const minTotal = currentBet + BIG;
    const maxTotal = p.bet + Bank.balance;
    const lo = Math.min(minTotal, maxTotal);
    els.slider.min = lo; els.slider.max = maxTotal; els.slider.value = lo;
    els.raiseAmt.textContent = fmt(lo);
    els.raiseRow.hidden = false;
  };

  const applyHuman = (p, action, amount, toCall) => {
    if (action === 'fold') { p.folded = true; p.status = 'Se couche'; }
    else if (action === 'check') { p.status = 'Check'; }
    else if (action === 'call') { pay(p, toCall); p.status = 'Call'; }
    else if (action === 'allin') {
      pay(p, Bank.balance);
      currentBet = Math.max(currentBet, p.bet); p.status = 'All-in';
      reopen(p);
    } else if (action === 'raise') {
      const total = clamp(Math.floor(amount), p.bet, p.bet + Bank.balance);
      pay(p, total - p.bet);
      currentBet = Math.max(currentBet, p.bet); p.status = 'Relance ' + fmt(total);
      reopen(p);
    }
    renderSeats();
  };
  const reopen = (raiser) => players.forEach((q) => { if (q !== raiser && !q.folded && !q.allin) q.acted = false; });

  /* ---- IA ---- */
  const aiAct = (p, toCall) => {
    const strength = handStrength(p);
    const rand = Math.random();
    const potOdds = toCall / (pot + toCall + 1);

    if (toCall === 0) {
      if (strength > 0.6 && rand < 0.55) aiRaise(p, strength);
      else p.status = 'Check';
    } else {
      if (strength < 0.25 && potOdds > 0.15) {
        if (rand < 0.85) { p.folded = true; p.status = 'Se couche'; }
        else { pay(p, toCall); p.status = 'Call'; }
      } else if (strength > 0.72 && rand < 0.5 && p.chips > toCall + BIG) {
        aiRaise(p, strength);
      } else {
        pay(p, toCall); p.status = p.bet ? 'Call' : 'Check';
      }
    }
  };
  const aiRaise = (p, strength) => {
    const toCall = currentBet - p.bet;
    const raiseBy = Math.max(BIG, Math.round(BIG * (1 + strength * 4)));
    pay(p, toCall + raiseBy);
    currentBet = Math.max(currentBet, p.bet);
    p.status = p.allin ? 'All-in' : 'Relance';
    reopen(p);
  };

  const handStrength = (p) => {
    if (community.length >= 3) {
      const r = PokerEval.best([...p.cards, ...community]);
      return clamp(r.cat / 9 + (r.ranks[0] || 0) / 220, 0, 1);
    }
    const [a, b] = p.cards;
    let s = (a.value + b.value) / 28;
    if (a.value === b.value) s += 0.35;
    if (a.suit === b.suit) s += 0.08;
    if (Math.abs(a.value - b.value) === 1) s += 0.05;
    return clamp(s, 0, 1);
  };

  const nextStage = async () => {
    players.forEach((p) => p.bet = 0);
    currentBet = 0;

    if (stage === 'preflop') { stage = 'flop'; deck.pop(); community.push(deck.pop(), deck.pop(), deck.pop()); els.stage.textContent = 'Flop'; }
    else if (stage === 'flop') { stage = 'turn'; deck.pop(); community.push(deck.pop()); els.stage.textContent = 'Turn'; }
    else if (stage === 'turn') { stage = 'river'; deck.pop(); community.push(deck.pop()); els.stage.textContent = 'River'; }
    else { await showdown(); return; }

    Sound.play('card'); renderCommunity(); renderSeats();
    await wait(650);

    if (canAct().length <= 1 && activePlayers().length > 1) { await autoRunout(); return; }
    await bettingRound((dealerBtn + 1) % players.length);
  };

  const autoRunout = async () => {
    while (community.length < 5) {
      deck.pop(); community.push(deck.pop());
      renderCommunity(); Sound.play('card'); await wait(500);
    }
    await showdown();
  };

  const showdown = async () => {
    const contenders = activePlayers();
    let winners;

    if (contenders.length === 1) {
      winners = contenders;
      els.stage.textContent = `${winners[0].name} remporte le pot`;
    } else {
      contenders.forEach((p) => p.reveal = true);
      renderSeats();
      let best = null;
      contenders.forEach((p) => {
        p._eval = PokerEval.best([...p.cards, ...community]);
        if (!best || PokerEval.cmp(p._eval, best) > 0) best = p._eval;
      });
      winners = contenders.filter((p) => PokerEval.cmp(p._eval, best) === 0);
      els.stage.textContent = winners.length === 1
        ? `${winners[0].name} gagne — ${winners[0]._eval.name}`
        : `Partage du pot — ${winners[0]._eval.name}`;
      await wait(500);
    }

    const share = Math.floor(pot / winners.length);
    winners.forEach((p) => { award(p, share); p.winner = true; });
    pot = 0;
    renderSeats();

    const humanWon = winners.some((w) => w.human);
    if (humanWon) { Sound.play('win'); UI.coinRain(); } else Sound.play('chip');

    // Journalise le net de la main pour le joueur
    const net = humanReturn - humanContrib;
    Bank.record(net, 'Poker');
    if (net > 0) UI.toast(`Main gagnée : +${fmt(net)}`, 'win');
    else if (net < 0) UI.toast(`Main perdue : ${fmt(net)}`, 'lose');
    else UI.toast('Main nulle pour vous');

    await wait(400);
    els.newBtn.disabled = false;
    busy = false;
  };

  const onEnter = () => {
    els.stage.textContent = 'Appuyez sur « Nouvelle main »';
    els.raiseRow.hidden = true;
    enableActions(false);
  };

  return { init, onEnter };
})();

/* ======================================================================
   11. JEU — MACHINE À ROULEAUX (slot 3 rouleaux)
   ====================================================================== */
const Slot = (() => {
  const SYMBOLS = ['🪙', '💎', '🍌', '🍖', '🍉', '🍑', '🍍'];
  // Multiplicateurs de gain pour 3 symboles identiques.
  // 🪙 x1.5 · 💎 x2.5 · 🍉 = mise perdue (déjà débitée) · autres = rien (mise perdue aussi)
  const PAYOUTS = { '🪙': 1.5, '💎': 2.5 };
  let bet, busy = false;
  const reels = [];
  const els = {};

  const init = () => {
    bet = makeBetControls($('#slotBetDock'), { defaultBet: 100 });
    Object.assign(els, {
      readout: $('#slotReadout'), spinBtn: $('#slotSpinBtn'), lever: $('#slotLever'),
    });
    for (let i = 0; i < 3; i++) {
      const strip = $(`#reel${i} .reel-strip`);
      reels.push({ strip, el: $(`#reel${i}`) });
      buildStrip(strip, i);
    }
    els.spinBtn.addEventListener('click', spin);
    els.lever.addEventListener('click', spin);
    els.lever.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(); } });
  };

  /** Construit une longue bande de symboles aléatoires + une cellule finale fixée ensuite. */
  const buildStrip = (strip, reelIdx) => {
    strip.innerHTML = '';
    // ~24 cellules aléatoires ; la dernière visible sera imposée au spin.
    for (let i = 0; i < 26; i++) {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.textContent = SYMBOLS[randInt(0, SYMBOLS.length - 1)];
      strip.appendChild(cell);
    }
  };

  const cellHeight = () => reels[0].el.clientHeight; // hauteur d'une fenêtre = une cellule

  /** Anime un rouleau jusqu'à s'arrêter sur `finalSymbol`. */
  const spinReel = (reel, finalSymbol, duration) => new Promise((resolve) => {
    // Reconstruit une bande longue finissant par le symbole voulu
    reel.strip.innerHTML = '';
    const total = 30;
    for (let i = 0; i < total; i++) {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.textContent = (i === total - 1) ? finalSymbol : SYMBOLS[randInt(0, SYMBOLS.length - 1)];
      reel.strip.appendChild(cell);
    }
    const h = cellHeight();
    const distance = (total - 1) * h;
    reel.strip.style.transition = 'none';
    reel.strip.style.transform = 'translateY(0)';
    // force reflow
    void reel.strip.offsetHeight;
    reel.strip.style.transition = `transform ${duration}ms cubic-bezier(.15,.7,.2,1)`;
    reel.strip.style.transform = `translateY(-${distance}px)`;

    // Tic sonore pendant la rotation
    let ticks = Math.floor(duration / 90);
    const ti = setInterval(() => { Sound.play('reel'); if (--ticks <= 0) clearInterval(ti); }, 90);

    setTimeout(() => { clearInterval(ti); resolve(); }, duration + 40);
  });

  const spin = async () => {
    if (busy) return;
    const stake = bet.read(); if (stake === null) return;
    if (!Bank.placeBet(stake)) { UI.toast('Mise refusée.', 'lose'); return; }

    busy = true;
    els.spinBtn.disabled = true;
    els.readout.textContent = 'Les rouleaux tournent…'; els.readout.className = 'slot-readout';
    els.lever.classList.add('pulled');
    Sound.play('lever'); await wait(180); Sound.play('launch');
    const stopReel = Sound.reelSpin(2700);         // whirr des rouleaux (par-dessus la musique)

    // Tire les 3 symboles finaux
    // Tirage piloté par les taux visés (proportionnels : plus le lot est gros,
    // plus il est rare) : 2,5 % gros gain (triple 🪙/💎), 16 % triple au total,
    // 52 % de victoire (paire ou triple), 48 % perdant.
    const shuffle3 = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    };
    const premium = ['🪙', '💎'];
    const others = SYMBOLS.filter((s) => s !== '🪙' && s !== '💎');
    const roll = Math.random();
    let result;
    if (roll < 0.025) {                      // gros gain : triple premium (2,5 %)
      const s = premium[randInt(0, 1)];
      result = [s, s, s];
    } else if (roll < 0.16) {                // autre triple (non premium) → 13,5 %
      const s = others[randInt(0, others.length - 1)];
      result = [s, s, s];
    } else if (roll < 0.52) {                // paire (victoire) → 36 %
      const p = SYMBOLS[randInt(0, SYMBOLS.length - 1)];
      let odd; do { odd = SYMBOLS[randInt(0, SYMBOLS.length - 1)]; } while (odd === p);
      result = shuffle3([p, p, odd]);
    } else {                                 // trois symboles différents (perdant) → 48 %
      const pool = shuffle3(SYMBOLS.slice());
      result = [pool[0], pool[1], pool[2]];
    }

    // Rouleaux s'arrêtent l'un après l'autre (durées croissantes)
    await Promise.all([
      spinReel(reels[0], result[0], 1400),
      spinReel(reels[1], result[1], 1900),
      spinReel(reels[2], result[2], 2400),
    ]);
    stopReel();                                    // arrêt du whirr quand les rouleaux se figent

    els.lever.classList.remove('pulled');
    await wait(150);

    // Résolution des gains
    // Grille de gains généreuse : tout triple gagne, et toute paire rapporte
    // une petite somme. Seul « trois symboles tous différents » perd.
    const counts = {};
    result.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
    const three = Object.keys(counts).find((k) => counts[k] === 3);
    const pair = Object.keys(counts).find((k) => counts[k] === 2);
    let mult = 0, tier = '';
    if (three) {
      if (three === '💎') { mult = 2.5; tier = 'jackpot'; }
      else if (three === '🪙') { mult = 1.5; tier = 'jackpot'; }
      else { mult = 1; tier = 'triple'; }                 // autre triple = joli gain
    } else if (pair) {
      if (pair === '🪙' || pair === '💎') { mult = 0.8; tier = 'pair'; }
      else { mult = 0.35; tier = 'small'; }               // paire quelconque = petite somme
    }

    let net;
    if (mult > 0) {
      const gain = Math.max(1, Math.round(stake * mult)); // gain net (mise déjà débitée)
      Bank.addWinnings(stake + gain);
      net = gain;
      const label = tier === 'jackpot' ? 'JACKPOT' : tier === 'small' ? 'Petit gain' : 'GAIN';
      els.readout.textContent = `${result.join(' ')}  —  ${label} +${fmt(gain)}`;
      els.readout.className = 'slot-readout win';
      if (tier === 'jackpot') { Sound.play('jackpot'); UI.coinRain(28); UI.toast(`Jackpot ! +${fmt(gain)} crédits`, 'win'); }
      else { Sound.play('win'); UI.coinRain(tier === 'triple' ? 18 : 8); UI.toast(`Gagné ! +${fmt(gain)} crédits`, 'win'); }
    } else {
      net = -stake;
      els.readout.textContent = `${result.join(' ')}  —  Rien −${fmt(stake)}`;
      els.readout.className = 'slot-readout lose';
      Sound.play('lose'); UI.toast(`Perdu −${fmt(stake)} crédits`, 'lose');
    }

    Bank.record(net, 'Machine');
    busy = false;
    els.spinBtn.disabled = false;
  };

  const onEnter = () => {
    // Positionne un symbole visible au centre de chaque rouleau au repos
    reels.forEach((reel) => {
      reel.strip.style.transition = 'none';
      reel.strip.style.transform = 'translateY(0)';
      if (!reel.strip.children.length) buildStrip(reel.strip);
    });
    els.readout.textContent = 'Placez une mise et tirez le levier';
    els.readout.className = 'slot-readout';
  };

  return { init, onEnter };
})();

/* ======================================================================
   11 bis. CONCESSION — catégories de véhicules
   ====================================================================== */
const Concession = (() => {
  // Catégories + niveau de déblocage.
  const CAT = {
    velo:    { name: 'Vélos',    ico: '🚲', unlock: 1,  tld: 'velo' },
    voiture: { name: 'Voitures', ico: '🚗', unlock: 10, tld: 'auto' },
    bateau:  { name: 'Bateaux',  ico: '⛵', unlock: 25, tld: 'nautic' },
    avion:   { name: 'Avions',   ico: '✈️', unlock: 35, tld: 'aero' },
  };
  // Catalogue : catégorie → pays (nom FR) → [ [modèle, prix réel en €] ].
  // On ne peut acheter QUE les véhicules fabriqués dans le pays de son entreprise.
  const CATALOG = {
    velo: {
      'France': [['Décathlon Triban RC500', 750], ['Décathlon Van Rysel RCR', 3500], ['Origine Axxome GT', 3200], ['Lapierre Sensium', 2200], ['Lapierre Xelius SL', 4200], ['Lapierre Aircode DRS', 5000], ['Lapierre Overvolt (électrique)', 5500], ['Look 765 Optimum', 4000], ['Look 785 Huez', 6200], ['Look 795 Blade RS', 8500], ['Time ADHX', 6000], ['Time Alpe d\'Huez 21', 9000], ['Moustache Lundi (électrique)', 3500], ['Moustache Samedi 29 (électrique)', 5200], ['Cyfac sur mesure', 6500]],
      'Italie': [['Bianchi Via Nirone', 1200], ['Bianchi Sprint', 3000], ['Bianchi Infinito XE', 5000], ['Bianchi Specialissima', 9500], ['Bianchi Oltre RC', 12000], ['Colnago V4Rs', 14000], ['Colnago C68', 15000], ['Pinarello Prince', 6500], ['Pinarello Grevil', 7000], ['Pinarello Dogma F', 15000], ['De Rosa Merak', 6500], ['De Rosa SK Pininfarina', 8000], ['Wilier Filante SLR', 10000], ['Wilier Zero SLR', 11000], ['Cinelli Superstar', 5000]],
      'États-Unis': [['Trek Marlin 7', 900], ['Trek Domane AL', 1600], ['Trek Émonda SLR', 9000], ['Trek Madone SLR', 13000], ['Trek Fuel EX', 5000], ['Specialized Allez', 1500], ['Specialized Roubaix', 5000], ['Specialized Tarmac SL8', 12000], ['Specialized Stumpjumper', 6000], ['Specialized Turbo Levo (électrique)', 7500], ['Cannondale Topstone', 3000], ['Cannondale SuperSix EVO', 6000], ['Cannondale SystemSix', 9000], ['Cannondale Scalpel', 7000]],
      'Allemagne': [['Cube Attain', 1500], ['Cube Litening C68X', 3500], ['Cube Stereo (VTT)', 4500], ['Canyon Endurace', 3000], ['Canyon Grail', 4000], ['Canyon Ultimate CFR', 6000], ['Canyon Aeroad CFR', 8000], ['Canyon Spectral (VTT)', 5000], ['Focus Izalco Max', 5500], ['Focus Jam (électrique)', 6000], ['Rose Backroad', 3500], ['Rose X-Lite Six', 5000], ['Storck Fascenario', 9000]],
      'Royaume-Uni': [['Boardman SLR 8.9', 1200], ['Genesis Croix de Fer', 1600], ['Brompton C Line', 2000], ['Brompton P Line', 2800], ['Brompton Electric', 4000], ['Whyte Wessex', 2500], ['Whyte RHeO', 3000], ['Islabikes Pro Series', 1800], ['Pashley Guv\'nor', 1500]],
      'Pays-Bas': [['Batavus Fonk', 1800], ['Gazelle Avignon', 2500], ['Gazelle Ultimate (électrique)', 3500], ['Sparta d-Burst (électrique)', 2600], ['VanMoof S5', 3000], ['VanMoof A5', 3000], ['Koga WorldTraveller', 3500], ['Van Nicholas Zephyr (titane)', 4000]],
      'Espagne': [['Megamo Factory', 3000], ['BH RS1', 4000], ['BH Ultralight EVO', 5000], ['Orbea Gain (électrique)', 4200], ['Orbea Orca M', 5500], ['Orbea Oiz (VTT)', 7000], ['Orbea Rise (électrique)', 8000], ['Mondraker Foxy', 5000], ['Mondraker F-Podium', 6000]],
      'Suisse': [['Scott Speedster', 1400], ['Scott Addict RC', 8000], ['Scott Foil RC', 9000], ['Scott Spark (VTT)', 6000], ['BMC Roadmachine', 5000], ['BMC Teammachine SLR', 9000], ['BMC Fourstroke', 7000], ['Stromer ST5 (électrique)', 8000], ['Thömus Swissrider', 6000]],
      'Canada': [['Devinci Chameleon', 4000], ['Devinci Troy (VTT)', 5000], ['Rocky Mountain Element', 5000], ['Rocky Mountain Altitude', 6000], ['Cervélo Áspero', 5000], ['Cervélo R5', 9000], ['Cervélo S5', 11000], ['Argon 18 Gallium', 7000]],
      'Japon': [['Fuji Jari', 2500], ['Fuji Transonic', 4000], ['Bridgestone Anchor RL8', 3000], ['Bridgestone Anchor RP9', 6000], ['Panasonic FRCC', 5000], ['Araya sur mesure', 3000]],
      'Taïwan': [['Giant Contend', 1200], ['Giant Defy Advanced', 3000], ['Giant Revolt (gravel)', 3500], ['Giant TCR Advanced', 4500], ['Giant Propel Advanced', 6000], ['Giant Trance (VTT)', 5000], ['Merida Scultura', 5000], ['Merida Reacto', 6000], ['Merida Big.Nine (VTT)', 2500]],
    },
    voiture: {
      'France': [['Renault Twingo', 15000], ['Renault Clio', 21000], ['Renault 5 E-Tech', 25000], ['Renault Captur', 26000], ['Renault Arkana', 30000], ['Renault Austral', 37000], ['Renault Mégane E-Tech', 38000], ['Renault Espace', 45000], ['Peugeot 208', 19000], ['Peugeot 2008', 25000], ['Peugeot 308', 32000], ['Peugeot 408', 36000], ['Peugeot 3008', 38000], ['Peugeot 508', 42000], ['Peugeot 5008', 45000], ['Citroën C3', 17000], ['Citroën C4', 27000], ['Citroën C5 Aircross', 35000], ['Citroën C5 X', 40000], ['DS 3', 33000], ['DS 4', 38000], ['DS 7', 48000], ['DS 9', 55000], ['Alpine A110', 63000], ['Alpine A110 S', 72000], ['Alpine A110 R', 115000], ['Bugatti Chiron', 3000000], ['Bugatti Chiron Super Sport', 3500000], ['Bugatti Mistral', 5000000]],
      'Allemagne': [['Opel Corsa', 20000], ['Opel Astra', 28000], ['Volkswagen Polo', 22000], ['Volkswagen Golf', 30000], ['Volkswagen Golf GTI', 42000], ['Volkswagen Tiguan', 38000], ['Volkswagen ID.4', 45000], ['Volkswagen Touareg', 70000], ['Audi A3', 35000], ['Audi A4', 45000], ['Audi A6', 60000], ['Audi Q5', 55000], ['Audi e-tron GT', 105000], ['Audi RS6', 130000], ['Audi R8', 180000], ['BMW Série 1', 35000], ['BMW Série 3', 48000], ['BMW Série 5', 65000], ['BMW X5', 75000], ['BMW i4', 60000], ['BMW M3', 95000], ['BMW M5', 130000], ['Mercedes Classe A', 38000], ['Mercedes Classe C', 50000], ['Mercedes Classe E', 65000], ['Mercedes Classe S', 110000], ['Mercedes EQS', 130000], ['Mercedes-AMG GT', 180000], ['Mercedes-AMG G 63', 190000], ['Porsche 718 Cayman', 65000], ['Porsche Macan', 70000], ['Porsche Taycan', 95000], ['Porsche 911', 130000], ['Porsche 911 Turbo S', 230000]],
      'Italie': [['Fiat Panda', 15000], ['Fiat 500', 17000], ['Fiat 500e', 30000], ['Abarth 595', 25000], ['Lancia Ypsilon', 25000], ['Alfa Romeo Tonale', 40000], ['Alfa Romeo Giulia', 45000], ['Alfa Romeo Stelvio', 55000], ['Alfa Romeo Giulia Quadrifoglio', 90000], ['Maserati Grecale', 75000], ['Maserati Ghibli', 80000], ['Maserati Levante', 90000], ['Maserati Quattroporte', 110000], ['Maserati GranTurismo', 150000], ['Maserati MC20', 240000], ['Ferrari Portofino M', 230000], ['Ferrari Roma', 250000], ['Ferrari 296 GTB', 320000], ['Ferrari 812 Superfast', 350000], ['Ferrari Purosangue', 400000], ['Ferrari SF90 Stradale', 450000], ['Lamborghini Urus', 240000], ['Lamborghini Huracán', 250000], ['Lamborghini Revuelto', 500000], ['Pagani Utopia', 2500000], ['Ferrari Daytona SP3', 2000000]],
      'États-Unis': [['Ford Focus', 24000], ['Ford Mustang', 45000], ['Ford Mustang Mach-E', 55000], ['Ford Bronco', 45000], ['Ford F-150', 50000], ['Ford Explorer', 55000], ['Chevrolet Bolt', 30000], ['Chevrolet Camaro', 40000], ['Chevrolet Silverado', 45000], ['Chevrolet Corvette', 70000], ['Chevrolet Corvette Z06', 120000], ['Tesla Model 3', 42000], ['Tesla Model Y', 48000], ['Tesla Cybertruck', 90000], ['Tesla Model S', 100000], ['Tesla Model S Plaid', 130000], ['Tesla Model X', 110000], ['Jeep Wrangler', 45000], ['Jeep Grand Cherokee', 55000], ['Dodge Challenger', 40000], ['Dodge Charger', 42000], ['Cadillac CT5', 50000], ['Cadillac Lyriq', 65000], ['Cadillac Escalade', 90000], ['Rivian R1T', 80000], ['Lucid Air', 90000], ['GMC Hummer EV', 110000], ['Ford GT', 500000]],
      'Japon': [['Suzuki Swift', 18000], ['Toyota Yaris', 22000], ['Mazda2', 20000], ['Nissan Juke', 25000], ['Toyota Corolla', 25000], ['Honda Civic', 28000], ['Mazda3', 28000], ['Subaru Impreza', 28000], ['Toyota C-HR', 30000], ['Nissan Qashqai', 32000], ['Mazda MX-5', 32000], ['Toyota GR86', 35000], ['Mazda CX-5', 35000], ['Toyota RAV4', 38000], ['Subaru Forester', 38000], ['Nissan Leaf', 37000], ['Toyota Camry', 40000], ['Honda CR-V', 40000], ['Lexus UX', 40000], ['Toyota GR Yaris', 45000], ['Subaru WRX', 45000], ['Nissan Ariya', 50000], ['Lexus NX', 50000], ['Honda Civic Type R', 55000], ['Nissan Z', 55000], ['Toyota GR Supra', 60000], ['Lexus RX', 65000], ['Toyota Land Cruiser', 90000], ['Lexus LC 500', 100000], ['Honda NSX', 200000], ['Nissan GT-R', 110000], ['Lexus LFA (collector)', 700000]],
      'Royaume-Uni': [['Mini Cooper', 25000], ['Mini Countryman', 35000], ['Jaguar XE', 42000], ['Jaguar F-Pace', 60000], ['Jaguar F-Type', 75000], ['Jaguar I-Pace', 80000], ['Land Rover Range Rover Evoque', 50000], ['Land Rover Defender', 65000], ['Land Rover Discovery', 70000], ['Land Rover Range Rover Sport', 90000], ['Land Rover Range Rover', 120000], ['Lotus Emira', 80000], ['Lotus Eletre', 100000], ['Aston Martin DBX', 200000], ['Aston Martin Vantage', 160000], ['Aston Martin DB12', 250000], ['Aston Martin DBS', 300000], ['McLaren GT', 200000], ['McLaren Artura', 230000], ['McLaren 750S', 300000], ['Bentley Bentayga', 200000], ['Bentley Continental GT', 220000], ['Bentley Flying Spur', 230000], ['Rolls-Royce Ghost', 300000], ['Rolls-Royce Cullinan', 350000], ['Rolls-Royce Spectre', 400000], ['Rolls-Royce Phantom', 460000], ['Lotus Evija', 2000000]],
      'Corée du Sud': [['Hyundai i10', 16000], ['Kia Picanto', 16000], ['Kia Rio', 19000], ['Hyundai i20', 20000], ['Hyundai i30', 25000], ['Kia Ceed', 26000], ['Hyundai Kona', 30000], ['Kia Sportage', 35000], ['Hyundai Tucson', 38000], ['Kia Niro', 38000], ['Hyundai Ioniq 5', 45000], ['Hyundai Ioniq 6', 47000], ['Kia EV6', 48000], ['Kia Sorento', 50000], ['Genesis G70', 50000], ['Kia Stinger', 52000], ['Genesis GV70', 60000], ['Genesis G80', 65000], ['Kia EV6 GT', 70000], ['Hyundai Ioniq 5 N', 75000], ['Genesis GV80', 78000], ['Genesis G90', 90000]],
      'Suède': [['Volvo EX30', 40000], ['Volvo XC40', 45000], ['Polestar 2', 50000], ['Volvo S60', 50000], ['Volvo V60', 52000], ['Volvo XC60', 55000], ['Volvo S90', 60000], ['Volvo V90', 62000], ['Polestar 4', 65000], ['Volvo XC90', 70000], ['Polestar 3', 80000], ['Volvo EX90', 85000], ['Koenigsegg Gemera', 1700000], ['Koenigsegg Regera', 2000000], ['Koenigsegg Jesko', 3000000]],
      'Espagne': [['SEAT Ibiza', 20000], ['SEAT Arona', 24000], ['SEAT León', 25000], ['SEAT Ateca', 30000], ['SEAT Tarraco', 38000], ['Cupra Born', 38000], ['Cupra Formentor', 40000], ['Cupra León', 42000], ['Cupra Ateca', 45000], ['Cupra Tavascan', 55000], ['GTA Spano', 800000], ['Hispano Suiza Carmen', 1500000]],
      'Chine': [['MG5', 30000], ['BYD Dolphin', 30000], ['MG4', 32000], ['MG ZS EV', 35000], ['BYD Atto 3', 38000], ['Lynk & Co 01', 40000], ['Xpeng P7', 45000], ['BYD Seal', 45000], ['BYD Han', 55000], ['Zeekr X', 45000], ['Nio ET5', 50000], ['Nio ET7', 60000], ['BYD Tang', 60000], ['Zeekr 001', 60000], ['Xpeng G9', 60000], ['Nio EL7', 70000]],
    },
    bateau: {
      'Italie': [['Riva Iseo', 500000], ['Riva Aquariva Super', 900000], ['Riva Rivamare', 2500000], ['Riva 68 Diable', 5000000], ['Riva 88 Folgore', 8000000], ['Azimut Atlantis 51', 1200000], ['Azimut S6', 1800000], ['Azimut Grande 27M', 5000000], ['Pershing 5X', 1500000], ['Pershing 8X', 3000000], ['Ferretti 500', 2500000], ['Ferretti Yacht 780', 6000000], ['Sanlorenzo SL78', 6000000], ['Ferretti 1000', 25000000], ['Benetti Oasis 40M', 40000000]],
      'France': [['Zodiac Open 7', 55000], ['Zodiac Medline 9', 90000], ['Jeanneau Cap Camarat 9.0', 120000], ['Bénéteau First 24', 90000], ['Bénéteau Oceanis 40.1', 280000], ['Dufour 470', 350000], ['Jeanneau Sun Odyssey 410', 260000], ['Fountaine Pajot Isla 40', 500000], ['Bénéteau Gran Turismo 45', 700000], ['Lagoon 46 (catamaran)', 850000], ['Bénéteau Swift Trawler 50', 900000], ['Jeanneau Prestige 520', 1200000], ['Lagoon 55 (catamaran)', 1500000]],
      'États-Unis': [['Chaparral 280 OSX', 150000], ['Boston Whaler 280', 320000], ['Sea Ray Sundancer 320', 400000], ['MasterCraft X24', 200000], ['Chris-Craft Launch 28', 250000], ['Sea Ray SLX 400', 700000], ['Hinckley Picnic Boat', 700000], ['Bertram 35', 900000], ['Boston Whaler 420', 950000]],
      'Royaume-Uni': [['Princess F45', 900000], ['Fairline Targa 45', 1500000], ['Princess V50', 1500000], ['Sunseeker Predator 55', 3000000], ['Fairline Squadron 68', 4000000], ['Princess Y72', 4500000], ['Sunseeker 88 Yacht', 8000000]],
      'Pays-Bas': [['Contest 55CS', 1500000], ['Amels 60 (superyacht)', 40000000], ['Heesen 50m', 45000000], ['Feadship Custom', 60000000], ['Oceanco 90m', 120000000]],
      'Allemagne': [['Bavaria C42', 300000], ['Hanse 460', 350000], ['Bavaria C46', 400000], ['Sirius 40 DS', 500000], ['Lürssen (superyacht)', 200000000]],
      'Norvège': [['Nimbus T11', 350000], ['Hydrolift C-31', 250000], ['Windy 37 Grand Mistral', 500000], ['Goldfish 44', 700000], ['Windy 46 Chinook', 900000]],
    },
    avion: {
      'États-Unis': [['Cessna 172 Skyhawk', 400000], ['Cessna 182 Skylane', 550000], ['Cirrus SR22', 750000], ['Piper M600', 3500000], ['Cirrus Vision Jet', 3000000], ['Beechcraft Bonanza', 900000], ['Beechcraft King Air 360', 8000000], ['Cessna Citation CJ4', 9000000], ['Hawker 4000', 20000000], ['Cessna Citation Longitude', 28000000], ['Gulfstream G500', 45000000], ['Gulfstream G650ER', 70000000], ['Gulfstream G700', 80000000], ['Boeing BBJ', 90000000], ['Boeing 737 MAX', 120000000], ['Boeing 787 Dreamliner', 250000000]],
      'France': [['Elixir (biplace)', 200000], ['Robin DR400', 250000], ['Daher Kodiak 900', 3000000], ['Daher TBM 960', 4500000], ['Dassault Falcon 2000', 30000000], ['Dassault Falcon 6X', 50000000], ['Dassault Falcon 8X', 60000000], ['Dassault Falcon 10X', 75000000], ['Airbus ACJ TwoTwenty', 80000000], ['Airbus A220', 90000000], ['Airbus A320neo', 110000000]],
      'Canada': [['De Havilland Twin Otter', 7000000], ['Bombardier Challenger 350', 27000000], ['De Havilland Dash 8', 30000000], ['Bombardier Global 6500', 60000000], ['Bombardier Global 7500', 78000000]],
      'Brésil': [['Embraer Phenom 100', 4500000], ['Embraer Phenom 300E', 11000000], ['Embraer Praetor 500', 17000000], ['Embraer Praetor 600', 21000000], ['Embraer E195-E2', 65000000]],
      'Suisse': [['Pilatus PC-6', 2000000], ['Pilatus PC-12', 5500000], ['Pilatus PC-24', 11000000]],
      'Royaume-Uni': [['Britten-Norman Islander', 2000000], ['BAe 146', 30000000]],
      'Allemagne': [['Flight Design F2', 200000], ['Extra 330LT (voltige)', 500000], ['Grob G120TP', 500000]],
    },
  };

  let shop, grid, currentCat = '', currentItems = null, searchQuery = '', sortMode = 'feat';
  let currentCountry = '', buyDist = 0, buyDelay = 6000, buyShipBase = 60;
  let CENTROID = {}, ALL = [];
  const escAttr = (s) => s.replace(/"/g, '&quot;');

  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const haversine = (a, b) => {
    if (!a || !b) return 0;
    const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(s)));
  };
  // Transport réduit et proportionnel à la valeur (petit forfait + 0,6 % du prix).
  const shipForBuy = (price) => buyShipBase + Math.round(price * 0.006);

  const init = () => {
    shop = $('#shop'); grid = $('#shopGrid');
    const geo = window.WORLD_GEO || { countries: [], extra: [] };
    (geo.countries || []).forEach((c) => CENTROID[c.n] = c.c);
    (geo.extra || []).forEach((e) => CENTROID[e.n] = [e.lon, e.lat]);
    ALL = Object.keys(CENTROID).sort((a, b) => a.localeCompare(b, 'fr'));

    $('#shopClose').addEventListener('click', close);
    shop.addEventListener('click', (e) => { if (e.target === shop) close(); });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]'); if (!b) return;
      buy(b.dataset.name, Number(b.dataset.price));
    });
    $('#shopSearch').addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); render(); });
    $('#shopSort').addEventListener('change', (e) => { sortMode = e.target.value; Sound.play('click'); render(); });
    $('#shopCountry').addEventListener('input', (e) => suggestCountry(e.target.value.trim().toLowerCase()));
  };

  const suggestCountry = (q) => {
    const box = $('#shopCountrySuggest');
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const matches = matchCountries(q, ALL, 10);
    if (!matches.length) { box.innerHTML = '<div class="ob-sg-empty">Aucun pays</div>'; box.hidden = false; return; }
    box.innerHTML = matches.map((n) => `<button class="ob-sg" data-c="${escAttr(n)}">${n}</button>`).join('');
    box.hidden = false;
    box.querySelectorAll('.ob-sg').forEach((b) => b.addEventListener('click', () => selectCountry(b.dataset.c)));
  };

  const selectCountry = (name) => {
    currentCountry = name;
    $('#shopCountry').value = name;
    $('#shopCountrySuggest').hidden = true;
    computeRoute();
    Sound.play('select');
    reloadItems();
    render();
  };

  const computeRoute = () => {
    const me = (Bank.company && Bank.company.country) || null;
    const meC = CENTROID[me], pC = CENTROID[currentCountry];
    buyDist = (me === currentCountry) ? 0 : haversine(meC, pC);
    const base = DOMESTIC_DELAY[currentCat] || 6000;
    buyDelay = clamp(base + buyDist * 3, base, 80000);
    buyShipBase = 20 + Math.round(buyDist * 0.012);
    const routeEl = $('#shopRoute');
    if (routeEl) routeEl.innerHTML = buyDist === 0
      ? `🚚 local · transport dès ${fmt(buyShipBase)} € · livraison immédiate`
      : `📍 ${buyDist.toLocaleString('fr-FR')} km · 🚚 dès ${fmt(buyShipBase)} € +1 % · livraison immédiate`;
  };

  const reloadItems = () => {
    currentItems = (CATALOG[currentCat] && CATALOG[currentCat][currentCountry]) ? CATALOG[currentCat][currentCountry].slice() : null;
  };

  const unlockLevel = (cat) => (CAT[cat] ? CAT[cat].unlock : 1);
  const isUnlocked = (cat) => Bank.level >= unlockLevel(cat);

  const select = (cat) => {
    if (!CAT[cat]) return;
    if (!isUnlocked(cat)) {
      Sound.play('lose');
      UI.toast(`🔒 ${CAT[cat].name} — débloqué au niveau ${unlockLevel(cat)}.`, 'lose');
      return;
    }
    openShop(cat);
  };

  // Note pseudo-aléatoire mais stable par modèle (3,8 – 5,0) → étoiles.
  const ratingOf = (name) => {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return 3.8 + (h % 121) / 100;
  };
  const stars = (r) => {
    const full = Math.round(r);
    return `<span class="stars">${'★'.repeat(full)}<span class="star-off">${'★'.repeat(5 - full)}</span></span><span class="rate-num">${r.toFixed(1)}</span>`;
  };

  /* ── Illustrations SVG génératives (pas de photos de marque : couleur et
        silhouette dérivées du nom du modèle → chaque véhicule est distinct). ── */
  const colorOf = (name) => {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return { m: `hsl(${hue},60%,50%)`, d: `hsl(${hue},60%,37%)`, g: '#d6e6fb' };
  };
  const carSVG = (name) => {
    const c = colorOf(name), n = name.toLowerCase();
    const wheel = (x, r) => `<circle cx="${x}" cy="47" r="${r}" fill="#1b1b1e"/><circle cx="${x}" cy="47" r="${r * 0.42}" fill="#c9ccd4"/>`;
    let body, glass, wr = 9, wx = [34, 90];
    if (/(f-150|silverado|hummer|cybertruck|r1t|gladiator)/.test(n)) {
      body = 'M8 44 L8 31 L44 31 L52 21 L74 21 L80 31 L114 31 L114 44 Z'; glass = 'M50 24 L72 24 L76 31 L50 31 Z';
    } else if (/(911|ferrari|lamborghini|mclaren|corvette|z06|supra|nsx|mx-5|gr86|brz|huracán|revuelto|chiron|mistral|jesko|gemera|regera|utopia|vantage|db12|dbs|artura|750s|emira|evija|amg gt|mc20|a110|spano|carmen|gt)/.test(n)) {
      body = 'M6 46 Q9 39 26 37 L50 26 Q62 22 86 26 L106 36 Q113 39 114 46 Z'; glass = 'M52 29 L80 28 L92 36 L54 36 Z'; wr = 8; wx = [32, 92];
    } else if (/(suv|range|defender|discovery|q7|q5|q3|x5|x3|gle|glc|cayenne|macan|urus|bentayga|cullinan|rav4|tucson|sportage|sorento|santa fe|escalade|tiguan|touareg|land cruiser|xc90|xc60|forester|outback|3008|5008|aircross|captur|arkana|austral|grand cherokee|wrangler|bronco|explorer|el7|tang|kodiak|ex90|gv80|gv70|ariya|id\.4)/.test(n)) {
      body = 'M9 45 Q10 29 24 27 L40 15 Q48 12 80 13 L98 24 Q110 27 113 34 L113 45 Z'; glass = 'M43 18 L60 15 L60 25 L43 25 Z M64 15 L79 16 L90 25 L64 25 Z'; wr = 10;
    } else {
      body = 'M9 44 Q11 31 28 29 L44 18 Q52 14 74 15 L92 25 Q106 27 113 34 L113 44 Z'; glass = 'M46 21 L68 17 L86 25 L46 25 Z';
    }
    return `<svg viewBox="0 0 122 58" class="veh"><ellipse cx="61" cy="53" rx="50" ry="4" fill="rgba(0,0,0,.10)"/><path d="${body}" fill="${c.m}"/><path d="${glass}" fill="${c.g}"/><rect x="8" y="42" width="106" height="5" rx="2.5" fill="${c.d}"/>${wheel(wx[0], wr)}${wheel(wx[1], wr)}</svg>`;
  };
  const bikeSVG = (name) => {
    const c = colorOf(name), n = name.toLowerCase();
    const mtb = /(vtt|stumpjumper|trance|scalpel|spectral|fourstroke|spark|genius|foxy|oiz|rise|big\.nine|marlin|fuel ex|troy|altitude|element|jam|stereo|backroad|revolt|topstone|gravel|jari|aspero|áspero|croix de fer)/.test(n);
    const ebike = /(électrique|electrique| e-|turbo levo|stromer|vanmoof|gazelle|sparta|overvolt|samedi|lundi|gain|d-burst)/.test(n);
    const t = mtb ? 5 : 3;
    const wheel = (x) => `<circle cx="${x}" cy="42" r="15" fill="none" stroke="#1b1b1e" stroke-width="${t}"/><circle cx="${x}" cy="42" r="15" fill="none" stroke="${c.m}" stroke-width="1"/>`;
    const bat = ebike ? `<rect x="52" y="30" width="15" height="6" rx="2" fill="${c.d}"/>` : '';
    return `<svg viewBox="0 0 120 58" class="veh"><ellipse cx="60" cy="52" rx="46" ry="3.5" fill="rgba(0,0,0,.08)"/>${wheel(30)}${wheel(90)}<path d="M30 42 L58 42 L48 22 L74 22 L90 42 M58 42 L74 22 M30 42 L48 22 M74 22 L80 18" fill="none" stroke="${c.m}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${bat}<rect x="42" y="20" width="12" height="3" rx="1.5" fill="${c.d}"/></svg>`;
  };
  const boatSVG = (name) => {
    const c = colorOf(name), n = name.toLowerCase();
    const sail = /(oceanis|sun odyssey|first |hanse|bavaria c|dufour|contest|lagoon|fountaine|voilier|catamaran)/.test(n) && !/trawler/.test(n);
    const water = '<path d="M4 50 q10 4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#7fb0e6" stroke-width="2" opacity=".7"/>';
    const hull = `<path d="M12 40 L108 40 L98 50 L22 50 Z" fill="${c.m}"/><path d="M12 40 L108 40 L105 44 L15 44 Z" fill="${c.d}"/>`;
    const top = sail
      ? `<rect x="58" y="8" width="3" height="32" fill="${c.d}"/><path d="M62 12 L62 38 L88 38 Z" fill="${c.m}"/><path d="M56 15 L56 38 L36 38 Z" fill="${c.g}"/>`
      : `<path d="M30 40 L36 28 L74 28 L82 40 Z" fill="${c.m}"/><rect x="42" y="30" width="26" height="7" fill="${c.g}"/><rect x="52" y="18" width="4" height="10" fill="${c.d}"/>`;
    return `<svg viewBox="0 0 120 58" class="veh">${water}${top}${hull}</svg>`;
  };
  const planeSVG = (name) => {
    const c = colorOf(name), n = name.toLowerCase();
    const airliner = /(boeing|airbus|a220|a320|737|787|e195|bae 146|dash 8|acj)/.test(n);
    const jet = /(falcon|gulfstream|citation|global|challenger|phenom|praetor|vision jet|pc-24|hawker|bbj|longitude)/.test(n);
    const prop = !airliner && !jet;
    const windows = `<g fill="${c.g}">` + Array.from({ length: airliner ? 10 : 5 }, (_, i) => `<circle cx="${30 + i * 7}" cy="32" r="1.8"/>`).join('') + '</g>';
    const propeller = prop ? '<line x1="108" y1="20" x2="108" y2="44" stroke="#444" stroke-width="2.5"/><circle cx="108" cy="32" r="2.5" fill="#333"/>' : '';
    const engines = jet ? '<ellipse cx="40" cy="40" rx="6" ry="3" fill="#333"/>' : '';
    return `<svg viewBox="0 0 120 58" class="veh"><ellipse cx="60" cy="52" rx="44" ry="3.5" fill="rgba(0,0,0,.08)"/><path d="M50 34 L38 48 L62 38 Z" fill="${c.d}"/><rect x="14" y="26" width="92" height="12" rx="6" fill="${c.m}"/><path d="M106 26 q10 6 0 12 Z" fill="${c.m}"/><path d="M16 26 L6 12 L20 26 Z" fill="${c.d}"/><path d="M100 27 q6 1 8 4 l-8 0 Z" fill="${c.g}"/>${windows}${engines}${propeller}</svg>`;
  };
  const vehicleSVG = (cat, name) => {
    if (cat === 'voiture') return carSVG(name);
    if (cat === 'velo') return bikeSVG(name);
    if (cat === 'bateau') return boatSVG(name);
    if (cat === 'avion') return planeSVG(name);
    return '';
  };

  const openShop = (cat) => {
    currentCat = cat;
    currentCountry = (Bank.company && Bank.company.country) || '—';
    searchQuery = ''; sortMode = 'feat';
    Sound.play('launch');

    const store = { velo: 'RoyalCycles', voiture: 'RoyalMotors', bateau: 'RoyalMarine', avion: 'RoyalAvia' }[cat];
    $('#shopLogo').textContent = `${CAT[cat].ico} ${store}`;
    $('#shopSearch').value = '';
    $('#shopSort').value = 'feat';
    $('#shopUrl').textContent = `www.${store.toLowerCase()}.market`;
    $('#shopCountry').value = currentCountry;
    $('#shopCountrySuggest').hidden = true;

    computeRoute();
    reloadItems();
    render();
    $('.site', shop).scrollTop = 0;
    shop.classList.remove('hidden');
  };

  // Délai de livraison local (domestique) selon la catégorie.
  const DOMESTIC_DELAY = { velo: 4000, voiture: 6000, bateau: 9000, avion: 12000 };
  const keyOf = (cat, name) => cat + '|' + name;
  const garageQty = (cat, name) => (Bank.inventory[keyOf(cat, name)] || {}).qty || 0;
  const inTransit = (cat, name) => (Bank.shipments || []).filter((s) => s.type === 'import' && s.cat === cat && s.name === name).reduce((a, s) => a + s.qty, 0);

  const render = () => {
    $('#shopCart').textContent = Object.values(Bank.inventory).reduce((a, v) => a + ((v && v.qty) || 0), 0);
    const meta = CAT[currentCat];
    const me = (Bank.company && Bank.company.country) || '—';
    $('#shopTitle').textContent = `${meta.name} — ${currentCountry}`;
    $('#shopSub').textContent = currentCountry === me
      ? `Constructeurs locaux (${currentCountry})`
      : `Import depuis ${currentCountry} — livraison selon la distance`;
    if (!currentItems) {
      $('#shopCount').textContent = '';
      grid.innerHTML = `<div class="shop-empty">🚫 ${currentCountry} ne fabrique pas de ${meta.name.toLowerCase()}.<br>Choisissez un autre pays dans « Acheter en : ».</div>`;
      return;
    }
    let list = currentItems.filter(([n]) => n.toLowerCase().includes(searchQuery));
    if (sortMode === 'asc') list.sort((a, b) => a[1] - b[1]);
    else if (sortMode === 'desc') list.sort((a, b) => b[1] - a[1]);
    else if (sortMode === 'az') list.sort((a, b) => a[0].localeCompare(b[0], 'fr'));

    $('#shopCount').textContent = `${list.length} modèle${list.length > 1 ? 's' : ''} disponible${list.length > 1 ? 's' : ''}`;

    if (!list.length) { grid.innerHTML = `<div class="shop-empty">Aucun modèle ne correspond à « ${searchQuery} ».</div>`; return; }

    grid.innerHTML = list.map(([name, price]) => {
      const g = garageQty(currentCat, name), t = inTransit(currentCat, name);
      const transport = shipForBuy(price);
      const total = price + transport;
      const afford = Bank.balance >= total;              // il faut pouvoir payer prix + transport
      const r = ratingOf(name);
      const status = t ? `<div class="shop-status transit">🚚 ${t} en livraison</div>`
        : (g ? `<div class="shop-status">🚗 ${g} au garage</div>` : '<div class="shop-status">&nbsp;</div>');
      return `<article class="shop-item${g ? ' is-owned' : ''}">
        <div class="shop-img">${vehicleSVG(currentCat, name)}${g ? `<span class="owned-tag">×${g}</span>` : ''}</div>
        <div class="shop-rating">${stars(r)}</div>
        <div class="shop-name">${name}</div>
        <div class="shop-price">${fmt(price)}<span class="cur"> €</span></div>
        <div class="shop-ship">+ transport ${fmt(transport)} € · total <b>${fmt(total)} €</b></div>
        ${status}
        <button class="shop-buy${afford ? '' : ' broke'}" data-buy="1" data-name="${escAttr(name)}" data-price="${price}" ${afford ? '' : 'disabled'}>
          ${afford ? `🛒 Acheter — ${fmt(total)} €` : 'Solde insuffisant'}
        </button>
      </article>`;
    }).join('');
  };

  // Achat immédiat, une unité PAR CLIC (cliquer 4 fois = acheter 4 fois),
  // sans confirmation pour permettre l'achat rapide en quantité.
  const buy = (name, price) => {
    const transport = shipForBuy(price);
    const total = price + transport;
    if (Bank.balance < total) { Sound.play('lose'); UI.toast(`Solde insuffisant (${fmt(total)} € avec transport).`, 'lose'); return; }
    if (!Bank.debit(total)) { UI.toast('Achat impossible.', 'lose'); return; }
    const k = keyOf(currentCat, name);
    if (Bank.inventory[k]) Bank.inventory[k].qty += 1;
    else Bank.inventory[k] = { cat: currentCat, name, price, qty: 1 };
    Bank.logTx(-total, `Achat ${name}`);
    Bank.persist();
    Sound.play('chip');
    UI.toast(`✅ ${name} acheté · ${Bank.inventory[k].qty} au garage`, 'win');
    render();
  };

  const close = () => { Sound.play('click'); shop.classList.add('hidden'); };
  const onEnter = () => { UI.renderConcession(); };
  const isShopOpen = () => shop && !shop.classList.contains('hidden');
  const refreshShop = () => { if (isShopOpen()) render(); };

  return {
    init, select, onEnter, unlockLevel, isUnlocked, isShopOpen, refreshShop,
    catMeta: CAT,
    models: (cat, country) => (CATALOG[cat] && CATALOG[cat][country]) ? CATALOG[cat][country] : null,
    sourceCountries: (cat) => (CATALOG[cat] ? Object.keys(CATALOG[cat]) : []),
    svg: (cat, name) => vehicleSVG(cat, name),
  };
})();

/* ======================================================================
   11 ter. IMPORT / EXPORT — négoce international
   ====================================================================== */
const ImportExport = (() => {
  // Catégories de véhicules (mêmes que la Concession).
  const CATS = [
    ['velo', 'Vélos', '🚲'], ['voiture', 'Voitures', '🚗'],
    ['bateau', 'Bateaux', '⛵'], ['avion', 'Avions', '✈️'],
  ];
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const TAX = 0.05;  // droits de douane à l'export (réduits)
  // ── Demande ALÉATOIRE par pays × véhicule, qui change toutes les 5 min ────
  // Stable pendant 5 min (fini le prix qui bouge à chaque clic) puis re-tirée.
  const EPOCH_MS = 5 * 60 * 1000;
  const demandEpoch = () => Math.floor(Date.now() / EPOCH_MS);
  // 0,70 – 1,65 : certains véhicules sont bien plus demandés dans certains pays.
  const demandFactor = (country, name) => 0.70 + (hash(country + '»' + name + '#' + demandEpoch()) % 96) / 100;
  // Niveau de demande lisible (pour l'affichage) : 1 (faible) … 5 (brûlante).
  const demandLevel = (country, name) => {
    const f = demandFactor(country, name);
    return f >= 1.45 ? 5 : f >= 1.25 ? 4 : f >= 1.05 ? 3 : f >= 0.88 ? 2 : 1;
  };
  // Temps restant (ms) avant le prochain tirage de la demande.
  const demandResetIn = () => EPOCH_MS - (Date.now() % EPOCH_MS);
  // Prix de vente unitaire brut (avant douane), piloté par la demande du moment.
  const grossUnit = (country, name, base) => Math.round(base * demandFactor(country, name));
  // Prix net encaissé (après douane).
  const netUnit = (country, name, base) => Math.round(grossUnit(country, name, base) * (1 - TAX));

  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const haversine = (a, b) => {
    const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(s)));
  };

  let CENTROID = {}, ALL = [];
  let els = {}, mode = 'export', cat = 'voiture', partner = '', dist = 0, delayMs = 0, shipBase = 0, duoDeal = false, lastEpoch = -1;
  // Bonus de vente partagé débloqué par les paliers du coffre du duo.
  const duoMult = () => 1 + ((Multiplayer && Multiplayer.saleBonus) ? Multiplayer.saleBonus() : 0);
  // Vente nette : douane 0 % + bonus quand on commerce avec le partenaire de duo.
  const saleNet = (name, base) => Math.round((duoDeal ? grossUnit(partner, name, base) * 1.15 : netUnit(partner, name, base)) * duoMult());
  // Transport d'UN véhicule : part fixe distance + 0,6 % de la valeur (réduit).
  const shipFor = (price) => shipBase + Math.round(price * 0.006);

  const init = () => {
    const geo = window.WORLD_GEO || { countries: [], extra: [] };
    (geo.countries || []).forEach((c) => CENTROID[c.n] = c.c);
    (geo.extra || []).forEach((e) => CENTROID[e.n] = [e.lon, e.lat]);
    ALL = Object.keys(CENTROID).sort((a, b) => a.localeCompare(b, 'fr'));

    els = {
      origin: $('#ieOrigin'), search: $('#iePartnerSearch'), suggest: $('#iePartnerSuggest'),
      route: $('#ieRoute'), cats: $('#ieCats'), goods: $('#ieGoods'),
      warehouse: $('#ieWarehouse'), shipments: $('#ieShipments'), tabs: $$('.ie-tab'),
      markets: $('#ieMarkets'), marketsSub: $('#ieMarketsSub'), demandTimer: $('#ieDemandTimer'),
    };
    els.search.addEventListener('input', () => suggestPartners(els.search.value.trim().toLowerCase()));
    els.tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tab)));
    if (els.markets) els.markets.addEventListener('click', (e) => {
      const row = e.target.closest('[data-c]'); if (row) selectPartner(row.dataset.c);
    });
    els.cats.innerHTML = CATS.map(([id, name, ico], i) =>
      `<button class="ie-cat${i === 1 ? ' active' : ''}" data-cat="${id}">${ico} ${name}</button>`).join('');
    els.cats.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) setCat(b.dataset.cat); });
    els.goods.addEventListener('click', onGoodsClick);

    setInterval(tick, 1000);
  };

  const originCountry = () => (Bank.company && Bank.company.country) || null;

  const suggestPartners = (q) => {
    const box = els.suggest;
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const matches = matchCountries(q, ALL, 12);
    if (!matches.length) { box.innerHTML = '<div class="ob-sg-empty">Aucun pays</div>'; box.hidden = false; return; }
    box.innerHTML = matches.map((n) => `<button class="ob-sg" data-c="${n.replace(/"/g, '&quot;')}">${n}</button>`).join('');
    box.hidden = false;
    box.querySelectorAll('.ob-sg').forEach((b) => b.addEventListener('click', () => selectPartner(b.dataset.c)));
  };

  const selectPartner = (name) => {
    partner = name;
    els.search.value = name; els.suggest.hidden = true;
    const meC = CENTROID[originCountry()], pC = CENTROID[name];
    if (meC && pC) {
      dist = haversine(meC, pC);
      delayMs = clamp(6000 + dist * 3, 6000, 80000);
      shipBase = 40 + Math.round(dist * 0.025);    // part fixe du transport (distance, réduite)
      // Bonus DUO : commerce entre les 2 pays du duo → transport et délais fortement réduits.
      duoDeal = Multiplayer.active && name === Multiplayer.partnerCountry;
      if (duoDeal) { delayMs = Math.round(delayMs * 0.4); shipBase = Math.round(shipBase * 0.4); }
      const days = Math.max(1, Math.round(dist / 800));
      els.route.hidden = false;
      els.route.innerHTML = `<span>📍 ${dist.toLocaleString('fr-FR')} km</span>`
        + `<span>⏱️ ~${Math.round(delayMs / 1000)} s (≈ ${days} j)</span>`
        + `<span>🚚 transport dès ${fmt(shipBase)} €</span>`
        + `<span>🏛️ douane ${duoDeal ? '0' : '5'} %</span>`
        + (duoDeal ? `<span class="ie-duo">🤝 partenaire duo — commerce réduit</span>` : '');
    }
    Sound.play('select');
    renderGoods(); renderMarkets();
  };

  const setMode = (m) => {
    mode = m; Sound.play('click');
    els.tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === m));
    renderGoods();
  };
  const setCat = (c) => {
    cat = c; Sound.play('click');
    $$('.ie-cat', els.cats).forEach((b) => b.classList.toggle('active', b.dataset.cat === c));
    renderGoods(); renderMarkets();
  };

  // Clé unique d'un véhicule en stock.
  const keyOf = (cat, name) => cat + '|' + name;

  const renderGoods = () => {
    if (!partner) { els.goods.innerHTML = '<p class="ie-hint">Choisissez d\'abord un pays partenaire ci-dessus.</p>'; return; }
    const meta = Concession.catMeta[cat];
    if (mode === 'import') {
      const list = Concession.models(cat, partner);
      if (!list) { els.goods.innerHTML = `<p class="ie-hint">${partner} ne fabrique pas de ${meta.name.toLowerCase()}. Choisissez un autre pays ou une autre catégorie.</p>`; return; }
      els.goods.innerHTML = list.map(([name, price]) => `<div class="ie-good">
        <span class="ie-g-img">${Concession.svg(cat, name)}</span>
        <span class="ie-g-name">${name} <small>· ${partner}</small></span>
        <span class="ie-g-price">${fmt(price)} €</span>
        <span class="ie-g-qty"><input type="number" min="1" max="20" value="1" class="ie-qty" data-k="${keyOf(cat, name).replace(/"/g, '&quot;')}"></span>
        <button class="ie-g-btn" data-act="buy" data-name="${name.replace(/"/g, '&quot;')}" data-price="${price}">📥 Importer</button>
      </div>`).join('');
    } else {
      const inv = Bank.inventory;
      const owned = Object.values(inv).filter((v) => v && v.cat === cat && v.qty > 0);
      if (!owned.length) { els.goods.innerHTML = `<p class="ie-hint">Aucun ${meta.name.toLowerCase().replace(/s$/, '')} en stock. Importez-en d'abord (onglet Importer).</p>`; return; }
      els.goods.innerHTML = owned.map((v) => {
        const net = saleNet(v.name, v.price);                   // encaissé après douane (bonus duo éventuel)
        const profit = net - v.price - shipFor(v.price);        // net − prix payé − transport
        const win = profit >= 0;
        const lvl = demandLevel(partner, v.name);
        const flames = '🔥'.repeat(Math.max(0, lvl - 3));
        const badge = lvl >= 4 ? ` <b class="ie-hot">${flames} forte demande</b>` : (lvl <= 1 ? ' <b class="ie-cold">faible demande</b>' : '');
        return `<div class="ie-good">
          <span class="ie-g-img">${Concession.svg(v.cat, v.name)}</span>
          <span class="ie-g-name">${v.name}${badge} <small>· stock : ${v.qty} · payé ${fmt(v.price)} €</small></span>
          <span class="ie-g-price">${fmt(net)} €<small class="${win ? 'ie-profit' : 'ie-loss'}"> (${win ? '+' : ''}${fmt(profit)})</small></span>
          <span class="ie-g-qty"><input type="number" min="1" max="${v.qty}" value="1" class="ie-qty" data-k="${keyOf(v.cat, v.name).replace(/"/g, '&quot;')}"></span>
          <button class="ie-g-btn sell" data-act="sell" data-name="${v.name.replace(/"/g, '&quot;')}">📤 Exporter</button>
        </div>`;
      }).join('');
    }
  };

  // Net encaissé pour un pays quelconque (utilisé par le tableau des marchés).
  const netForCountry = (country, name, base) =>
    (Multiplayer.active && country === Multiplayer.partnerCountry)
      ? Math.round(grossUnit(country, name, base) * 1.15 * duoMult())   // bonus duo (douane 0 %) + paliers
      : Math.round(grossUnit(country, name, base) * (1 - TAX) * duoMult());

  // Tableau défilable : TOUS les pays + le bénéfice qu'ils rapportent,
  // pour les véhicules de la catégorie choisie (cliquer un pays le sélectionne).
  const renderMarkets = () => {
    if (!els.markets) return;
    const me = originCountry(); const meC = CENTROID[me];
    const meta = Concession.catMeta[cat];
    if (els.marketsSub) els.marketsSub.textContent = meta ? '· ' + meta.name : '';
    if (!meC) { els.markets.innerHTML = '<p class="ie-hint">Créez d\'abord votre entreprise.</p>'; return; }
    const owned = Object.values(Bank.inventory).filter((v) => v && v.cat === cat && v.qty > 0);
    if (!owned.length) {
      els.markets.innerHTML = `<p class="ie-hint">Aucun ${meta ? meta.name.toLowerCase() : 'véhicule'} en stock — achetez-en à la Concession pour voir les meilleurs marchés.</p>`;
      return;
    }
    const rows = [];
    for (const country of ALL) {
      if (country === me) continue;
      const pc = CENTROID[country]; if (!pc) continue;
      const d = haversine(meC, pc);
      let best = null;
      for (const v of owned) {
        const net = netForCountry(country, v.name, v.price);
        const profit = net - v.price - shipCostFor(d, v.price);
        if (!best || profit > best.profit) best = { profit, name: v.name, lvl: demandLevel(country, v.name) };
      }
      rows.push({ country, profit: best.profit, name: best.name, lvl: best.lvl });
    }
    rows.sort((a, b) => b.profit - a.profit);
    els.markets.innerHTML = rows.map((r) => {
      const win = r.profit >= 0;
      const flames = '🔥'.repeat(Math.max(0, r.lvl - 3));   // niveau 4 → 1 flamme, 5 → 2
      const sel = r.country === partner ? ' sel' : '';
      return `<button class="ie-mkt-row${win ? '' : ' loss'}${sel}" data-c="${r.country.replace(/"/g, '&quot;')}">
        <span class="ie-mkt-country">${r.country}${flames ? ' <span class="ie-mkt-hot">' + flames + '</span>' : ''}</span>
        <span class="ie-mkt-veh">${r.name}</span>
        <span class="ie-mkt-profit ${win ? 'ie-profit' : 'ie-loss'}">${win ? '+' : ''}${fmt(r.profit)} €</span>
      </button>`;
    }).join('');
  };

  const updateDemandTimer = () => {
    if (!els.demandTimer) return;
    const s = Math.ceil(demandResetIn() / 1000);
    const m = Math.floor(s / 60), ss = s % 60;
    els.demandTimer.textContent = `⏳ nouvelle demande dans ${m}:${String(ss).padStart(2, '0')}`;
  };

  const onGoodsClick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const name = b.dataset.name;
    const input = els.goods.querySelector(`.ie-qty[data-k="${keyOf(cat, name).replace(/"/g, '&quot;')}"]`);
    const qty = Math.floor(Number(input && input.value) || 0);
    if (qty <= 0) { UI.toast('Quantité invalide.', 'lose'); return; }
    if (b.dataset.act === 'buy') doImport(name, Number(b.dataset.price), qty);
    else doExport(name, qty);
  };

  const doImport = (name, price, qty) => {
    const total = (price + shipFor(price)) * qty;
    if (Bank.balance < total) { Sound.play('lose'); UI.toast(`Solde insuffisant (${fmt(total)} € requis).`, 'lose'); return; }
    Bank.debit(total);
    Bank.logTx(-total, `Import ${name}`);
    Bank.shipments.push({ id: Date.now() + Math.random(), type: 'import', cat, name, price, qty, partner, arriveAt: Date.now() + delayMs, value: 0 });
    Bank.persist();
    Sound.play('chip'); UI.coinRain(6);
    UI.toast(`📦 ${qty}× ${name} en route depuis ${partner} !`, 'win');
    renderShipments(); renderWarehouse();
  };

  const doExport = (name, qty) => {
    const k = keyOf(cat, name);
    const item = Bank.inventory[k];
    if (!item || item.qty < qty) { UI.toast('Stock insuffisant.', 'lose'); return; }
    const net = saleNet(name, item.price);            // encaissé (bonus duo éventuel)
    const revenue = net * qty;
    const shipping = shipFor(item.price) * qty;
    const profit = revenue - item.price * qty - shipping;
    if (Bank.balance < shipping) { Sound.play('lose'); UI.toast(`Frais d'expédition ${fmt(shipping)} € — solde insuffisant.`, 'lose'); return; }
    // Prévient si l'opération est perdante.
    const go = profit >= 0
      ? Promise.resolve(true)
      : UI.confirm(`⚠️ Cette vente est PERDANTE : environ ${fmt(profit)} € après douane et transport. Exporter quand même vers ${partner} ?`);
    go.then((ok) => {
      if (!ok) return;
      Bank.debit(shipping);
      item.qty -= qty; if (item.qty <= 0) delete Bank.inventory[k];
      Bank.shipments.push({ id: Date.now() + Math.random(), type: 'export', cat, name, qty, partner, arriveAt: Date.now() + delayMs, value: revenue });
      Bank.persist();
      Sound.play('chip');
      UI.toast(`🚢 ${qty}× ${name} → ${partner} — paiement à l'arrivée.`, profit >= 0 ? 'win' : 'lose');
      renderShipments(); renderWarehouse(); renderGoods(); renderMarkets();
    });
  };

  const tick = () => {
    // Minuteur de demande + re-tirage toutes les 5 min (marchés & prix rafraîchis).
    updateDemandTimer();
    const ep = demandEpoch();
    if (lastEpoch === -1) lastEpoch = ep;
    else if (ep !== lastEpoch) {
      lastEpoch = ep;
      if (Nav.current === 'importexport') {
        if (partner) renderGoods();
        renderMarkets();
        UI.toast('🔄 La demande mondiale a changé — nouveaux marchés !', 'win');
      }
    }
    const ships = Bank.shipments;
    if (!ships || !ships.length) return;
    const now = Date.now();
    let changed = false;
    for (let i = ships.length - 1; i >= 0; i--) {
      if (now >= ships[i].arriveAt) {
        const s = ships[i];
        if (s.type === 'import') {
          const k = keyOf(s.cat, s.name);
          if (Bank.inventory[k]) Bank.inventory[k].qty += s.qty;
          else Bank.inventory[k] = { cat: s.cat, name: s.name, price: s.price, qty: s.qty };
          UI.toast(`✅ Livraison reçue : ${s.qty}× ${s.name} (${s.partner}).`, 'win');
          Sound.play('win');
        } else {
          Bank.credit(s.value);
          Bank.logTx(s.value, `Export ${s.name}`);
          // Une vente terminée est la SEULE source d'XP (proportionnelle à la valeur).
          const xp = clamp(20 + Math.round(s.value / 800), 20, 250);
          Bank.addXp(xp);
          UI.toast(`💰 Vente encaissée : +${fmt(s.value)} € · +${xp} XP (${s.name} → ${s.partner}).`, 'win');
          Sound.play('win'); UI.coinRain(12);
        }
        ships.splice(i, 1); changed = true;
      }
    }
    if (changed) {
      Bank.persist(); renderWarehouse(); renderGoods(); renderMarkets();
      if (Concession.isShopOpen && Concession.isShopOpen()) Concession.refreshShop();
    }
    renderShipments();
  };

  const renderWarehouse = () => {
    if (!els.warehouse) return;
    const owned = Object.values(Bank.inventory).filter((v) => v && v.qty > 0);
    els.warehouse.innerHTML = owned.length
      ? owned.map((v) => `<span class="ie-stock">${Concession.catMeta[v.cat] ? Concession.catMeta[v.cat].ico : '📦'} ${v.name} <b>×${v.qty}</b></span>`).join('')
      : '<p class="ie-hint">Garage vide.</p>';
  };

  const renderShipments = () => {
    if (!els.shipments) return;
    const ships = Bank.shipments || [];
    if (!ships.length) { els.shipments.innerHTML = '<p class="ie-hint">Aucune expédition en cours.</p>'; return; }
    const now = Date.now();
    els.shipments.innerHTML = ships.slice().sort((a, b) => a.arriveAt - b.arriveAt).map((s) => {
      const left = Math.max(0, s.arriveAt - now);
      const totalDur = delayMsFor(s);
      const pct = clamp(100 - Math.round((left / totalDur) * 100), 0, 100);
      const secs = Math.ceil(left / 1000);
      const ico = Concession.catMeta[s.cat] ? Concession.catMeta[s.cat].ico : '📦';
      const dir = s.type === 'import' ? `📥 ${s.partner} → vous` : `📤 vous → ${s.partner}`;
      const tag = s.type === 'export' ? ` · +${fmt(s.value)} €` : '';
      return `<div class="ie-ship">
        <div class="ie-ship-top"><span>${ico} ${s.qty}× ${s.name}</span><span class="ie-ship-eta">${secs} s${tag}</span></div>
        <div class="ie-ship-route">${dir}</div>
        <div class="ie-ship-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
  };
  const delayMsFor = (s) => {
    const meC = CENTROID[originCountry()], pC = CENTROID[s.partner];
    if (meC && pC) return clamp(6000 + haversine(meC, pC) * 3, 6000, 80000);
    return 20000;
  };

  const onEnter = () => {
    const me = originCountry();
    els.origin.textContent = me ? `Depuis : ${me} (votre entreprise)` : 'Depuis : —';
    renderWarehouse(); renderShipments(); renderMarkets(); updateDemandTimer();
    if (partner) renderGoods(); else els.goods.innerHTML = '<p class="ie-hint">Choisissez un pays partenaire ci-dessus, ou cliquez un pays dans le tableau des bénéfices ci-dessous.</p>';
  };

  // Coût de transport pour une distance donnée (utilisé par l'automatisation).
  const shipCostFor = (d, price) => 40 + Math.round(d * 0.025) + Math.round(price * 0.006);
  /** Négoce automatique exécuté par les employés (avec leurs bonus `mods`). */
  const autoTrade = (mods = {}) => {
    const me = originCountry(); const meC = CENTROID[me]; if (!meC) return null;
    const buyDiscount = mods.buyDiscount || 0, saleBonus = mods.saleBonus || 0;
    const tax = (mods.tax != null) ? mods.tax : TAX;
    const shipMult = mods.shipMult != null ? mods.shipMult : 1;
    const delayMult = mods.delayMult != null ? mods.delayMult : 1;
    const cats = ['velo', 'voiture', 'bateau', 'avion'];
    for (let attempt = 0; attempt < 8; attempt++) {
      const c = cats[Math.floor(Math.random() * cats.length)];
      const sources = Concession.sourceCountries(c);
      if (!sources.length) continue;
      const source = sources[Math.floor(Math.random() * sources.length)];
      const models = Concession.models(c, source);
      if (!models || !models.length) continue;
      const [name, rawPrice] = models[Math.floor(Math.random() * models.length)];
      const buyPrice = Math.round(rawPrice * (1 - buyDiscount));                 // remise de l'acheteur
      const buyShip = Math.round(shipCostFor(haversine(meC, CENTROID[source] || meC), rawPrice) * shipMult);
      let best = null;
      for (const country of ALL) {
        const pc = CENTROID[country]; if (!pc) continue;
        const d = haversine(meC, pc);
        const saleNet = Math.round(grossUnit(country, name, rawPrice) * (1 - tax) * (1 + saleBonus));
        const sellShip = Math.round(shipCostFor(d, rawPrice) * shipMult);
        const profit = saleNet - buyPrice - buyShip - sellShip;
        if (!best || profit > best.profit) best = { country, saleNet, profit, dist: d, sellShip };
      }
      if (best && best.profit > 0) {
        const total = buyPrice + buyShip + best.sellShip;
        if (total > Bank.balance) continue;              // on n'achète que ce qu'on peut payer
        Bank.debit(total);                               // 💸 l'argent est PRIS à l'achat
        Bank.logTx(-total, `Auto-achat ${name}`);
        const delay = clamp((6000 + best.dist * 3) * delayMult, 4000, 80000);
        Bank.shipments.push({ id: Date.now() + Math.random(), type: 'export', cat: c, name, qty: 1, partner: best.country, arriveAt: Date.now() + delay, value: best.saleNet });
        Bank.persist();
        return { name, cost: total, market: best.country, saleNet: best.saleNet };
      }
    }
    return null;
  };

  return { init, onEnter, autoTrade };
})();

/* ======================================================================
   11 quinquies. IMMOBILIER — Agence immobilière & Vente / Location
   ====================================================================== */
const AgenceImmo = (() => {
  const DATA = {
    maisons: { ico: '🏡', name: 'Maisons', blurb: 'Villas de bord de mer, chalets d\'altitude et hôtels particuliers d\'exception.', lines: ['Villa Riviera', 'Chalet Alpin', 'Manoir Royal', 'Penthouse Skyline'] },
    immeubles: { ico: '🏢', name: 'Immeubles', blurb: 'Immeubles de rapport et tours de bureaux : la pierre qui travaille pour vous.', lines: ['Résidence Or', 'Tour Affaires', 'Loft District', 'Complexe Prestige'] },
    monuments: { ico: '🏛️', name: 'Monuments & Luxe', blurb: 'Châteaux classés, palais et biens de collection réservés à une élite.', lines: ['Château Historique', 'Palais des Arts', 'Domaine Viticole', 'Île Privée'] },
  };
  let detail;
  const init = () => { detail = $('#agenceDetail'); };
  const select = (key) => {
    const v = DATA[key]; if (!v) return;
    Sound.play('select');
    detail.hidden = false;
    detail.innerHTML =
      `<div class="cd-head"><span class="cd-ico">${v.ico}</span><div><h3>${v.name}</h3><p>${v.blurb}</p></div></div>` +
      `<div class="cd-models">` + v.lines.map((m) => `<span class="cd-model">${m}</span>`).join('') + `</div>` +
      `<p class="cd-note">✦ Acquisition en préparation — bientôt disponible à l'achat avec vos crédits.</p>`;
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const onEnter = () => { if (detail) detail.hidden = true; };
  return { init, select, onEnter };
})();

const VenteLocation = (() => {
  const DATA = {
    vente: { ico: '💰', name: 'Vente', blurb: 'Revendez vos biens à la plus-value : le bon acheteur, au bon moment, au bon prix.', lines: ['Plus-value premium', 'Enchère privée', 'Acheteur international', 'Vente flash'] },
    location: { ico: '🔑', name: 'Location', blurb: 'Louez vos biens à des particuliers et encaissez des loyers réguliers.', lines: ['Bail longue durée', 'Location saisonnière', 'Locataire prestige', 'Rendement mensuel'] },
  };
  let detail;
  const init = () => { detail = $('#venteDetail'); };
  const select = (key) => {
    const v = DATA[key]; if (!v) return;
    Sound.play('select');
    detail.hidden = false;
    detail.innerHTML =
      `<div class="cd-head"><span class="cd-ico">${v.ico}</span><div><h3>${v.name}</h3><p>${v.blurb}</p></div></div>` +
      `<div class="cd-models">` + v.lines.map((m) => `<span class="cd-model">${m}</span>`).join('') + `</div>` +
      `<p class="cd-note">✦ Plateforme en préparation — bientôt disponible pour générer des revenus.</p>`;
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const onEnter = () => { if (detail) detail.hidden = true; };
  return { init, select, onEnter };
})();

/* ======================================================================
   11 quater. ONBOARDING — création d'entreprise + choix du pays (planisphère)
   ====================================================================== */
const Onboarding = (() => {
  // Projection équirectangulaire vers l'espace SVG 1000×500.
  const px = (lon) => (lon + 180) / 360 * 1000;
  const py = (lat) => (90 - lat) / 180 * 500;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  let ob, mapWrap, selectedName = '', companyName = '', context = 'company';
  let COUNTRIES = [], EXTRA = [], ALL = [], CENTROID = {};

  // Textes selon le contexte : première entreprise (casino) ou nouvelle agence (immobilier).
  const TEXT = {
    company: {
      crest: '♠', kicker: '✦ Bienvenue au Royal Night ✦',
      title: 'Fondez votre entreprise', lead: "Tout commence par un nom. Celui de l'empire que vous vous apprêtez à bâtir.",
      label: "Nom de l'entreprise", place: 'Ex. Royal Ventures & Cie',
      brief: '<p>💎 <b>Le casino est le cœur de votre activité.</b></p>'
        + '<p>Chaque partie — Machine, Blackjack, Poker, Dés — est une opportunité de <b>gagner des crédits</b> et de faire <b>grandir votre commerce</b>.</p>'
        + "<p>Au niveau 1, seule la <b>Machine à rouleaux</b> est ouverte. En montant de niveau, vous débloquez le Blackjack (niv. 20), le Poker (niv. 35) puis les Dés (niv. 50).</p>"
        + '<p class="ob-brief-note">À vous de transformer la chance en fortune. 🍀</p>',
    },
    agency: {
      crest: '🏛️', kicker: '✦ Nouvel emploi : Immobilier ✦',
      title: 'Fondez votre agence immobilière', lead: 'Un nouveau départ. Donnez un nom à votre agence et repartez de zéro.',
      label: "Nom de l'agence", place: 'Ex. Prestige Immobilier',
      brief: '<p>🏛️ <b>Le casino reste votre moteur.</b></p>'
        + '<p>Rejouez pour <b>gagner des crédits</b>, puis investissez dans la <b>pierre</b> : maisons, immeubles, monuments et biens de luxe.</p>'
        + '<p><b>Revendez</b> avec plus-value ou <b>louez</b> à des particuliers pour des revenus réguliers. Votre solde, votre niveau et vos jeux repartent à zéro : remontez au sommet !</p>'
        + '<p class="ob-brief-note">Bâtissez un nouvel empire. 🏙️</p>',
    },
  };

  const init = () => {
    ob = $('#onboarding');
    mapWrap = $('#obMapWrap');

    const geo = window.WORLD_GEO || { countries: [], extra: [] };
    COUNTRIES = geo.countries || [];
    EXTRA = geo.extra || [];
    COUNTRIES.forEach((c) => CENTROID[c.n] = c.c);           // [lon,lat]
    EXTRA.forEach((e) => CENTROID[e.n] = [e.lon, e.lat]);
    ALL = [...COUNTRIES.map((c) => c.n), ...EXTRA.map((e) => e.n)]
      .sort((a, b) => a.localeCompare(b, 'fr'));

    $('#obNext').addEventListener('click', () => {
      const v = $('#obName').value.trim();
      if (!v) { UI.toast('Donnez un nom à votre entreprise.', 'lose'); $('#obName').focus(); return; }
      companyName = v; $('#obNameEcho').textContent = v;
      Sound.play('select'); showStep(2);
    });
    $('#obName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#obNext').click(); });

    $('#obBack').addEventListener('click', () => { Sound.play('click'); showStep(1); });
    $('#obFinish').addEventListener('click', () => {
      if (!selectedName) return;
      $('#obStep3Company').textContent = companyName;
      $('#obStep3Country').textContent = selectedName;
      Sound.play('select'); showStep(3);
    });
    $('#obStart').addEventListener('click', finish);

    const search = $('#obSearch');
    search.addEventListener('input', () => renderSuggestions(search.value.trim().toLowerCase()));

    // Sélection d'un pays sur la carte (délégation)
    mapWrap.addEventListener('click', (e) => {
      const t = e.target.closest('[data-name]');
      if (t) selectCountry(t.getAttribute('data-name'));
    });

    buildMap();
  };

  const buildMap = () => {
    let s = '<svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">';
    s += '<defs>'
      + '<radialGradient id="obSea" cx="50%" cy="42%" r="80%"><stop offset="0%" stop-color="#123449"/><stop offset="100%" stop-color="#071018"/></radialGradient>'
      + '<linearGradient id="obLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a2f1c"/><stop offset="100%" stop-color="#241d10"/></linearGradient>'
      + '</defs>';
    s += '<rect x="0" y="0" width="1000" height="500" fill="url(#obSea)"/>';

    // Graticule (grille de l'atlas)
    let grat = '<g class="ob-grat">';
    for (let lon = -150; lon <= 150; lon += 30) grat += `<line x1="${px(lon)}" y1="0" x2="${px(lon)}" y2="500"/>`;
    for (let lat = -60; lat <= 60; lat += 30) grat += `<line x1="0" y1="${py(lat)}" x2="1000" y2="${py(lat)}"/>`;
    grat += `<line class="ob-equator" x1="0" y1="${py(0)}" x2="1000" y2="${py(0)}"/>`;
    grat += '</g>';
    s += grat;

    // Pays (tracés réels)
    let paths = '<g class="ob-lands">';
    COUNTRIES.forEach((c) => {
      let d = '';
      for (const ring of c.r) {
        d += 'M' + ring.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join('L') + 'Z';
      }
      paths += `<path d="${d}" class="ob-country" data-name="${esc(c.n)}"><title>${esc(c.n)}</title></path>`;
    });
    paths += '</g>';
    s += paths;

    // Micro-États (épingles)
    let pins = '<g class="ob-pins">';
    EXTRA.forEach((e) => {
      pins += `<circle cx="${px(e.lon).toFixed(1)}" cy="${py(e.lat).toFixed(1)}" r="4.5" class="ob-cpin" data-name="${esc(e.n)}"><title>${esc(e.n)}</title></circle>`;
    });
    pins += '</g>';
    s += pins;

    // Marqueur de sélection + cadre
    s += '<circle id="obMarker" r="7" class="ob-marker" cx="-50" cy="-50"/>';
    s += '<rect x="3" y="3" width="994" height="494" rx="8" class="ob-frame"/>';
    s += '</svg>';
    mapWrap.innerHTML = s;
  };

  const renderSuggestions = (q) => {
    const box = $('#obSuggest');
    if (!q) { box.innerHTML = ''; box.hidden = true; return; }
    const matches = ALL.filter((n) => n.toLowerCase().includes(q)).slice(0, 9);
    if (!matches.length) { box.innerHTML = '<div class="ob-sg-empty">Aucun pays trouvé</div>'; box.hidden = false; return; }
    box.innerHTML = matches.map((n) => `<button class="ob-sg" data-name="${esc(n)}">${n}</button>`).join('');
    box.hidden = false;
    box.querySelectorAll('.ob-sg').forEach((b) => b.addEventListener('click', () => {
      const n = b.getAttribute('data-name');
      selectCountry(n); box.hidden = true; $('#obSearch').value = n;
    }));
  };

  const selectCountry = (name) => {
    selectedName = name;
    Sound.play('chip');
    // Surligne le pays (tracé ou épingle)
    $$('.ob-country.sel, .ob-cpin.sel', mapWrap).forEach((el) => el.classList.remove('sel'));
    const el = mapWrap.querySelector(`[data-name="${cssEsc(name)}"]`);
    if (el) { el.classList.add('sel'); el.parentNode.appendChild(el); }
    // Marqueur doré sur le centroïde
    const cen = CENTROID[name];
    const marker = $('#obMarker', mapWrap);
    if (cen && marker) { marker.setAttribute('cx', px(cen[0]).toFixed(1)); marker.setAttribute('cy', py(cen[1]).toFixed(1)); marker.classList.add('on'); }
    $('#obCountry').textContent = name;
    $('#obFinish').disabled = false;
  };
  // Échappe les caractères spéciaux pour un sélecteur d'attribut.
  const cssEsc = (s) => s.replace(/["\\]/g, '\\$&');

  const showStep = (n) => {
    $$('.ob-step', ob).forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
    if (n === 1) setTimeout(() => $('#obName').focus(), 60);
  };

  const finish = async () => {
    // En duo en ligne : un pays ne peut être choisi que par un seul joueur.
    if (Multiplayer.active && context === 'company') {
      const ok = await Multiplayer.claimCountry(selectedName);
      if (!ok) { UI.toast(`🚫 ${selectedName} est déjà pris par votre partenaire — choisissez un autre pays.`, 'lose'); showStep(2); return; }
    }
    const org = { name: companyName, country: selectedName };
    if (context === 'agency') {
      Bank.startImmobilier(org);   // change d'emploi : reset + bascule mode
    } else {
      Bank.setCompany(org);
    }
    UI.renderCompany();
    ob.classList.add('done');
    setTimeout(() => { ob.classList.add('hidden'); if (context === 'agency') Nav.go('casino'); }, 600);
    Sound.play('win'); UI.coinRain(24);
    UI.toast(`Bienvenue, ${companyName} !`, 'win');
  };

  const start = (ctx = 'company') => {
    context = TEXT[ctx] ? ctx : 'company';
    const t = TEXT[context];
    $('#obCrest').textContent = t.crest;
    $('#obKicker').textContent = t.kicker;
    $('#obStep1Title').textContent = t.title;
    $('#obStep1Lead').textContent = t.lead;
    $('#obNameLabel').textContent = t.label;
    $('#obName').placeholder = t.place;
    $('#obBrief').innerHTML = t.brief;
    selectedName = ''; companyName = '';
    $('#obName').value = ''; $('#obSearch').value = '';
    $('#obCountry').textContent = '—'; $('#obFinish').disabled = true;
    const sg = $('#obSuggest'); if (sg) { sg.hidden = true; sg.innerHTML = ''; }
    $$('.ob-country.sel, .ob-cpin.sel', mapWrap).forEach((el) => el.classList.remove('sel'));
    const marker = $('#obMarker', mapWrap); if (marker) marker.classList.remove('on');
    ob.classList.remove('hidden', 'done');
    showStep(1);
  };

  return { init, start };
})();

/* ======================================================================
   11 sexies. I18N — bascule FR / EN sur l'interface principale
   ====================================================================== */
const I18n = (() => {
  const KEY = 'rnc_lang';
  const DICT = {
    fr: {
      'nav.accueil': 'Accueil', 'nav.casino': 'Casino', 'nav.concession': 'Concession',
      'nav.importexport': 'Import / Export', 'nav.agence': 'Agence', 'nav.ventelocation': 'Vente & loc.',
      'nav.profil': 'Profil',
      'home.tag': '✦ Établissement privé ✦', 'home.sub': "Entrez dans l'univers du jeu.",
      'home.enter': 'ENTRER AU CASINO', 'home.note': 'Monnaie virtuelle fictive — aucun argent réel, aucun gain retirable.',
      'casino.title': 'Casino Royal', 'casino.sub': 'Choisissez votre table',
      'settings.title': 'Paramètres', 'settings.lang': 'Langue', 'settings.audio': 'Audio',
      'settings.music': 'Musique', 'settings.sfx': 'Effets sonores', 'settings.saves': 'Sauvegardes (emplois)',
      'mode.commerce': 'Commerce', 'mode.immobilier': 'Immobilier',
    },
    en: {
      'nav.accueil': 'Home', 'nav.casino': 'Casino', 'nav.concession': 'Dealership',
      'nav.importexport': 'Import / Export', 'nav.agence': 'Agency', 'nav.ventelocation': 'Sale & rent',
      'nav.profil': 'Profile',
      'home.tag': '✦ Private club ✦', 'home.sub': 'Enter the world of gaming.',
      'home.enter': 'ENTER THE CASINO', 'home.note': 'Fictional virtual currency — no real money, no withdrawals.',
      'casino.title': 'Royal Casino', 'casino.sub': 'Choose your table',
      'settings.title': 'Settings', 'settings.lang': 'Language', 'settings.audio': 'Audio',
      'settings.music': 'Music', 'settings.sfx': 'Sound effects', 'settings.saves': 'Saves (jobs)',
      'mode.commerce': 'Business', 'mode.immobilier': 'Real estate',
    },
  };
  let lang = 'fr';
  const apply = (l) => {
    lang = DICT[l] ? l : 'fr';
    const d = DICT[lang];
    $$('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (d[k]) el.textContent = d[k]; });
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  };
  const load = () => { try { const l = localStorage.getItem(KEY); if (l) lang = l; } catch (e) {} return lang; };
  return { apply, load, get lang() { return lang; } };
})();

/* ======================================================================
   11 septies. PARAMÈTRES + OFFRE D'EMPLOI
   ====================================================================== */
const Settings = (() => {
  let panel;
  const init = () => {
    panel = $('#settings');
    $('#settingsClose').addEventListener('click', close);
    panel.addEventListener('click', (e) => { if (e.target === panel) close(); });

    $$('.set-lang', panel).forEach((b) => b.addEventListener('click', () => {
      Sound.play('click'); I18n.apply(b.dataset.lang); markLang();
    }));
    $('#setMusicVol').addEventListener('input', (e) => Sound.setMusicVolume(Number(e.target.value) / 100));
    $('#setSfxVol').addEventListener('input', (e) => { Sound.setSfxVolume(Number(e.target.value) / 100); });
    $('#setSfxVol').addEventListener('change', () => Sound.play('chip'));

    $$('.set-save', panel).forEach((b) => b.addEventListener('click', () => chooseSave(b.dataset.mode)));
  };

  const markLang = () => $$('.set-lang', panel).forEach((b) => b.classList.toggle('active', b.dataset.lang === I18n.lang));

  const chooseSave = (mode) => {
    if (mode === Bank.mode) { UI.toast('Emploi déjà actif.'); return; }
    if (mode === 'immobilier') {
      if (!Bank.immoUnlocked) { UI.toast('🔒 Atteignez le niveau 50 en Commerce pour débloquer l\'Immobilier.', 'lose'); return; }
      if (!Bank.immoStarted) { close(); Onboarding.start('agency'); return; }
    }
    Bank.switchMode(mode);
    close();
  };

  const refreshSaves = () => {
    const immoBtn = $('.set-save[data-mode="immobilier"]', panel);
    immoBtn.classList.toggle('locked', !Bank.immoUnlocked);
    $$('.set-save', panel).forEach((b) => b.classList.toggle('active', b.dataset.mode === Bank.mode));
    const note = $('#setSavesNote');
    if (!Bank.immoUnlocked) note.textContent = '🔒 Immobilier débloqué au niveau 50 en Commerce.';
    else if (!Bank.immoStarted) note.textContent = 'Immobilier débloqué — cliquez pour fonder votre agence.';
    else note.textContent = 'Basculez librement entre vos deux emplois.';
  };

  const open = () => {
    $('#setMusicVol').value = Math.round(Sound.musicVolume * 100);
    $('#setSfxVol').value = Math.round(Sound.sfxVolume * 100);
    markLang(); refreshSaves();
    panel.classList.remove('hidden');
    Sound.play('select');
  };
  const close = () => panel.classList.add('hidden');

  return { init, open, close };
})();

const JobOffer = (() => {
  let panel;
  const init = () => {
    panel = $('#jobOffer');
    $('#jobLater').addEventListener('click', () => { Sound.play('click'); panel.classList.add('hidden'); });
    $('#jobChange').addEventListener('click', () => { panel.classList.add('hidden'); Onboarding.start('agency'); });
  };
  const show = () => { panel.classList.remove('hidden'); Sound.play('jackpot'); };
  return { init, show };
})();

/* ======================================================================
   11 sexies. AUTOMATISATION — entreprise autonome (niveau 45, ultra chère)
   ====================================================================== */
const Automation = (() => {
  const LEVEL = 35, PERIOD = 7000;
  // Chaque poste a 3 niveaux : meilleur = plus cher (embauche + salaire), plus efficace.
  const ROLES = {
    acheteur:    { ico: '🛒', name: 'Acheteur',    desc: 'Achète les véhicules automatiquement (obtient des remises).',
      tiers: [{ n: 'Stagiaire', cost: 300000, salary: 400 }, { n: 'Confirmé', cost: 1500000, salary: 1200 }, { n: 'Expert', cost: 6000000, salary: 3000 }] },
    vendeur:     { ico: '💼', name: 'Vendeur',     desc: 'Revend au meilleur prix (bonus de vente).',
      tiers: [{ n: 'Stagiaire', cost: 300000, salary: 400 }, { n: 'Confirmé', cost: 1500000, salary: 1200 }, { n: 'Expert', cost: 6000000, salary: 3000 }] },
    comptable:   { ico: '📊', name: 'Comptable',   desc: 'Réduit les taxes et optimise les marges.',
      tiers: [{ n: 'Junior', cost: 200000, salary: 300 }, { n: 'Sénior', cost: 1000000, salary: 900 }, { n: 'Chef comptable', cost: 4000000, salary: 2200 }] },
    logisticien: { ico: '🚚', name: 'Logisticien', desc: 'Réduit les coûts de transport et les délais.',
      tiers: [{ n: 'Junior', cost: 200000, salary: 300 }, { n: 'Sénior', cost: 1000000, salary: 900 }, { n: 'Chef logistique', cost: 4000000, salary: 2200 }] },
  };
  let card;

  const init = () => {
    card = $('#autoCard');
    if (card) card.addEventListener('click', (e) => {
      const h = e.target.closest('[data-hire]');
      if (h) return hire(h.dataset.hire);
      if (e.target.closest('#autoToggle')) { Bank.toggleAuto(); Sound.play('click'); render(); }
    });
    setInterval(cycle, PERIOD);
  };

  const skill = (role) => Bank.employees[role] || 0;   // 0 = non embauché, 1–3 = niveau
  const salaries = () => Object.keys(ROLES).reduce((a, r) => a + (skill(r) ? ROLES[r].tiers[skill(r) - 1].salary : 0), 0);
  const mods = () => ({
    buyDiscount: skill('acheteur') * 0.04,
    saleBonus: skill('vendeur') * 0.05,
    tax: Math.max(0.01, 0.05 - skill('comptable') * 0.015),
    shipMult: 1 - skill('logisticien') * 0.12,
    delayMult: 1 - skill('logisticien') * 0.18,
  });

  const hire = async (role) => {
    if (Bank.level < LEVEL) return;
    const lvl = skill(role);
    if (lvl >= 3) { UI.toast(`${ROLES[role].name} déjà au niveau maximum.`); return; }
    const t = ROLES[role].tiers[lvl];   // niveau suivant
    if (Bank.balance < t.cost) { Sound.play('lose'); UI.toast(`Embauche : il faut ${fmt(t.cost)} €.`, 'lose'); return; }
    const ok = await UI.confirm(`Embaucher un ${ROLES[role].name} « ${t.n} » pour ${fmt(t.cost)} € ? Salaire : ${fmt(t.salary)} € par opération.`);
    if (!ok) return;
    if (!Bank.debit(t.cost)) return;
    Bank.setEmployee(role, lvl + 1);
    Sound.play('chip'); UI.coinRain(14);
    UI.toast(`🧑‍💼 ${ROLES[role].name} « ${t.n} » embauché !`, 'win');
    render();
  };

  const cycle = () => {
    if (Bank.mode !== 'commerce' || !Bank.autoOn) return;
    if (!skill('acheteur') || !skill('vendeur')) return;   // besoin d'un acheteur ET d'un vendeur
    const sal = salaries();
    if (Bank.balance < sal + 1000) return;                 // pas de quoi payer les salaires
    Bank.debit(sal);                                       // 🧾 salaires versés
    const r = ImportExport.autoTrade(mods());
    if (r) {
      UI.toast(`🏢 ${r.name} acheté (−${fmt(r.cost)} €) → revente ${r.market} · salaires −${fmt(sal)} €`, '');
      if (Nav.current === 'profile') render();
    }
  };

  const render = () => {
    if (!card) return;
    if (Bank.mode !== 'commerce') { card.style.display = 'none'; return; }
    card.style.display = '';
    if (Bank.level < LEVEL) {
      card.innerHTML = `<span class="pc-label">🏢 Employés — entreprise autonome</span>
        <p class="auto-desc">Embauchez une équipe (acheteur, vendeur, comptable, logisticien) pour que votre entreprise achète et revende seule. Meilleur employé = plus cher.</p>
        <div class="auto-lock">🔒 Débloqué au niveau ${LEVEL}</div>`;
      return;
    }
    const active = skill('acheteur') && skill('vendeur');
    const rows = Object.keys(ROLES).map((role) => {
      const R = ROLES[role], lvl = skill(role);
      const cur = lvl ? R.tiers[lvl - 1] : null;
      const next = lvl < 3 ? R.tiers[lvl] : null;
      const btn = next
        ? `<button class="btn-ghost emp-hire" data-hire="${role}">${lvl ? 'Promouvoir' : 'Embaucher'} → ${next.n} · ${fmt(next.cost)} €</button>`
        : `<span class="emp-max">✦ Niveau max</span>`;
      return `<div class="emp-row">
        <div class="emp-ico">${R.ico}</div>
        <div class="emp-info">
          <div class="emp-name">${R.name}${cur ? ` <b class="emp-lvl">${cur.n}</b>` : ' <i class="emp-none">non embauché</i>'}</div>
          <div class="emp-desc">${R.desc}${cur ? ` · salaire ${fmt(cur.salary)} €/op` : ''}</div>
        </div>
        ${btn}
      </div>`;
    }).join('');
    card.innerHTML = `<span class="pc-label">🏢 Mes employés
        <b class="auto-badge ${active && Bank.autoOn ? '' : 'off'}">${active ? (Bank.autoOn ? 'ACTIVE' : 'EN PAUSE') : 'INACTIVE'}</b></span>
      <p class="auto-desc">${active ? `Votre équipe négocie seule toutes les ${PERIOD / 1000} s (salaires ${fmt(salaries())} €/opération).` : 'Il faut au minimum un <b>Acheteur</b> et un <b>Vendeur</b> pour lancer l\'activité.'}</p>
      <div class="emp-list">${rows}</div>
      ${active ? `<button id="autoToggle" class="btn-ghost">${Bank.autoOn ? '⏸ Mettre en pause' : '▶ Réactiver'}</button>` : ''}`;
  };

  return { init, render };
})();

/* ======================================================================
   11 septies. ROUE QUOTIDIENNE — 8 prix, une fois par jour
   ====================================================================== */
const DailyWheel = (() => {
  // Ordre des cases autour de la roue (case 0 en haut, sens horaire).
  const ORDER = [10, 500, 50, 1000, 100, 1500, 250, 3000];
  // Probabilités : gros lots rares, jackpot 3000 à 3 %.
  const WEIGHT = { 10: 25, 50: 22, 100: 18, 250: 13, 500: 9, 1000: 6, 1500: 4, 3000: 3 };
  // Palette vive et chic (le 3000 = or éclatant pour le jackpot).
  const COLORS = ['#e63950', '#12a15f', '#2b6cb0', '#e8a422', '#8e44ad', '#16a3a3', '#e2601e', '#f4c430'];
  let modal, disc, spinBtn, busy = false, rot = 0;

  // Construit une vraie roue de la fortune en SVG.
  const buildSVG = () => {
    const C = 150, R = 138, rn = 96, seg = 45;
    const pt = (a, r) => [C + r * Math.sin(a * Math.PI / 180), C - r * Math.cos(a * Math.PI / 180)];
    let parts = '', nums = '', bulbs = '';
    ORDER.forEach((v, i) => {
      const a0 = i * seg - 22.5, a1 = i * seg + 22.5;
      const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
      parts += `<path d="M ${C} ${C} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${COLORS[i]}" stroke="#fff8ee" stroke-width="1.5"/>`;
      nums += `<g transform="rotate(${i * seg} ${C} ${C})"><text x="${C}" y="${(C - rn).toFixed(0)}" text-anchor="middle" class="wheel-num${v === 3000 ? ' jackpot-num' : ''}">${v}</text></g>`;
    });
    const NB = 24;
    for (let k = 0; k < NB; k++) { const [bx, by] = pt(k * (360 / NB), 148); bulbs += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.4" class="wheel-bulb"/>`; }
    return `<svg viewBox="0 0 300 300" class="wheel-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="wheelHub" cx="38%" cy="34%" r="72%"><stop offset="0%" stop-color="#fbeebc"/><stop offset="60%" stop-color="#e0b558"/><stop offset="100%" stop-color="#9b7a2a"/></radialGradient>
        <radialGradient id="wheelRim" cx="50%" cy="50%" r="50%"><stop offset="88%" stop-color="#b9902f"/><stop offset="100%" stop-color="#f4dfa0"/></radialGradient>
      </defs>
      <circle cx="${C}" cy="${C}" r="150" fill="#241a0e"/>
      <circle cx="${C}" cy="${C}" r="149" fill="none" stroke="url(#wheelRim)" stroke-width="8"/>
      <g class="wheel-bulbs">${bulbs}</g>
      <g id="wheelDisc" class="wheel-spin">${parts}${nums}<circle cx="${C}" cy="${C}" r="38" fill="#1a1622"/></g>
      <circle cx="${C}" cy="${C}" r="32" fill="url(#wheelHub)" stroke="#7a5e1f" stroke-width="2.5"/>
      <circle cx="${C}" cy="${C}" r="9" fill="#5a4416"/>
    </svg>`;
  };

  const init = () => {
    modal = $('#wheel'); spinBtn = $('#wheelSpin');
    $('#wheelSvgHost').innerHTML = buildSVG();
    disc = $('#wheelDisc');
    $('#wheelBtn').addEventListener('click', open);
    $('#wheelClose').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    spinBtn.addEventListener('click', spin);
    refreshBadge();
  };

  const refreshBadge = () => {
    const badge = $('#wheelBadge');
    if (badge) badge.textContent = Bank.wheelReady() ? '● dispo' : '';
    const btn = $('#wheelBtn');
    if (btn) btn.classList.toggle('ready', Bank.wheelReady());
  };

  const waitLabel = () => {
    const ms = Bank.wheelWaitMs();
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return `${h} h ${m.toString().padStart(2, '0')} min`;
  };

  const open = () => {
    Sound.play('select');
    $('#wheelResult').textContent = '';
    if (Bank.wheelReady()) {
      $('#wheelSub').textContent = 'Tournez la roue pour gagner un lot !';
      spinBtn.disabled = false; spinBtn.textContent = 'TOURNER LA ROUE';
    } else {
      $('#wheelSub').textContent = `Déjà tournée aujourd'hui. Revenez dans ${waitLabel()}.`;
      spinBtn.disabled = true; spinBtn.textContent = 'REVENEZ DEMAIN';
    }
    modal.classList.remove('hidden');
  };

  const pickPrize = () => {
    const total = ORDER.reduce((a, v) => a + WEIGHT[v], 0);
    let r = Math.random() * total;
    for (const v of ORDER) { r -= WEIGHT[v]; if (r < 0) return v; }
    return ORDER[0];
  };

  const spin = async () => {
    if (busy || !Bank.wheelReady()) return;
    busy = true; spinBtn.disabled = true; $('#wheelResult').textContent = '';
    const prize = pickPrize();
    const i = ORDER.indexOf(prize);
    // Aligne la case i sous le repère (en haut).
    const desiredMod = ((360 - i * 45) % 360 + 360) % 360;
    rot += 6 * 360 + (((desiredMod - (rot % 360)) % 360) + 360) % 360;
    disc.style.transform = `rotate(${rot}deg)`;
    Sound.play('lever');
    let ticks = 24; const ti = setInterval(() => { Sound.play('reel'); if (--ticks <= 0) clearInterval(ti); }, 150);

    await wait(4300);
    clearInterval(ti);
    Bank.credit(prize); Bank.markWheel();
    const res = $('#wheelResult');
    res.textContent = `+${fmt(prize)} € !`;
    res.className = 'wheel-result ' + (prize >= 1500 ? 'jackpot' : 'win');
    if (prize >= 1500) { Sound.play('jackpot'); UI.coinRain(30); } else { Sound.play('win'); UI.coinRain(14); }
    UI.toast(prize >= 3000 ? `🏆 JACKPOT ! +${fmt(prize)} €` : `🎡 Roue : +${fmt(prize)} €`, 'win');
    $('#wheelSub').textContent = `Revenez dans ${waitLabel()} pour retenter.`;
    spinBtn.textContent = 'REVENEZ DEMAIN';
    refreshBadge();
    busy = false;
  };

  const onEnterCasino = () => refreshBadge();
  return { init, onEnterCasino };
})();

/* ======================================================================
   11 nonies. MULTIJOUEUR EN LIGNE — 2 joueurs via serveur WebSocket
   ====================================================================== */
const Multiplayer = (() => {
  // URL du serveur, détectée automatiquement :
  //  • en ligne (https, ex. Render) → wss:// sur le même domaine
  //  • servi par node en http → ws:// sur le même hôte:port
  //  • dev local (python http.server) → ws://localhost:8787 (serveur node séparé)
  //  Surchargeable via localStorage 'mpUrl'.
  const url = () => {
    const o = (localStorage.getItem('mpUrl') || '').trim(); if (o) return o;
    // Servi par le serveur node (http/https) → WebSocket sur la MÊME adresse.
    // → marche en LAN (http://IP-hote:8787) comme en ligne (https://app.onrender.com).
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    }
    // Jeu ouvert en fichier local (file://) → serveur node local par défaut.
    return 'ws://localhost:8787';
  };
  // Normalise une adresse saisie (IP:port, http://…, ws://…) en URL WebSocket.
  const normalizeServer = (v) => {
    v = (v || '').trim(); if (!v) return '';
    if (/^wss?:\/\//i.test(v)) return v;
    if (/^https?:\/\//i.test(v)) return v.replace(/^http/i, 'ws');
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + v;
  };
  const applyServerField = () => {
    const el = $('#mpServer'); if (!el) return;
    const srv = normalizeServer(el.value);
    if (srv) localStorage.setItem('mpUrl', srv); else localStorage.removeItem('mpUrl');
  };
  let ws = null, modal, myName = 'Joueur', peerName = '', idx = 0;
  let active = false, partnerCountry = null, code = '';
  let countryResolve = null;
  let partnerState = null, syncTimer = null, lastSync = 0, listenersWired = false;
  const DUO_GOAL = 1000000;   // objectif commun : fortune cumulée du duo
  // Le code de la partie à 2 est enregistré DÉFINITIVEMENT ici → on peut revenir
  // quand on veut avec le même code, sans perdre sa sauvegarde.
  const DUO_KEY = 'rnc_duoCode';
  const savedDuoCode = () => (localStorage.getItem(DUO_KEY) || '').toUpperCase();
  const setDuoCode = (c) => { code = c; if (c) localStorage.setItem(DUO_KEY, c); loadTier(); };

  // ── Coffre du Duo + Rang + paliers de bonus (partagés) ────────────────────
  // Chaque joueur mémorise SA contribution (par code de partie) ; le total du
  // coffre = ma contribution + celle du partenaire (reçue par la synchro).
  const TIERS = [
    { at: 100000,   bonus: 0.03, reward: 15000,  rank: 'Négociants' },
    { at: 500000,   bonus: 0.06, reward: 60000,  rank: 'Négociants' },
    { at: 1500000,  bonus: 0.10, reward: 200000, rank: 'Magnats' },
    { at: 5000000,  bonus: 0.15, reward: 700000, rank: 'Empereurs du commerce' },
  ];
  let tierReached = 0;
  const depoKey = () => 'rnc_vault_' + (savedDuoCode() || 'x');
  const tierKey = () => 'rnc_vtier_' + (savedDuoCode() || 'x');
  const myDeposited = () => Number(localStorage.getItem(depoKey()) || 0);
  const setMyDeposited = (v) => localStorage.setItem(depoKey(), String(Math.max(0, Math.round(v))));
  const loadTier = () => { tierReached = Number(localStorage.getItem(tierKey()) || 0); };
  const saveTier = () => localStorage.setItem(tierKey(), String(tierReached));
  const vaultTotal = () => myDeposited() + ((partnerState && partnerState.deposited) || 0);
  const rankFor = (t) => t >= 5000000 ? 'Empereurs du commerce' : t >= 1500000 ? 'Magnats' : t >= 100000 ? 'Négociants' : 'Novices';
  // Bonus de vente partagé accordé par les paliers (appliqué à l'Import/Export).
  const saleBonus = () => (active && tierReached > 0) ? TIERS[tierReached - 1].bonus : 0;
  // Crédite les récompenses de palier franchies (chaque joueur pour lui-même).
  const checkTiers = () => {
    const total = vaultTotal();
    let reached = tierReached;
    while (reached < TIERS.length && total >= TIERS[reached].at) {
      const t = TIERS[reached];
      Bank.credit(t.reward); Bank.logTx && Bank.logTx(t.reward, 'Prime palier du duo');
      UI.toast(`🏆 Palier du duo ${fmtMoney(t.at)} atteint ! +${fmtMoney(t.reward)} et +${Math.round(t.bonus * 100)}% de ventes pour vous deux !`, 'win');
      Sound.play('jackpot'); UI.coinRain(24);
      reached++;
    }
    if (reached !== tierReached) { tierReached = reached; saveTier(); }
  };

  const init = () => {
    modal = $('#mp');
    $('#mpClose').addEventListener('click', close);
    $('#mpHost').addEventListener('click', host);
    const rb = $('#mpResume'); if (rb) rb.addEventListener('click', resume);
    $('#mpJoinBtn').addEventListener('click', () => { screen('join'); setTimeout(() => { const f = $$('#mpCodeInput input')[0]; if (f) f.focus(); }, 50); });
    $('#mpBack').addEventListener('click', () => screen('menu'));
    $('#mpJoinGo').addEventListener('click', join);
    $('#mpReady').addEventListener('click', ready);
    $('#mpShare2').addEventListener('click', shareInvite);
    // Panneau Duo (coffre, rang, cadeaux/sauvetage)
    const dOpen = $('#duoOpen'); if (dOpen) dOpen.addEventListener('click', openDuoPanel);
    const dClose = $('#duoPanelClose'); if (dClose) dClose.addEventListener('click', closeDuoPanel);
    const dDep = $('#duoDepositBtn'); if (dDep) dDep.addEventListener('click', () => { const el = $('#duoDepositInput'); depositToVault(el.value); el.value = ''; });
    const gM = $('#duoGiftMoneyBtn'); if (gM) gM.addEventListener('click', () => { const el = $('#duoGiftMoney'); sendMoney(el.value); el.value = ''; });
    const gV = $('#duoGiftVehicleBtn'); if (gV) gV.addEventListener('click', () => { const el = $('#duoGiftVehicle'); if (el && el.value) sendVehicle(el.value); });
    // Saisie du code : passage auto d'une case à l'autre.
    const inputs = $$('#mpCodeInput input');
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus(); });
    });
    // Champ serveur (avancé) : mémorise l'adresse et met à jour l'aperçu.
    const sf = $('#mpServer');
    if (sf) {
      sf.value = (localStorage.getItem('mpUrl') || '');
      sf.addEventListener('input', () => { applyServerField(); updateServerInfo(); });
    }
    // Coupure réseau : on prévient mais on NE ferme PAS la partie à 2.
    // La reconnexion se fait via « Reprendre » ; la sauvegarde reste intacte.
    window.addEventListener('offline', () => { if (active) { renderDuoHud(); UI.toast('📴 Connexion perdue. Reconnectez-vous via « Jouer à 2 » → « Reprendre ».', 'lose'); } });
  };

  // Décrit le serveur détecté + prévient si l'adresse n'est pas partageable.
  const updateServerInfo = () => {
    const now = $('#mpServerNow'); if (now) now.textContent = 'Connexion à : ' + url();
    const info = $('#mpConnInfo');
    if (info) {
      const h = location.hostname;
      if (location.protocol === 'file:') {
        info.innerHTML = '⚠️ Jeu ouvert en fichier local — lancez <b>node server.js</b> et ouvrez <b>http://IP-de-l-hôte:8787</b> sur les 2 appareils.';
      } else if (h === 'localhost' || h === '127.0.0.1') {
        info.innerHTML = '⚠️ Vous êtes sur <b>localhost</b> : un ami sur un autre appareil ne pourra pas rejoindre. Ouvrez le jeu via votre IP locale (<b>http://VOTRE-IP:8787</b>) ou déployez en ligne, puis partagez cette adresse.';
      } else {
        info.innerHTML = 'Votre ami doit ouvrir <b>' + location.origin + '</b> puis entrer le code ci-dessus.';
      }
    }
  };

  const screen = (name) => $$('.mp-screen', modal).forEach((s) => { s.hidden = s.dataset.mp !== name; });

  const openMenu = () => {
    if (!navigator.onLine) { UI.toast('📴 Activez le Wi-Fi / internet pour jouer à 2 en ligne.', 'lose'); return; }
    myName = (Bank.company && Bank.company.name) || 'Joueur';
    $('#mpCodeBar').hidden = true;
    $('#mpOnlineNote').textContent = navigator.onLine ? '' : 'Hors ligne.';
    // Bouton « Reprendre » si une partie à 2 a déjà été créée (code mémorisé).
    const rb = $('#mpResume'); const sc = savedDuoCode();
    if (rb) { rb.hidden = !sc; rb.innerHTML = sc ? `🔁 Reprendre la partie à 2 <b>${sc}</b>` : ''; }
    updateServerInfo();
    screen('menu');
    modal.classList.remove('hidden');
    Sound.play('select');
  };

  const connect = () => new Promise((resolve, reject) => {
    try { ws = new WebSocket(url()); } catch (e) { reject(e); return; }
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('connexion'));
    // Déconnexion serveur : on NE ferme PAS la partie. On passe « hors ligne » ;
    // le joueur continue et peut « Reprendre la partie à 2 » quand il veut.
    ws.onclose = () => { ws = null; if (active) { renderDuoHud(); UI.toast('📴 Déconnecté du serveur. Ouvrez « Jouer à 2 » → « Reprendre » pour vous reconnecter.', 'lose'); } };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
  });

  const host = async () => {
    applyServerField();
    try { await connect(); } catch (e) { UI.toast('Impossible de joindre le serveur (' + url() + '). Est-il lancé ?', 'lose'); return; }
    send({ type: 'host', name: myName });
  };

  const join = async () => {
    applyServerField();
    const c = $$('#mpCodeInput input').map((i) => i.value).join('').toUpperCase();
    if (c.length !== 6) { UI.toast('Entrez les 6 caractères du code.', 'lose'); return; }
    try { await connect(); } catch (e) { UI.toast('Impossible de joindre le serveur (' + url() + '). Vérifiez l\'adresse dans ⚙️ Serveur.', 'lose'); return; }
    send({ type: 'join', code: c, name: myName });
  };

  // Reprendre la partie à 2 déjà créée : reconnexion avec le code mémorisé,
  // sans onboarding et sans toucher à la sauvegarde en cours.
  const resume = async () => {
    applyServerField();
    const c = savedDuoCode();
    if (!c) { UI.toast('Aucune partie à 2 enregistrée sur cet appareil.', 'lose'); return; }
    try { await connect(); } catch (e) { UI.toast('Impossible de joindre le serveur (' + url() + ').', 'lose'); return; }
    send({ type: 'resume', code: c, name: myName });
  };

  const ready = () => { send({ type: 'ready', ready: true }); $('#mpReady').disabled = true; $('#mpP1State').textContent = 'Prêt ✔'; };

  const send = (obj) => { try { ws.send(JSON.stringify(obj)); } catch (e) {} };

  const showLobby = (names) => {
    code && ($('#mpCode').textContent = code);
    $('#mpCodeBar').hidden = !code;
    $('#mpP1Name').textContent = names[idx] || myName;
    const pn = names[idx === 0 ? 1 : 0];
    $('#mpP2Name').textContent = pn || 'En attente…';
    $('#mpP2').classList.toggle('waiting', !pn);
    $('#mpReady').disabled = !pn;             // prêt possible seulement quand le duo est là
    $('#mpLobbyHint').textContent = pn ? 'Cliquez « Je suis prêt » quand vous l\'êtes.' : 'Partagez le code pour que votre ami vous rejoigne.';
    updateServerInfo();
    screen('lobby');
  };

  const handle = (m) => {
    if (m.type === 'hosted') { idx = m.idx; setDuoCode(m.code); peerName = ''; showLobby(m.names); }
    else if (m.type === 'joined') { idx = m.idx; setDuoCode(m.code); peerName = m.names[0]; showLobby(m.names); }
    else if (m.type === 'peerJoined') { peerName = m.names[1]; showLobby(m.names); UI.toast(`${peerName} a rejoint la partie !`, 'win'); Sound.play('win'); }
    else if (m.type === 'peerReady') { $('#mpP2State').textContent = m.ready ? 'Prêt ✔' : 'Pas prêt'; }
    else if (m.type === 'start') { startGame(m.names); }
    // Reconnexion à une partie existante (sans onboarding, on garde la sauvegarde).
    else if (m.type === 'resumed') { idx = m.idx; setDuoCode(m.code); peerName = m.names[idx === 0 ? 1 : 0] || ''; resumeGame(m.names); }
    else if (m.type === 'peerResumed') { peerName = (m.names[idx === 0 ? 1 : 0]) || peerName; UI.toast(`🔁 ${peerName || 'Votre partenaire'} est de retour !`, 'win'); Sound.play('win'); syncOut(true); renderDuoHud(); }
    else if (m.type === 'peerCountry') { partnerCountry = m.country; }
    else if (m.type === 'relay') {
      if (m.kind === 'sync') {
        partnerState = m.data || null;
        if (m.data && m.data.country) partnerCountry = m.data.country;
        checkTiers();                    // le coffre a pu franchir un palier
        renderDuoHud(); renderDuoPanel();
      }
      else if (m.kind === 'hello') { syncOut(true); }   // le partenaire demande notre état
      else if (m.kind === 'gift') {                       // cadeau reçu (argent ou véhicule)
        if (m.money) { Bank.credit(m.money); Bank.logTx && Bank.logTx(m.money, 'Cadeau du partenaire'); UI.toast(`🎁 ${peerName || 'Votre partenaire'} vous a envoyé ${fmtMoney(m.money)} !`, 'win'); Sound.play('win'); UI.coinRain(10); }
        if (m.vehicle) { const v = m.vehicle, k = v.cat + '|' + v.name, inv = Bank.inventory; if (inv[k]) inv[k].qty += (v.qty || 1); else inv[k] = { cat: v.cat, name: v.name, price: v.price, qty: (v.qty || 1) }; Bank.persist(); UI.toast(`🚚 ${peerName || 'Votre partenaire'} vous a expédié ${v.qty || 1}× ${v.name} ! Revendez-le où la demande est forte.`, 'win'); Sound.play('win'); UI.coinRain(6); }
        renderDuoPanel();
      }
    }
    else if (m.type === 'countryOk') { if (countryResolve) { countryResolve(true); countryResolve = null; } }
    else if (m.type === 'countryRejected') { if (countryResolve) { countryResolve(false); countryResolve = null; } }
    // Le partenaire s'est déconnecté : on NE ferme PAS la partie — il peut revenir
    // avec le même code. On continue à jouer, la sauvegarde est intacte.
    else if (m.type === 'peerLeft') { partnerState = null; renderDuoHud(); UI.toast(`⚠️ Partenaire déconnecté. Il peut revenir avec le code ${code}.`, 'lose'); }
    else if (m.type === 'error') { UI.toast(m.error || 'Erreur.', 'lose'); }
  };

  // Démarre la couche co-op live (HUD + synchro). Appelé à la création ET à la reprise.
  const beginCoop = () => {
    active = true;
    modal.classList.add('hidden');
    const ss = $('#slotSelect'); if (ss) ss.classList.add('hidden');
    $('#navbar').classList.remove('hidden');
    loadTier();                 // charge le palier de coffre déjà atteint (ce duo)
    renderDuoHud();
    if (!listenersWired) {   // on n'abonne les écouteurs qu'une seule fois
      listenersWired = true;
      Bank.onChange(() => { if (active) { renderDuoHud(); syncOut(); } });
      Bank.onXp(() => { if (active) { renderDuoHud(); syncOut(); } });
    }
    send({ type: 'relay', kind: 'hello' });          // demande l'état du partenaire
    syncOut(true);
    clearInterval(syncTimer);
    syncTimer = setInterval(() => { syncOut(); renderDuoHud(); }, 4000);
  };

  // 1re fois : création de la partie à 2 (chaque joueur crée son entreprise).
  const startGame = (names) => {
    peerName = names[idx === 0 ? 1 : 0];
    beginCoop();
    Nav.go('home');
    UI.toast(`🎮 Partie à 2 lancée avec ${peerName} ! Créez votre entreprise (pays unique).`, 'win');
    Sound.play('jackpot'); UI.coinRain(20);
    Onboarding.start('company');   // pays vérifié côté serveur
  };

  // Reprise : on garde la sauvegarde en cours, pas d'onboarding, on re-réserve son pays.
  const resumeGame = (names) => {
    peerName = names[idx === 0 ? 1 : 0] || '';
    beginCoop();
    const myCountry = (Bank.company && Bank.company.country) || '';
    if (myCountry && ws && ws.readyState === 1) send({ type: 'country', country: myCountry });
    UI.toast(`🔁 Reconnecté à la partie à 2${peerName ? ' avec ' + peerName : ''} ! Votre progression est intacte.`, 'win');
    Sound.play('win'); UI.coinRain(10);
  };

  // ── Synchro co-op temps réel ──────────────────────────────────────────
  const mySnapshot = () => ({
    name: (Bank.company && Bank.company.name) || myName,
    country: (Bank.company && Bank.company.country) || '',
    balance: Math.round(Bank.balance || 0),
    level: Bank.level || 1,
    deposited: myDeposited(),           // ma contribution au coffre du duo
  });
  const syncOut = (force) => {
    if (!active || !ws || ws.readyState !== 1) return;
    const now = Date.now();
    if (!force && now - lastSync < 1200) return;   // throttle
    lastSync = now;
    send({ type: 'relay', kind: 'sync', data: mySnapshot() });
  };
  const fmtMoney = (n) => (Math.round(n)).toLocaleString('fr-FR') + ' €';
  const renderDuoHud = () => {
    const hud = $('#duoHud'); if (!hud) return;
    if (!active) { hud.classList.add('hidden'); return; }
    hud.classList.remove('hidden');
    const link = $('#duoLink');
    const online = ws && ws.readyState === 1;
    if (link) { link.textContent = online ? '● en ligne' : '● hors ligne'; link.classList.toggle('off', !online); }
    const ps = partnerState;
    $('#duoPName').textContent = (ps && ps.name) || peerName || 'Partenaire';
    $('#duoPStat').textContent = ps ? ('Niv. ' + ps.level + ' · ' + fmtMoney(ps.balance)) : 'en attente…';
    const total = vaultTotal();
    const rk = $('#duoRank'); if (rk) rk.textContent = rankFor(total);
    const next = TIERS.find((t) => total < t.at);
    const prevAt = tierReached > 0 ? TIERS[tierReached - 1].at : 0;
    const targetAt = next ? next.at : TIERS[TIERS.length - 1].at;
    const pct = next ? clamp(Math.round((total - prevAt) / (targetAt - prevAt) * 100), 0, 100) : 100;
    $('#duoGoalPct').textContent = pct + ' %';
    $('#duoBarFill').style.width = pct + '%';
    $('#duoGoalSub').textContent = fmtMoney(total) + ' / ' + fmtMoney(targetAt);
  };

  // ── Panneau Duo : coffre, rang, paliers, cadeaux/sauvetage ────────────────
  const renderDuoPanel = () => {
    const p = $('#duoPanel'); if (!p || p.classList.contains('hidden')) return;
    const total = vaultTotal();
    $('#duoRankBig').textContent = rankFor(total);
    $('#duoVaultTotal').textContent = fmtMoney(total);
    const next = TIERS.find((t) => total < t.at);
    const prevAt = tierReached > 0 ? TIERS[tierReached - 1].at : 0;
    const targetAt = next ? next.at : TIERS[TIERS.length - 1].at;
    const pct = next ? clamp(Math.round((total - prevAt) / (targetAt - prevAt) * 100), 0, 100) : 100;
    $('#duoPanelBar').style.width = pct + '%';
    $('#duoVaultNext').textContent = next
      ? `Prochain palier : ${fmtMoney(next.at)}  (+${Math.round(next.bonus * 100)}% ventes · prime ${fmtMoney(next.reward)} chacun)`
      : '👑 Tous les paliers atteints — Empereurs du commerce !';
    $('#duoPerks').innerHTML = TIERS.map((t) => {
      const done = total >= t.at;
      return `<div class="duo-perk${done ? ' done' : ''}"><span class="duo-perk-ico">${done ? '✅' : '🔒'}</span> ${fmtMoney(t.at)} → +${Math.round(t.bonus * 100)}% ventes · prime ${fmtMoney(t.reward)}</div>`;
    }).join('');
    const sel = $('#duoGiftVehicle');
    if (sel) {
      const owned = Object.values(Bank.inventory || {}).filter((v) => v && v.qty > 0);
      sel.innerHTML = owned.length
        ? owned.map((v) => `<option value="${(v.cat + '|' + v.name).replace(/"/g, '&quot;')}">${v.name} (×${v.qty})</option>`).join('')
        : '<option value="">Aucun véhicule en stock</option>';
    }
  };
  const openDuoPanel = () => { if (!active) return; $('#duoPanel').classList.remove('hidden'); renderDuoPanel(); Sound.play('select'); };
  const closeDuoPanel = () => { $('#duoPanel').classList.add('hidden'); Sound.play('click'); };

  const depositToVault = (amount) => {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) { UI.toast('Montant invalide.', 'lose'); return; }
    if (Bank.balance < amount) { UI.toast('Solde insuffisant.', 'lose'); return; }
    Bank.debit(amount); Bank.logTx && Bank.logTx(-amount, 'Dépôt coffre du duo');
    setMyDeposited(myDeposited() + amount);
    syncOut(true);
    UI.toast(`🏦 ${fmtMoney(amount)} déposés dans le coffre du duo !`, 'win'); Sound.play('chip'); UI.coinRain(8);
    checkTiers(); renderDuoHud(); renderDuoPanel();
  };
  const sendMoney = (amount) => {
    amount = Math.floor(Number(amount) || 0);
    if (amount <= 0) { UI.toast('Montant invalide.', 'lose'); return; }
    if (Bank.balance < amount) { UI.toast('Solde insuffisant.', 'lose'); return; }
    if (!ws || ws.readyState !== 1) { UI.toast('Partenaire hors ligne — envoi impossible.', 'lose'); return; }
    Bank.debit(amount); Bank.logTx && Bank.logTx(-amount, 'Cadeau au partenaire');
    send({ type: 'relay', kind: 'gift', money: amount });
    UI.toast(`💸 ${fmtMoney(amount)} envoyés à votre partenaire !`, 'win'); Sound.play('chip');
    renderDuoPanel();
  };
  const sendVehicle = (key) => {
    const inv = Bank.inventory, item = inv[key];
    if (!item || item.qty < 1) { UI.toast('Aucun véhicule à envoyer.', 'lose'); return; }
    if (!ws || ws.readyState !== 1) { UI.toast('Partenaire hors ligne — envoi impossible.', 'lose'); return; }
    item.qty -= 1; if (item.qty <= 0) delete inv[key];
    Bank.persist();
    send({ type: 'relay', kind: 'gift', vehicle: { cat: item.cat, name: item.name, price: item.price, qty: 1 } });
    UI.toast(`🚚 ${item.name} expédié à votre partenaire !`, 'win'); Sound.play('chip');
    renderDuoPanel();
  };

  // Réserve un pays côté serveur (unicité). Renvoie true si accepté.
  const claimCountry = (country) => new Promise((resolve) => {
    if (!active || !ws || ws.readyState !== 1) { resolve(true); return; }
    countryResolve = resolve;
    send({ type: 'country', country });
    setTimeout(() => { if (countryResolve) { countryResolve(true); countryResolve = null; } }, 2500);
  });

  const shareInvite = async () => {
    const txt = `Rejoins ma partie sur Royal Night Casino ! 🎰 Code : ${code}`;
    const data = { title: 'Royal Night Casino — Duo', text: txt, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${txt} — ${location.href}`); UI.toast('Invitation copiée !', 'win'); }
      else UI.toast('Partage indisponible sur cet appareil.', 'lose');
    } catch (e) {}
  };

  const teardown = () => { active = false; partnerCountry = null; partnerState = null; code = ''; clearInterval(syncTimer); syncTimer = null; const hud = $('#duoHud'); if (hud) hud.classList.add('hidden'); const dp = $('#duoPanel'); if (dp) dp.classList.add('hidden'); try { ws && ws.close(); } catch (e) {} ws = null; modal.classList.add('hidden'); };
  // ✕ : si une partie est en cours, on ferme juste le menu (la partie continue).
  // Sinon (menu/salon), on referme la connexion.
  const close = () => { Sound.play('click'); if (active) { modal.classList.add('hidden'); } else { teardown(); } };

  return { init, openMenu, claimCountry, saleBonus, get active() { return active; }, get partnerCountry() { return partnerCountry; }, get peerName() { return peerName; } };
})();

/* ======================================================================
   11 octies. SÉLECTION DES SAUVEGARDES — 3 emplacements au lancement
   ====================================================================== */
const SlotSelect = (() => {
  let el;
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const init = () => {
    el = $('#slotSelect'); el.addEventListener('click', onClick);
    $('#slotMulti').addEventListener('click', () => {
      if (!navigator.onLine) { UI.toast('📴 Activez le Wi-Fi / internet pour jouer à 2 en ligne.', 'lose'); return; }
      Multiplayer.openMenu();
    });
  };

  const render = () => {
    $('#slotGrid').innerHTML = [1, 2, 3].map((n) => {
      const p = Bank.slotPreview(n);
      if (p.empty) {
        return `<div class="slot-card empty">
          <div class="slot-num">Emplacement ${n}</div>
          <div class="slot-state">— Vide —</div>
          <button class="btn-primary" data-play="${n}">Nouvelle partie</button>
        </div>`;
      }
      return `<div class="slot-card">
        <div class="slot-num">Emplacement ${n}${p.mode === 'immobilier' ? ' · 🏢 Immobilier' : ''}</div>
        <div class="slot-preview"><b>${esc(p.name)}</b><span>🌍 ${esc(p.country)} · Niv. ${p.level}</span><span>🪙 ${fmt(p.balance)} €</span></div>
        <div class="slot-actions"><button class="btn-primary" data-play="${n}">Continuer</button><button class="btn-ghost slot-del" data-del="${n}">Supprimer</button></div>
      </div>`;
    }).join('');
  };

  const onClick = async (e) => {
    const play = e.target.closest('[data-play]');
    const del = e.target.closest('[data-del]');
    if (play) choose(Number(play.dataset.play));
    else if (del) {
      const n = Number(del.dataset.del);
      if (await UI.confirm(`Supprimer définitivement la sauvegarde de l'emplacement ${n} ?`)) { Bank.deleteSlot(n); Sound.play('lose'); render(); }
    }
  };

  const choose = (n) => {
    Sound.play('select');
    Bank.setSlot(n);
    UI.renderCompany(); UI.renderHistory(); UI.renderGarage(); UI.renderCasino(); UI.renderConcession();
    el.classList.add('hidden');
    $('#navbar').classList.remove('hidden');
    Nav.go('home');
    if (!Bank.company) Onboarding.start(Bank.mode === 'immobilier' ? 'agency' : 'company');
  };

  const show = () => {
    render(); el.classList.remove('hidden'); $('#navbar').classList.add('hidden');
    const note = $('#slotMultiNote'), btn = $('#slotMulti');
    if (note) note.textContent = navigator.onLine ? '' : '📴 Connexion internet requise pour le mode 2 joueurs.';
    if (btn) btn.disabled = !navigator.onLine;
  };
  return { init, show };
})();

/* ======================================================================
   12. BOOTSTRAP — câblage global, navigation, audio, reset, loader
   ====================================================================== */
(function main() {
  Bank.load();

  // Solde partout + historique
  Bank.onChange((bal) => UI.syncBalance(bal));
  // Niveau + expérience
  Bank.onXp((level, xp, need) => UI.syncLevel(level, xp, need));
  Bank.onLevelUp((level) => UI.levelUp(level));
  UI.initParticles();

  // Initialise chaque jeu
  DiceGame.init();
  Blackjack.init();
  Poker.init();
  Slot.init();
  Concession.init();
  ImportExport.init();
  Automation.init();
  DailyWheel.init();
  AgenceImmo.init();
  VenteLocation.init();
  Onboarding.init();
  Settings.init();
  JobOffer.init();
  I18n.load(); I18n.apply(I18n.lang);
  UI.renderCompany();
  UI.renderCasino();

  // Affiche les catégories correspondant à l'emploi courant (Commerce / Immobilier).
  const updateNavForMode = () => {
    $$('[data-modecat]').forEach((el) => { el.hidden = el.dataset.modecat !== Bank.mode; });
  };
  updateNavForMode();

  // Changement d'emploi : met à jour la nav, l'entreprise/agence et le casino.
  Bank.onModeChange(() => {
    updateNavForMode();
    UI.renderCompany(); UI.renderHistory(); UI.renderCasino();
    Nav.go('casino');
  });
  // Niveau max en commerce → proposition de nouvel emploi.
  Bank.onMaxLevel((mode) => { if (mode === 'commerce') setTimeout(() => JobOffer.show(), 900); });

  // Callbacks d'entrée de vue (réinitialisation visuelle)
  Nav.register('dice', DiceGame.onEnter);
  Nav.register('poker', Poker.onEnter);
  Nav.register('slot', Slot.onEnter);
  Nav.register('profile', () => { UI.renderHistory(); UI.renderGarage(); Automation.render(); });
  Nav.register('casino', () => DailyWheel.onEnterCasino());

  // Recharge de secours (filet anti-faillite)
  $('#rescueBtn').addEventListener('click', () => {
    const add = Bank.rescue();
    if (add > 0) { Sound.play('win'); UI.toast(`🆘 Recharge de secours : +${fmt(add)} € (solde minimum garanti)`, 'win'); }
    else UI.toast('Votre solde est déjà suffisant.');
  });
  Nav.register('concession', Concession.onEnter);
  Nav.register('importexport', ImportExport.onEnter);
  Nav.register('agence', AgenceImmo.onEnter);
  Nav.register('ventelocation', VenteLocation.onEnter);
  Nav.register('casino', UI.renderCasino);

  // Navigation : tout élément [data-nav] ou [data-game]
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    const game = e.target.closest('[data-game]');
    const vehicle = e.target.closest('[data-vehicle]');
    const estate = e.target.closest('[data-estate]');
    const deal = e.target.closest('[data-deal]');
    if (vehicle) { Concession.select(vehicle.dataset.vehicle); }
    else if (estate) { AgenceImmo.select(estate.dataset.estate); }
    else if (deal) { VenteLocation.select(deal.dataset.deal); }
    else if (nav) { Nav.go(nav.dataset.nav); }
    else if (game) {
      const g = game.dataset.game;
      if (!Bank.isGameUnlocked(g)) { Sound.play('lose'); UI.toast(`🔒 ${gameLabel(g)} se débloque au niveau ${Bank.unlockLevel(g)}.`, 'lose'); return; }
      Sound.play('launch'); Nav.go(g);
    }
  });

  // Bouton clic générique (feedback sonore léger)
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, [role=button]')) Sound.play('click');
  }, { passive: true });

  // Précharge la musique dès l'ouverture pour un démarrage instantané.
  Sound.preload();
  // Audio : démarre au tout 1er geste (n'importe où sur l'écran de lancement).
  const unlock = () => {
    Sound.kick(); Sound.ensureMusic(); updateAudioBtns();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('click', unlock, { once: false });
  // Quitte/rafraîchit la page → on coupe tout le son pour éviter une
  // « page fantôme » qui continuerait à jouer par-dessus la nouvelle.
  window.addEventListener('pagehide', () => { try { Sound.shutdown(); } catch (e) {} });
  window.addEventListener('beforeunload', () => { try { Sound.shutdown(); } catch (e) {} });
  // Retour via le cache d'historique (bouton précédent) → on relance si besoin.
  window.addEventListener('pageshow', (e) => { if (e.persisted) Sound.ensureMusic(); });

  // Boutons audio
  const musicBtn = $('#musicBtn'), sfxBtn = $('#sfxBtn');
  const updateAudioBtns = () => {
    musicBtn.textContent = Sound.musicOn ? '🎵' : '⏸';
    musicBtn.classList.toggle('off', !Sound.musicOn);
    sfxBtn.textContent = Sound.sfxOn ? '🔊' : '🔇';
    sfxBtn.classList.toggle('off', !Sound.sfxOn);
  };
  const verBadge = $('#verBadge'); if (verBadge) verBadge.textContent = 'v' + APP_VERSION;
  console.log('%c🎰 Royal Night Casino — version ' + APP_VERSION, 'color:#d9b45b;font-weight:bold;font-size:14px');
  musicBtn.addEventListener('click', () => { Sound.toggleMusic(); updateAudioBtns(); UI.toast(Sound.musicOn ? 'Musique activée' : 'Musique en pause'); });
  sfxBtn.addEventListener('click', () => { Sound.toggleSfx(); updateAudioBtns(); UI.toast(Sound.sfxOn ? 'Effets sonores activés' : 'Effets sonores coupés'); });
  updateAudioBtns();

  // Bouton Paramètres
  $('#settingsBtn').addEventListener('click', () => Settings.open());

  // Réinitialisation du compte
  $('#resetBtn').addEventListener('click', async () => {
    const isImmo = Bank.mode === 'immobilier';
    const quoi = isImmo ? 'votre agence immobilière' : 'votre entreprise';
    const ok = await UI.confirm(`Voulez-vous vraiment TOUT recommencer ? Solde, niveau, XP, historique ET ${quoi} seront effacés, et vous repartirez de zéro avec une nouvelle création. Cette action est irréversible.`);
    if (!ok) return;
    Bank.reset();
    UI.renderHistory(); UI.renderCompany(); UI.renderCasino();
    UI.toast('Nouveau départ — créez votre ' + (isImmo ? 'agence' : 'entreprise'));
    Onboarding.start(isImmo ? 'agency' : 'company');
  });

  SlotSelect.init();
  Multiplayer.init();

  // Mode 2 joueurs en ligne (depuis les Paramètres)
  $('#setMulti').addEventListener('click', () => { $('#settings').classList.add('hidden'); Multiplayer.openMenu(); });
  const updateMultiNote = () => {
    const n = $('#setMultiNote'), b = $('#setMulti');
    if (n) n.textContent = navigator.onLine ? 'Connexion active — prêt à jouer à 2.' : '📴 Activez le Wi-Fi / internet pour ce mode.';
    if (b) b.disabled = !navigator.onLine;
  };
  window.addEventListener('online', updateMultiNote);
  window.addEventListener('offline', updateMultiNote);
  updateMultiNote();

  // Changer d'emplacement de sauvegarde (depuis les Paramètres)
  $('#setSwitchSlot').addEventListener('click', () => { Settings.close && Settings.close(); $('#settings').classList.add('hidden'); SlotSelect.show(); });
  // Partager une invitation (partage natif si dispo, sinon copie du lien)
  $('#setShare').addEventListener('click', async () => {
    const data = { title: 'Royal Night Casino', text: 'Rejoins-moi sur Royal Night Casino ! 🎰🚗', url: location.href };
    try {
      if (navigator.share) { await navigator.share(data); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${data.text} ${data.url}`); UI.toast('Invitation copiée dans le presse-papier !', 'win'); }
      else UI.toast('Partage non disponible sur cet appareil.', 'lose');
    } catch (e) { /* partage annulé */ }
  });

  // Écran de chargement -> écran de sélection des sauvegardes
  const finishLoad = () => {
    $('#loader').classList.add('done');
    setTimeout(() => $('#loader').remove(), 800);
    SlotSelect.show();   // on choisit d'abord un emplacement (3 slots)
  };
  // Ne pas allonger artificiellement : petit délai pour la mise en place des polices
  if (document.readyState === 'complete') setTimeout(finishLoad, 700);
  else window.addEventListener('load', () => setTimeout(finishLoad, 700));

  // Vue initiale
  Nav.go('home');
})();
