// TV Display client-side logic
(function () {
  'use strict';

  // --- DOM elements ---
  var prizeValueEl = document.getElementById('prize-value');
  var leaderboardBody = document.getElementById('leaderboard-body');
  var leaderboardEmpty = document.getElementById('leaderboard-empty');
  var statusDot = document.getElementById('status-dot');
  var statusText = document.getElementById('status-text');

  // --- State ---
  var currentPrizePot = 0;
  var currentLeaderboard = [];
  var prizeAnimationId = null;

  // WebSocket reconnection state
  var ws = null;
  var reconnectAttempts = 0;
  var reconnectTimer = null;
  var wsAvailable = true;

  // Polling fallback state
  var pollTimer = null;
  var POLL_INTERVAL = 5000;

  // --- Initialization ---
  connectWebSocket();

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
      stopPolling();
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
        handleStateUpdate(data);
      })
      .catch(function (err) {
        console.warn('TV Display: polling error', err);
      });
  }

  // --- Connection status indicator ---

  function setConnectionStatus(status) {
    statusDot.className = 'status-dot';
    if (status === 'connected') {
      statusText.textContent = 'Connected';
    } else if (status === 'disconnected') {
      statusDot.classList.add('disconnected');
      statusText.textContent = 'Reconnecting…';
    } else if (status === 'polling') {
      statusDot.classList.add('polling');
      statusText.textContent = 'Polling';
    }
  }

  // --- State update handler ---

  function handleStateUpdate(data) {
    var newPrizePot = typeof data.prizePot === 'number' ? data.prizePot : 0;
    var newLeaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];

    // Animate prize pot if value changed
    if (newPrizePot !== currentPrizePot) {
      animatePrizePot(currentPrizePot, newPrizePot);
    }

    // Update leaderboard with animations
    updateLeaderboard(newLeaderboard);

    currentPrizePot = newPrizePot;
    currentLeaderboard = newLeaderboard;
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
    return num.toLocaleString('en-GB');
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
    nameEl.textContent = entry.displayName || '';

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

})();
