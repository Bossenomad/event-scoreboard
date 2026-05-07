// Staff interface client-side logic
(function () {
  'use strict';

  var form = document.getElementById('score-form');
  var submitBtn = document.getElementById('submit-btn');
  var serverError = document.getElementById('server-error');
  var displayNameInput = document.getElementById('display-name-input');
  var favouriteClubInput = document.getElementById('favourite-club-input');
  var scoreInput = document.getElementById('score-input');
  var exportCsvBtn = document.getElementById('export-csv-btn');
  var playerNameSuggestions = document.getElementById('player-name-suggestions');
  var clubSuggestions = document.getElementById('club-suggestions');

  var confirmationOverlay = document.getElementById('confirmation-overlay');
  var confirmPlayerName = document.getElementById('confirm-player-name');
  var confirmPlayerClub = document.getElementById('confirm-player-club');
  var confirmScore = document.getElementById('confirm-score');
  var confirmBtn = document.getElementById('confirm-btn');
  var cancelBtn = document.getElementById('cancel-btn');

  var successToast = document.getElementById('success-toast');
  var qrImage = document.getElementById('qr-image');
  var qrFallback = document.getElementById('qr-fallback');

  var pendingSubmission = null;
  var toastTimer = null;
  var knownPlayers = [];
  var playerClubByName = {};

  loadKnownPlayers();
  loadQRCode();

  displayNameInput.addEventListener('input', function () { clearFieldError('displayName'); });
  favouriteClubInput.addEventListener('input', function () { clearFieldError('favouriteClub'); });
  scoreInput.addEventListener('input', function () { clearFieldError('score'); });
  displayNameInput.addEventListener('change', autofillClubFromName);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideServerError();

    var data = getFormData();
    var errors = validateForm(data);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }

    pendingSubmission = data;
    showConfirmation(data);
  });

  confirmBtn.addEventListener('click', function () {
    if (!pendingSubmission) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Sparar…';
    createPlayerAndScore(pendingSubmission)
      .then(function () {
        hideConfirmation();
        showSuccessToast();
        form.reset();
      })
      .catch(function (err) {
        hideConfirmation();
        if (err && err.fields) {
          showFieldErrors(err.fields);
        } else if (err && err.message) {
          showServerError(err.message);
        } else {
          showServerError('Något gick fel. Försök igen.');
        }
      })
      .finally(function () {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Bekräfta';
      });
  });

  cancelBtn.addEventListener('click', function () {
    hideConfirmation();
    submitBtn.focus();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && confirmationOverlay.classList.contains('visible')) {
      hideConfirmation();
      submitBtn.focus();
    }
  });

  exportCsvBtn.addEventListener('click', function () {
    window.location.href = '/api/players/export/csv';
  });

  function getFormData() {
    return {
      displayName: (displayNameInput.value || '').trim(),
      favouriteClub: (favouriteClubInput.value || '').trim(),
      score: parseInt(scoreInput.value, 10)
    };
  }

  function validateForm(data) {
    var errors = {};

    if (!data.displayName) {
      errors.displayName = 'Namn krävs';
    } else if (data.displayName.length > 50) {
      errors.displayName = 'Namn får vara max 50 tecken';
    }

    if (!data.favouriteClub) {
      errors.favouriteClub = 'Favoritlag krävs';
    } else if (data.favouriteClub.length > 100) {
      errors.favouriteClub = 'Favoritlag får vara max 100 tecken';
    }

    if (!Number.isInteger(data.score) || data.score <= 0) {
      errors.score = 'Poäng måste vara ett positivt heltal';
    }

    return errors;
  }

  function createPlayerAndScore(data) {
    return fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: data.displayName,
        favouriteClub: data.favouriteClub,
        gdprConsent: true
      })
    })
      .then(function (response) {
        return response.json().then(function (json) {
          return { ok: response.ok, status: response.status, data: json };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          if (result.status === 400 && result.data && result.data.fields) {
            throw { fields: result.data.fields };
          }
          throw { message: (result.data && result.data.error) || 'Kunde inte registrera spelare.' };
        }
        return result.data;
      })
      .then(function (player) {
        return fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: player.id, score: data.score })
        });
      })
      .then(function (response) {
        return response.json().then(function (json) {
          return { ok: response.ok, status: response.status, data: json };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          if (result.status === 400 && result.data && result.data.fields) {
            throw { fields: result.data.fields };
          }
          throw { message: (result.data && result.data.error) || 'Kunde inte spara poäng.' };
        }
      });
  }

  function showConfirmation(data) {
    confirmPlayerName.textContent = data.displayName;
    confirmPlayerClub.textContent = data.favouriteClub;
    confirmScore.textContent = String(data.score);
    confirmationOverlay.classList.add('visible');
    confirmBtn.focus();
  }

  function hideConfirmation() {
    confirmationOverlay.classList.remove('visible');
    pendingSubmission = null;
  }

  function showSuccessToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    successToast.classList.remove('fade-out');
    successToast.classList.add('visible');
    toastTimer = setTimeout(function () {
      successToast.classList.add('fade-out');
      setTimeout(function () {
        successToast.classList.remove('visible');
        successToast.classList.remove('fade-out');
      }, 300);
    }, 2000);
  }

  function showFieldErrors(errors) {
    clearAllFieldErrors();
    var firstError = null;

    for (var field in errors) {
      if (!errors.hasOwnProperty(field)) continue;
      var el = document.getElementById(field + '-error');
      if (el) {
        el.textContent = errors[field];
        el.classList.add('visible');
      }
      var inputEl =
        field === 'displayName' ? displayNameInput :
        field === 'favouriteClub' ? favouriteClubInput :
        field === 'score' ? scoreInput :
        null;
      if (inputEl) {
        inputEl.classList.add('error');
        if (!firstError) firstError = inputEl;
      }
    }

    if (firstError) {
      firstError.focus();
    }
  }

  function clearFieldError(fieldName) {
    var errorEl = document.getElementById(fieldName + '-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
    var inputEl =
      fieldName === 'displayName' ? displayNameInput :
      fieldName === 'favouriteClub' ? favouriteClubInput :
      fieldName === 'score' ? scoreInput :
      null;
    if (inputEl) {
      inputEl.classList.remove('error');
    }
  }

  function clearAllFieldErrors() {
    clearFieldError('displayName');
    clearFieldError('favouriteClub');
    clearFieldError('score');
  }

  function showServerError(message) {
    serverError.textContent = message;
    serverError.classList.add('visible');
  }

  function hideServerError() {
    serverError.textContent = '';
    serverError.classList.remove('visible');
  }

  function loadQRCode() {
    fetch('/api/qrcode')
      .then(function (response) {
        var contentType = response.headers.get('Content-Type') || '';
        if (contentType.indexOf('image/svg+xml') !== -1) {
          return response.text().then(function (svg) {
            var encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            qrImage.src = encoded;
            qrImage.style.display = 'block';
            qrFallback.style.display = 'none';
          });
        }
        return response.text().then(function (url) {
          qrFallback.textContent = url;
          qrFallback.style.display = 'block';
          qrImage.style.display = 'none';
        });
      })
      .catch(function () {
        // Keep silent; QR is supportive
      });
  }

  function loadKnownPlayers() {
    fetch('/api/players')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load players');
        }
        return response.json();
      })
      .then(function (data) {
        knownPlayers = Array.isArray(data.players) ? data.players : [];
        buildSuggestions(knownPlayers);
      })
      .catch(function () {
        // Suggestions are optional
      });
  }

  function buildSuggestions(players) {
    playerClubByName = {};
    clearSuggestions(playerNameSuggestions);
    clearSuggestions(clubSuggestions);

    var uniqueNames = {};
    var uniqueClubs = {};

    for (var i = 0; i < players.length; i++) {
      var name = (players[i].displayName || '').trim();
      var club = (players[i].favouriteClub || '').trim();

      if (name && !uniqueNames[name]) {
        uniqueNames[name] = true;
        appendSuggestion(playerNameSuggestions, name);
      }
      if (club && !uniqueClubs[club]) {
        uniqueClubs[club] = true;
        appendSuggestion(clubSuggestions, club);
      }
      if (name && club && !playerClubByName[name]) {
        playerClubByName[name] = club;
      }
    }
  }

  function appendSuggestion(datalistEl, value) {
    var option = document.createElement('option');
    option.value = value;
    datalistEl.appendChild(option);
  }

  function clearSuggestions(datalistEl) {
    while (datalistEl.firstChild) {
      datalistEl.removeChild(datalistEl.firstChild);
    }
  }

  function autofillClubFromName() {
    var name = (displayNameInput.value || '').trim();
    if (!name) return;
    var club = playerClubByName[name];
    if (!club) return;
    if ((favouriteClubInput.value || '').trim().length > 0) return;
    favouriteClubInput.value = club;
  }
})();
