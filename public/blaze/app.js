(function () {
  'use strict';

  var potEl = document.getElementById('pot');
  var rowsEl = document.getElementById('rows');
  var updatedAtEl = document.getElementById('updated-at');
  var pollMs = 2000;

  fetchState();
  setInterval(fetchState, pollMs);

  function fetchState() {
    fetch('https://are-leaderboard.vercel.app/api/leaderboard')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (state) {
        var prizePot = Number(state.prizePotSek) || 0;
        var leaderboard = Array.isArray(state.topPlayers) ? state.topPlayers : [];
        potEl.textContent = prizePot.toLocaleString('sv-SE');
        renderRows(leaderboard);
        updatedAtEl.textContent = formatUpdatedAt(state.lastUpdatedAt);
      })
      .catch(function () {
        // Keep previous values on temporary fetch error.
      });
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
        '<span class="score">' + (Number(entry.score) || 0).toLocaleString('sv-SE') + '</span>';
      rowsEl.appendChild(row);
    }
  }

  function formatUpdatedAt(iso) {
    if (!iso) return 'Väntar på uppdatering...';
    try {
      return 'Uppdaterad ' + new Date(iso).toLocaleTimeString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (_err) {
      return 'Uppdaterad';
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
})();
