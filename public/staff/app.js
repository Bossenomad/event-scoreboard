(function () {
  'use strict';

  if (location.protocol === 'file:') {
    location.replace('https://event-scoreboard.vercel.app/staff');
    return;
  }

  var LOCAL_KEY = 'event_scoreboard_tv_added_total';
  var form = document.getElementById('score-form');
  var scoreInput = document.getElementById('score');
  var submitBtn = document.getElementById('submit-btn');
  var messageEl = document.getElementById('message');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var score = parseInt(scoreInput.value, 10);
    if (!Number.isInteger(score) || score <= 0 || score > 100) {
      showMessage('Poäng måste vara ett heltal mellan 1 och 100.', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sparar...';
    showMessage('');

    addScore(score);
    scoreInput.value = '';
    showMessage('✓ Score sparad');
    scoreInput.focus();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Spara score';
  });

  function addScore(score) {
    var current = 0;
    try {
      current = parseInt(localStorage.getItem(LOCAL_KEY) || '0', 10);
      if (!Number.isFinite(current)) current = 0;
    } catch (_err) {
      current = readCookieTotal();
    }
    var next = current + score;
    try {
      localStorage.setItem(LOCAL_KEY, String(next));
    } catch (_err) {
      // ignore storage write issues, cookie fallback below
    }
    document.cookie = LOCAL_KEY + '=' + encodeURIComponent(String(next)) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function readCookieTotal() {
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

  function showMessage(text, isError) {
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'msg error' : 'msg';
  }
})();
