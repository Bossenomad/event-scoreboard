// TV Display client-side logic
(function () {
  'use strict';

  if (location.protocol === 'file:') {
    location.replace('https://event-scoreboard.vercel.app/tv/');
    return;
  }

  // --- DOM elements ---
  var prizeValueEl = document.getElementById('prize-value');
  var leaderboardBody = document.getElementById('leaderboard-body');
  var leaderboardEmpty = document.getElementById('leaderboard-empty');
  var statusDot = document.getElementById('status-dot');
  var statusText = document.getElementById('status-text');

  // --- State ---
  var currentPrizePot = 0;
  var currentLeaderboard = [];
  var lastStateFingerprint = '';
  var prizeAnimationId = null;

  // WebSocket reconnection state
  var ws = null;
  var reconnectAttempts = 0;
  var reconnectTimer = null;
  var wsAvailable = true;

  // Polling fallback state
  var pollTimer = null;
  var POLL_INTERVAL = 2000;

  var manualState = window.MANUAL_TV_STATE || {
    prizePot: 0,
    leaderboard: [],
    latestResult: null
  };
  var manualBasePrizePot = Number(manualState.prizePot) || 0;
  var prizePotStorageKey = 'event_scoreboard_tv_prize_pot';
  var addedScoreStorageKey = 'event_scoreboard_tv_added_total';
  var growthLastRunKey = 'event_scoreboard_tv_growth_last_run';
  var GROWTH_INTERVAL_MS = 4 * 60 * 1000;

  // --- Initialization ---
  if (location.protocol === 'file:') {
    applyFilePreviewScale();
    window.addEventListener('resize', applyFilePreviewScale);
    window.addEventListener('load', applyFilePreviewScale);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(applyFilePreviewScale);
    }
    setTimeout(applyFilePreviewScale, 50);
    setTimeout(applyFilePreviewScale, 250);
  } else {
    // On deployed /tv we render at full canvas size to fill the screen.
    document.documentElement.style.setProperty('--tv-scale', '1');
  }
  startManualMode();
  startLocalMode();

  // --- WebSocket connection ---

  function getWebSocketUrl() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return protocol + '//' + location.host + '/ws';
  }

  function connectWebSocket() {
    if (ws) {
      try { ws.close(); } catch (e) { /* ignore */ }
    }

    try {
      ws = new WebSocket(getWebSocketUrl());
    } catch (e) {
      console.warn('WebSocket not available, falling back to polling');
      wsAvailable = false;
      startPolling();
      return;
    }

    ws.onopen = function () {
      reconnectAttempts = 0;
      setConnectionStatus('connected');
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg && msg.type === 'state' && msg.data) {
          handleStateUpdate(msg.data);
        }
      } catch (e) {
        console.warn('TV Display: ignoring malformed message', e);
      }
    };

    ws.onclose = function () {
      setConnectionStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = function () {
      // onclose will fire after onerror, so reconnection is handled there
    };
  }

  // --- Exponential backoff reconnection ---

  function scheduleReconnect() {
    if (reconnectTimer) return;

    var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;

    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connectWebSocket();
    }, delay);

    // Start polling as fallback while disconnected
    if (!pollTimer) {
      startPolling();
    }
  }

  // --- Polling fallback ---

  function startPolling() {
    if (pollTimer) return;
    setConnectionStatus('polling');

    // Fetch immediately, then on interval
    fetchScoreboard();
    pollTimer = setInterval(fetchScoreboard, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function fetchScoreboard() {
    fetch('/api/scoreboard')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var newPrizePot = currentPrizePot;
        if (typeof data.prizePot === 'number') {
          newPrizePot = manualBasePrizePot + data.prizePot;
          var savedPrizePot = loadSavedPrizePot();
          if (savedPrizePot > newPrizePot) {
            newPrizePot = savedPrizePot;
          }
        }
        if (newPrizePot !== currentPrizePot) {
          animatePrizePot(currentPrizePot, newPrizePot);
          currentPrizePot = newPrizePot;
          savePrizePot(currentPrizePot);
        }
      })
      .catch(function (err) {
        console.warn('TV Display: polling error', err);
      });
  }

  // --- Connection status indicator ---

  function setConnectionStatus(status) {
    statusDot.className = 'status-dot';
    if (status === 'connected') {
      statusText.textContent = 'Ansluten';
    } else if (status === 'disconnected') {
      statusDot.classList.add('disconnected');
      statusText.textContent = 'Återansluter…';
    } else if (status === 'polling') {
      statusDot.classList.add('polling');
      statusText.textContent = 'Polling (60s)';
    }
  }

  // --- State update handler ---

  function handleStateUpdate(data) {
    var nextFingerprint = JSON.stringify(data || {});
    if (nextFingerprint === lastStateFingerprint) {
      return;
    }
    lastStateFingerprint = nextFingerprint;

    var newPrizePot = currentPrizePot;
    if (typeof data.prizePot === 'number') {
      newPrizePot = manualBasePrizePot + data.prizePot;
      var savedPrizePot = loadSavedPrizePot();
      if (savedPrizePot > newPrizePot) {
        newPrizePot = savedPrizePot;
      }
    }
    var newLeaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];

    // Animate prize pot if value changed
    if (newPrizePot !== currentPrizePot) {
      animatePrizePot(currentPrizePot, newPrizePot);
    }

    // Update leaderboard with animations
    updateLeaderboard(newLeaderboard);
    currentPrizePot = newPrizePot;
    currentLeaderboard = newLeaderboard;
    savePrizePot(currentPrizePot);
  }

  // --- Prize pot count-up animation ---

  function animatePrizePot(fromValue, toValue) {
    // Cancel any running animation
    if (prizeAnimationId) {
      cancelAnimationFrame(prizeAnimationId);
      prizeAnimationId = null;
    }

    var duration = 1500; // 1.5 seconds
    var startTime = null;

    // Add glow pulse class
    prizeValueEl.classList.add('animating');

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for a satisfying deceleration
      var eased = 1 - Math.pow(1 - progress, 3);

      var currentValue = Math.round(fromValue + (toValue - fromValue) * eased);
      prizeValueEl.textContent = formatNumber(currentValue);

      if (progress < 1) {
        prizeAnimationId = requestAnimationFrame(step);
      } else {
        prizeAnimationId = null;
        prizeValueEl.textContent = formatNumber(toValue);
        // Remove glow pulse after animation completes
        setTimeout(function () {
          prizeValueEl.classList.remove('animating');
        }, 200);
      }
    }

    prizeAnimationId = requestAnimationFrame(step);
  }

  function formatNumber(num) {
    return num.toLocaleString('sv-SE');
  }

  // --- Leaderboard rendering ---

  function updateLeaderboard(newLeaderboard) {
    // Build a set of player IDs currently on the board
    var oldPlayerIds = {};
    for (var i = 0; i < currentLeaderboard.length; i++) {
      oldPlayerIds[currentLeaderboard[i].playerId] = true;
    }

    // Clear the body
    leaderboardBody.innerHTML = '';

    if (newLeaderboard.length === 0) {
      leaderboardBody.appendChild(leaderboardEmpty);
      leaderboardEmpty.style.display = '';
      return;
    }

    leaderboardEmpty.style.display = 'none';

    for (var j = 0; j < newLeaderboard.length; j++) {
      var entry = newLeaderboard[j];
      var rank = j + 1;
      var isNew = !oldPlayerIds[entry.playerId];

      var row = createLeaderboardRow(entry, rank, isNew);
      leaderboardBody.appendChild(row);
    }
  }

  function createLeaderboardRow(entry, rank, isNew) {
    var row = document.createElement('div');
    row.className = 'lb-row';
    row.setAttribute('role', 'row');
    row.setAttribute('data-player-id', entry.playerId);

    if (rank <= 3) {
      row.classList.add('rank-' + rank);
    }

    if (isNew) {
      row.classList.add('slide-in');
    }

    var rankEl = document.createElement('span');
    rankEl.className = 'col-rank';
    rankEl.setAttribute('role', 'cell');
    rankEl.textContent = '#' + rank;

    var nameEl = document.createElement('span');
    nameEl.className = 'col-name';
    nameEl.setAttribute('role', 'cell');
    nameEl.textContent = formatDisplayNameForTv(entry.displayName || '');

    var clubEl = document.createElement('span');
    clubEl.className = 'col-club';
    clubEl.setAttribute('role', 'cell');
    clubEl.textContent = entry.favouriteClub || '';

    var scoreEl = document.createElement('span');
    scoreEl.className = 'col-score';
    scoreEl.setAttribute('role', 'cell');
    scoreEl.textContent = formatNumber(entry.score || 0);

    row.appendChild(rankEl);
    row.appendChild(nameEl);
    row.appendChild(clubEl);
    row.appendChild(scoreEl);

    return row;
  }

  function formatDisplayNameForTv(displayName) {
    var trimmed = (displayName || '').trim();
    if (!trimmed) return '';

    var parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      return parts[0];
    }

    return parts[0] + ' ' + parts[1].charAt(0).toUpperCase();
  }

  function startManualMode() {
    var localAdded = loadAddedScore();
    var startingPrizePot = Math.max(manualBasePrizePot + localAdded, loadSavedPrizePot());
    handleStateUpdate({
      prizePot: startingPrizePot - manualBasePrizePot,
      leaderboard: Array.isArray(manualState.leaderboard) ? manualState.leaderboard : [],
      latestResult: manualState.latestResult || null
    });
    statusText.textContent = 'Lokal';
    statusDot.className = 'status-dot';
  }

  function startLocalMode() {
    setConnectionStatus('connected');
    applyPeriodicGrowth();
    syncLocalPrizePot();
    setInterval(syncLocalPrizePot, 1000);
    setInterval(applyPeriodicGrowth, 5000);
    window.addEventListener('storage', syncLocalPrizePot);
  }

  function syncLocalPrizePot() {
    var localAdded = loadAddedScore();
    var target = manualBasePrizePot + localAdded;
    if (target !== currentPrizePot) {
      animatePrizePot(currentPrizePot, target);
      currentPrizePot = target;
      savePrizePot(currentPrizePot);
    }
  }

  function applyPeriodicGrowth() {
    var now = Date.now();
    var lastRun = readGrowthLastRun();
    if (lastRun > 0 && now - lastRun < GROWTH_INTERVAL_MS) {
      return;
    }

    var add = randomInt(10, 55);
    var current = loadAddedScore();
    var next = current + add;
    writeAddedScore(next);
    writeGrowthLastRun(now);
  }

  function applyFilePreviewScale() {
    var canvas = document.querySelector('.tv-canvas');
    if (!canvas) return;

    var rootStyle = getComputedStyle(document.documentElement);
    var padRaw = rootStyle.getPropertyValue('--viewport-pad') || '16px';
    var pad = parseFloat(padRaw) || 16;

    var availableWidth = Math.max(window.innerWidth - (pad * 2), 1);
    var availableHeight = Math.max(window.innerHeight - (pad * 2), 1);

    var contentWidth = Math.max(canvas.scrollWidth, 1920);
    var contentHeight = Math.max(canvas.scrollHeight, 1080);

    var scaleByWidth = availableWidth / contentWidth;
    var scaleByHeight = availableHeight / contentHeight;
    var scale = Math.min(scaleByWidth, scaleByHeight);

    if (!isFinite(scale) || scale <= 0) {
      scale = 1;
    }

    document.documentElement.style.setProperty('--tv-scale', String(scale));
  }

  function loadSavedPrizePot() {
    try {
      var value = localStorage.getItem(prizePotStorageKey);
      var parsed = parseInt(value || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (_err) {
      return 0;
    }
  }

  function savePrizePot(value) {
    try {
      localStorage.setItem(prizePotStorageKey, String(Math.max(0, Math.round(value))));
    } catch (_err) {
      // ignore storage write failures
    }
  }

  function loadAddedScore() {
    try {
      var value = parseInt(localStorage.getItem(addedScoreStorageKey) || '0', 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_err) {
      return readCookieAddedScore();
    }
  }

  function writeAddedScore(value) {
    try {
      localStorage.setItem(addedScoreStorageKey, String(value));
    } catch (_err) {
      // ignore storage write issues
    }
    document.cookie = addedScoreStorageKey + '=' + encodeURIComponent(String(value)) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function readCookieAddedScore() {
    var name = addedScoreStorageKey + '=';
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
      var value = parseInt(localStorage.getItem(growthLastRunKey) || '0', 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_err) {
      return readGrowthLastRunCookie();
    }
  }

  function writeGrowthLastRun(ts) {
    try {
      localStorage.setItem(growthLastRunKey, String(ts));
    } catch (_err) {
      // ignore storage write issues
    }
    document.cookie = growthLastRunKey + '=' + encodeURIComponent(String(ts)) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function readGrowthLastRunCookie() {
    var name = growthLastRunKey + '=';
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

})();
