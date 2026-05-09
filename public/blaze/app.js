(function () {
  'use strict';

  var LOCAL_KEY = 'event_scoreboard_blaze_added_total';
  var potEl = document.getElementById('pot');
  var rowsEl = document.getElementById('rows');
  var updatedAtEl = document.getElementById('updated-at');
  var staticState = {
    prizePotSek: 3802,
    topPlayers: [
      { rank: 1, name: 'Peter O', favoriteClub: 'RBK', score: 53 },
      { rank: 2, name: 'Victor', favoriteClub: 'RBK T14', score: 52 },
      { rank: 3, name: 'William L', favoriteClub: 'Varberg Vipers', score: 52 },
      { rank: 4, name: 'Daniel L', favoriteClub: 'Harryda HC', score: 49 },
      { rank: 5, name: 'Fredrik', favoriteClub: 'Djurgarden IF', score: 49 }
    ]
  };

  renderStaticState();
  syncLocalPrizePot();
  setInterval(syncLocalPrizePot, 1000);
  window.addEventListener('storage', syncLocalPrizePot);

  function renderStaticState() {
    potEl.textContent = Number(staticState.prizePotSek || 0).toLocaleString('sv-SE');
    renderRows(staticState.topPlayers || []);
    updatedAtEl.textContent = 'Fast data + lokala score';
  }

  function syncLocalPrizePot() {
    var localAdded = loadLocalAdded();
    var total = Number(staticState.prizePotSek || 0) + localAdded;
    potEl.textContent = total.toLocaleString('sv-SE');
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
      return 0;
    }
  }
})();
