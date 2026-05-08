// Staff interface client-side logic
(function () {
  'use strict';

  var form = document.getElementById('score-form');
  var submitBtn = document.getElementById('submit-btn');
  var serverError = document.getElementById('server-error');
  var scoreInput = document.getElementById('score-input');
  var displayNameInput = document.getElementById('display-name-input');
  var favouriteClubInput = document.getElementById('favourite-club-input');
  var phoneInput = document.getElementById('phone-input');
  var gdprConsentInput = document.getElementById('gdpr-consent-input');
  var top5Details = document.getElementById('top5-details');
  var top5Message = document.getElementById('top5-message');
  var backToStep1Btn = document.getElementById('back-to-step1-btn');
  var playerNameSuggestions = document.getElementById('player-name-suggestions');
  var clubSuggestions = document.getElementById('club-suggestions');
  var forgetPlayerInput = document.getElementById('forget-player-input');
  var forgetSuggestions = document.getElementById('forget-player-suggestions');
  var forgetBtn = document.getElementById('forget-btn');
  var successToast = document.getElementById('success-toast');

  var pendingToken = null;
  var phase = 'intake';
  var knownPlayers = [];
  var playerClubByName = {};
  var toastTimer = null;

  loadKnownPlayers();

  scoreInput.addEventListener('input', function () { clearFieldError('score'); });
  displayNameInput.addEventListener('input', function () {
    clearFieldError('displayName');
    autofillClubFromName();
  });
  favouriteClubInput.addEventListener('input', function () { clearFieldError('favouriteClub'); });
  phoneInput.addEventListener('input', function () { clearFieldError('phone'); });
  gdprConsentInput.addEventListener('change', function () { clearFieldError('gdprConsent'); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideServerError();
    if (phase === 'intake') {
      submitIntake();
    } else {
      submitFinalize();
    }
  });

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', function () {
      resetToIntake();
    });
  }

  forgetBtn.addEventListener('click', function () {
    hideServerError();
    var raw = (forgetPlayerInput.value || '').trim();
    var idMatch = raw.match(/\(([0-9a-fA-F-]{36})\)$/);
    if (!idMatch) {
      showServerError('Välj en spelare i listan för anonymisering.');
      return;
    }
    forgetBtn.disabled = true;
    fetch('/api/players/' + encodeURIComponent(idMatch[1]), { method: 'DELETE' })
      .then(function (response) {
        if (!response.ok) throw new Error('Kunde inte anonymisera spelare.');
        forgetPlayerInput.value = '';
        loadKnownPlayers();
        showSuccessToast('✓ Persondata borttagen, score behållen');
      })
      .catch(function (err) {
        showServerError((err && err.message) || 'Kunde inte anonymisera spelare.');
      })
      .finally(function () {
        forgetBtn.disabled = false;
      });
  });

  function submitIntake() {
    var score = parseInt(scoreInput.value, 10);
    if (!Number.isInteger(score) || score <= 0) {
      showFieldErrors({ score: 'Poäng måste vara ett positivt heltal' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrerar...';
    fetch('/api/scores/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: score }),
    })
      .then(parseJsonResult)
      .then(function (result) {
        if (!result.ok) throw toError(result, 'Kunde inte registrera score.');
        if (!result.data.qualifies) {
          showSuccessToast('✓ Sparat anonymt');
          resetToIntake();
          return;
        }
        pendingToken = result.data.token || null;
        phase = 'finalize';
        top5Details.style.display = 'block';
        top5Message.style.display = 'block';
        top5Message.textContent = 'Top 5! Fyll i namn, favoritförening, telefon och samtycke.';
        submitBtn.textContent = 'Spara topp 5-spelare';
        displayNameInput.focus();
      })
      .catch(handleError)
      .finally(function () {
        submitBtn.disabled = false;
        if (phase === 'intake') submitBtn.textContent = 'Registrera score';
      });
  }

  function submitFinalize() {
    var payload = {
      token: pendingToken,
      displayName: (displayNameInput.value || '').trim(),
      favouriteClub: (favouriteClubInput.value || '').trim(),
      phone: (phoneInput.value || '').trim(),
      gdprConsent: !!gdprConsentInput.checked,
    };

    var errors = {};
    if (!payload.displayName) errors.displayName = 'Namn krävs';
    if (!payload.favouriteClub) errors.favouriteClub = 'Favoritförening krävs';
    if (!payload.phone) errors.phone = 'Telefonnummer krävs';
    if (!payload.gdprConsent) errors.gdprConsent = 'Samtycke krävs';
    if (!payload.token) errors.token = 'Registreringen har gått ut. Registrera score igen.';
    if (Object.keys(errors).length > 0) {
      if (errors.token) showServerError(errors.token);
      showFieldErrors(errors);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sparar...';
    fetch('/api/scores/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(parseJsonResult)
      .then(function (result) {
        if (!result.ok) throw toError(result, 'Kunde inte spara topp 5-spelare.');
        loadKnownPlayers();
        showSuccessToast('✓ Topp 5 sparad');
        resetToIntake();
      })
      .catch(handleError)
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = phase === 'finalize' ? 'Spara topp 5-spelare' : 'Registrera score';
      });
  }

  function toError(result, fallback) {
    if (result.status === 400 && result.data && result.data.fields) return { fields: result.data.fields };
    return { message: (result.data && result.data.error) || fallback };
  }

  function parseJsonResult(response) {
    return response.text().then(function (text) {
      var data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_e) {}
      return { ok: response.ok, status: response.status, data: data };
    });
  }

  function handleError(err) {
    if (err && err.fields) {
      showFieldErrors(err.fields);
      return;
    }
    showServerError((err && err.message) || 'Något gick fel. Försök igen.');
  }

  function resetToIntake() {
    phase = 'intake';
    pendingToken = null;
    form.reset();
    top5Details.style.display = 'none';
    top5Message.style.display = 'none';
    top5Message.textContent = '';
    clearAllFieldErrors();
    submitBtn.textContent = 'Registrera score';
    scoreInput.focus();
  }

  function showFieldErrors(errors) {
    clearAllFieldErrors();
    setFieldError('score', errors.score, scoreInput);
    setFieldError('displayName', errors.displayName, displayNameInput);
    setFieldError('favouriteClub', errors.favouriteClub, favouriteClubInput);
    setFieldError('phone', errors.phone, phoneInput);
    setFieldError('gdprConsent', errors.gdprConsent, null);
  }

  function setFieldError(field, message, input) {
    if (!message) return;
    var el = document.getElementById(field + '-error');
    if (el) {
      el.textContent = message;
      el.classList.add('visible');
    }
    if (input) input.classList.add('error');
  }

  function clearFieldError(field) {
    var el = document.getElementById(field + '-error');
    if (el) {
      el.textContent = '';
      el.classList.remove('visible');
    }
    if (field === 'score') scoreInput.classList.remove('error');
    if (field === 'displayName') displayNameInput.classList.remove('error');
    if (field === 'favouriteClub') favouriteClubInput.classList.remove('error');
    if (field === 'phone') phoneInput.classList.remove('error');
  }

  function clearAllFieldErrors() {
    clearFieldError('score');
    clearFieldError('displayName');
    clearFieldError('favouriteClub');
    clearFieldError('phone');
    clearFieldError('gdprConsent');
  }

  function showServerError(message) {
    serverError.textContent = message;
    serverError.classList.add('visible');
  }

  function hideServerError() {
    serverError.textContent = '';
    serverError.classList.remove('visible');
  }

  function showSuccessToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    successToast.textContent = message;
    successToast.classList.remove('fade-out');
    successToast.classList.add('visible');
    toastTimer = setTimeout(function () {
      successToast.classList.add('fade-out');
      setTimeout(function () {
        successToast.classList.remove('visible');
        successToast.classList.remove('fade-out');
      }, 300);
    }, 1800);
  }

  function loadKnownPlayers() {
    fetch('/api/players')
      .then(function (response) { if (!response.ok) throw new Error('failed'); return response.json(); })
      .then(function (data) {
        knownPlayers = Array.isArray(data.players) ? data.players : [];
        buildSuggestions(knownPlayers);
      })
      .catch(function () {});
  }

  function buildSuggestions(players) {
    playerClubByName = {};
    clearSuggestions(playerNameSuggestions);
    clearSuggestions(clubSuggestions);
    clearSuggestions(forgetSuggestions);
    var names = {};
    var clubs = {};
    for (var i = 0; i < players.length; i++) {
      var name = (players[i].displayName || '').trim();
      var club = (players[i].favouriteClub || '').trim();
      if (name && !names[name]) {
        names[name] = true;
        appendSuggestion(playerNameSuggestions, name);
      }
      if (club && !clubs[club]) {
        clubs[club] = true;
        appendSuggestion(clubSuggestions, club);
      }
      if (name && club && !playerClubByName[name]) {
        playerClubByName[name] = club;
      }
      appendSuggestion(forgetSuggestions, name + ' (' + players[i].id + ')');
    }
  }

  function appendSuggestion(datalistEl, value) {
    if (!datalistEl) return;
    var option = document.createElement('option');
    option.value = value;
    datalistEl.appendChild(option);
  }

  function clearSuggestions(datalistEl) {
    if (!datalistEl) return;
    while (datalistEl.firstChild) datalistEl.removeChild(datalistEl.firstChild);
  }

  function autofillClubFromName() {
    var name = (displayNameInput.value || '').trim();
    if (!name) return;
    var club = playerClubByName[name];
    if (!club) return;
    if ((favouriteClubInput.value || '').trim()) return;
    favouriteClubInput.value = club;
  }
})();
