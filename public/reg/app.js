(function () {
  'use strict';

  var LOCAL_KEY = 'blaze_local_added_total';
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

    fetch('/api/blaze/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: score }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Kunde inte spara score.');
        return response.json();
      })
      .then(function () {
        addLocalScore(score);
        scoreInput.value = '';
        showMessage('✓ Score sparad');
        scoreInput.focus();
      })
      .catch(function () {
        // Fallback for file:// or temporary API issues
        addLocalScore(score);
        scoreInput.value = '';
        showMessage('✓ Score sparad lokalt');
        scoreInput.focus();
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Spara score';
      });
  });

  function addLocalScore(score) {
    try {
      var current = parseInt(localStorage.getItem(LOCAL_KEY) || '0', 10);
      if (!Number.isFinite(current)) current = 0;
      localStorage.setItem(LOCAL_KEY, String(current + score));
    } catch (_err) {
      // ignore storage issues
    }
  }

  function showMessage(text, isError) {
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'msg error' : 'msg';
  }
})();
