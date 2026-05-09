(function () {
  'use strict';

  var potEl = document.getElementById('pot');
  var rowsEl = document.getElementById('rows');
  var pollMs = 2000;

  fetchState();
  setInterval(fetchState, pollMs);

  function fetchState() {
    fetch('/api/blaze/scoreboard')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (state) {
        var prizePot = Number(state.prizePot) || 0;
        var leaderboard = Array.isArray(state.leaderboard) ? state.leaderboard : [];
        potEl.textContent = prizePot.toLocaleString('sv-SE');
        renderRows(leaderboard);
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
        '<span>' + escapeHtml(entry.displayName || ('Spelare ' + (i + 1))) + '</span>' +
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
})();

