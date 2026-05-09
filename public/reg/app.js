(function () {
  'use strict';

  var LOCAL_KEY = 'event_scoreboard_blaze_added_total';
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
      current = 0;
    }
    try {
      localStorage.setItem(LOCAL_KEY, String(current + score));
    } catch (_err) {
      // ignore storage write issues
    }
  }

  function showMessage(text, isError) {
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'msg error' : 'msg';
  }
})();
