(function () {
  'use strict';

  if (location.protocol === 'file:') {
    location.replace('https://event-scoreboard.vercel.app/blaze');
    return;
  }

  var LOCAL_KEY = 'event_scoreboard_blaze_added_total';
  var GROWTH_LAST_RUN_KEY = 'event_scoreboard_blaze_growth_last_run';
  var GROWTH_INTERVAL_MS = 3 * 60 * 1000;
  var fitTick = null;
  var potEl = document.getElementById('pot');
  var rowsEl = document.getElementById('rows');
  var updatedAtEl = document.getElementById('updated-at');
  var staticState = {
    prizePotSek: 5376,
    topPlayers: [
      { rank: 1, name: 'Peter O', favoriteClub: 'RBK', score: 53 },
      { rank: 2, name: 'Victor', favoriteClub: 'RBK T14', score: 52 },
      { rank: 3, name: 'William L', favoriteClub: 'Varberg Vipers', score: 52 },
      { rank: 4, name: 'Martin', favoriteClub: 'Borås HC', score: 50 },
      { rank: 5, name: 'Daniel L', favoriteClub: 'Harryda HC', score: 49 }
    ]
  };

  applyFitScale();
  window.addEventListener('resize', applyFitScale);
  window.addEventListener('load', applyFitScale);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(applyFitScale);
  }
  setTimeout(applyFitScale, 50);
  setTimeout(applyFitScale, 250);

  renderStaticState();
  applyPeriodicGrowth();
  syncLocalPrizePot();
  setInterval(syncLocalPrizePot, 1000);
  setInterval(applyPeriodicGrowth, 5000);
  window.addEventListener('storage', syncLocalPrizePot);

  function renderStaticState() {
    potEl.textContent = Number(staticState.prizePotSek || 0).toLocaleString('sv-SE');
    renderRows(staticState.topPlayers || []);
    if (updatedAtEl) {
      updatedAtEl.textContent = 'Fast data + lokala score';
    }
  }

  function syncLocalPrizePot() {
    var localAdded = loadLocalAdded();
    var total = Number(staticState.prizePotSek || 0) + localAdded;
    potEl.textContent = total.toLocaleString('sv-SE');
  }

  function applyPeriodicGrowth() {
    var now = Date.now();
    var lastRun = readGrowthLastRun();

    // First run adds immediately once, then continues on interval.
    if (lastRun <= 0) {
      lastRun = now - GROWTH_INTERVAL_MS;
    }

    var elapsed = now - lastRun;
    if (elapsed < GROWTH_INTERVAL_MS) return;

    // Catch up if tab was sleeping/backgrounded.
    var steps = Math.floor(elapsed / GROWTH_INTERVAL_MS);
    var current = loadLocalAdded();
    var totalAdd = 0;
    for (var i = 0; i < steps; i++) {
      totalAdd += randomInt(10, 50);
    }
    writeLocalAdded(current + totalAdd);
    writeGrowthLastRun(lastRun + (steps * GROWTH_INTERVAL_MS));
  }

  function renderRows(items) {
    rowsEl.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'row';
      empty.textContent = 'Väntar på resultat...';
      rowsEl.appendChild(empty);
      return;
    }

    for (var i = 0; i < items.length; i++) {
      var entry = items[i];
      var row = document.createElement('div');
      row.className = 'row' + (i === 0 ? ' top' : '');
      row.innerHTML =
        '<span>#' + (i + 1) + '</span>' +
        '<span>' + escapeHtml(entry.name || ('Spelare ' + (i + 1))) + '</span>' +
        '<span>' + escapeHtml(entry.favoriteClub || '-') + '</span>' +
        '<span class="score">' + (Number(entry.score) || 0).toLocaleString('sv-SE') + '</span>';
      rowsEl.appendChild(row);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadLocalAdded() {
    try {
      var value = parseInt(localStorage.getItem(LOCAL_KEY) || '0', 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_err) {
      return readCookieAdded();
    }
  }

  function writeLocalAdded(value) {
    try {
      localStorage.setItem(LOCAL_KEY, String(value));
    } catch (_err) {
      // ignore storage write issues
    }
    document.cookie = LOCAL_KEY + '=' + encodeURIComponent(String(value)) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function readCookieAdded() {
    var name = LOCAL_KEY + '=';
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(name) === 0) {
        var n = parseInt(decodeURIComponent(part.substring(name.length)), 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      }
    }
    return 0;
  }

  function readGrowthLastRun() {
    try {
      var value = parseInt(localStorage.getItem(GROWTH_LAST_RUN_KEY) || '0', 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_err) {
      return readGrowthLastRunCookie();
    }
  }

  function writeGrowthLastRun(ts) {
    try {
      localStorage.setItem(GROWTH_LAST_RUN_KEY, String(ts));
    } catch (_err) {
      // ignore storage write issues
    }
    document.cookie = GROWTH_LAST_RUN_KEY + '=' + encodeURIComponent(String(ts)) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function readGrowthLastRunCookie() {
    var name = GROWTH_LAST_RUN_KEY + '=';
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(name) === 0) {
        var n = parseInt(decodeURIComponent(part.substring(name.length)), 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      }
    }
    return 0;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function applyFitScale() {
    var canvas = document.querySelector('.canvas');
    if (!canvas) return;

    if (fitTick) {
      cancelAnimationFrame(fitTick);
    }

    fitTick = requestAnimationFrame(function () {
      fitTick = null;
      var viewportW = Math.max(window.innerWidth, 1);
      var viewportH = Math.max(window.innerHeight, 1);

      // Auto-rotate only on wide (landscape) viewports.
      var shouldRotate = viewportW > viewportH;
      canvas.style.setProperty('--blaze-rotate-deg', shouldRotate ? '90deg' : '0deg');

      var baseW = 1080;
      var baseH = 1920;
      var rotatedW = shouldRotate ? baseH : baseW;
      var rotatedH = shouldRotate ? baseW : baseH;

      var scaleByW = viewportW / rotatedW;
      var scaleByH = viewportH / rotatedH;
      var scale = Math.min(scaleByW, scaleByH);
      // Keep very small safe margin so content fills the TV better.
      scale = scale * 0.985;

      if (!isFinite(scale) || scale <= 0) {
        scale = 1;
      }

      canvas.style.setProperty('--blaze-fit-scale', String(scale));
    });
  }
})();
