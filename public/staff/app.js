(function () {
  'use strict';

  var form = document.getElementById('score-form');
  var scoreInput = document.getElementById('score');
  var submitBtn = document.getElementById('submit-btn');
  var messageEl = document.getElementById('message');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var score = parseInt(scoreInput.value, 10);
    if (!Number.isInteger(score) || score <= 0) {
      showMessage('Poäng måste vara ett positivt heltal.', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sparar...';
    showMessage('');

    fetch('/api/scores/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: score }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Kunde inte spara score.');
        return response.json();
      })
      .then(function () {
        scoreInput.value = '';
        showMessage('✓ Score sparad');
        scoreInput.focus();
      })
      .catch(function (err) {
        showMessage(err.message || 'Något gick fel.', true);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Spara score';
      });
  });

  function showMessage(text, isError) {
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'msg error' : 'msg';
  }
})();
