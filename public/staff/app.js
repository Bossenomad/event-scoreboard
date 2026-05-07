// Staff interface client-side logic
(function () {
  'use strict';

  // DOM elements
  var form = document.getElementById('score-form');
  var submitBtn = document.getElementById('submit-btn');
  var serverError = document.getElementById('server-error');
  var playerSelect = document.getElementById('player-select');
  var scoreInput = document.getElementById('score-input');
  var refreshBtn = document.getElementById('refresh-btn');
  var playerCount = document.getElementById('player-count');
  var editDisplayNameInput = document.getElementById('edit-displayName');
  var editFavouriteClubInput = document.getElementById('edit-favouriteClub');
  var savePlayerBtn = document.getElementById('save-player-btn');
  var exportCsvBtn = document.getElementById('export-csv-btn');

  // Confirmation overlay elements
  var confirmationOverlay = document.getElementById('confirmation-overlay');
  var confirmPlayerName = document.getElementById('confirm-player-name');
  var confirmScore = document.getElementById('confirm-score');
  var confirmBtn = document.getElementById('confirm-btn');
  var cancelBtn = document.getElementById('cancel-btn');

  // Success toast
  var successToast = document.getElementById('success-toast');

  // QR code elements
  var qrImage = document.getElementById('qr-image');
  var qrFallback = document.getElementById('qr-fallback');

  // State: the pending submission waiting for confirmation
  var pendingSubmission = null;
  var toastTimer = null;
  var playersById = {};

  // --- Initialization ---

  loadPlayers();
  loadQRCode();

  // --- Player list ---

  function loadPlayers() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ Loading…';

    fetch('/api/players')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load players');
        }
        return response.json();
      })
      .then(function (data) {
        populatePlayerSelect(data.players || []);
      })
      .catch(function () {
        showServerError('Kunde inte hämta spelarlistan.');
      })
      .finally(function () {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '↻ Refresh';
      });
  }

  function populatePlayerSelect(players) {
    // Remember current selection
    var currentValue = playerSelect.value;

    // Clear existing options except the placeholder
    while (playerSelect.options.length > 1) {
      playerSelect.remove(1);
    }

    // Sort players alphabetically by display name
    players.sort(function (a, b) {
      return a.displayName.localeCompare(b.displayName);
    });

    playersById = {};

    // Add player options
    for (var i = 0; i < players.length; i++) {
      playersById[players[i].id] = players[i];
      var option = document.createElement('option');
      option.value = players[i].id;
      option.textContent = players[i].displayName + ' (' + players[i].favouriteClub + ')';
      playerSelect.appendChild(option);
    }

    // Restore previous selection if still available
    if (currentValue) {
      playerSelect.value = currentValue;
      // If the player no longer exists, reset to placeholder
      if (playerSelect.value !== currentValue) {
        playerSelect.value = '';
      }
    }

    // Update player count
    playerCount.textContent = players.length + ' spelare registrerade';
    syncSelectedPlayerDetails();
  }

  refreshBtn.addEventListener('click', function () {
    loadPlayers();
  });

  // --- QR Code ---

  function loadQRCode() {
    fetch('/api/qrcode')
      .then(function (response) {
        var contentType = response.headers.get('Content-Type') || '';
        if (contentType.indexOf('image/svg+xml') !== -1) {
          return response.text().then(function (svg) {
            // Convert SVG string to a data URL for the img element
            var encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            qrImage.src = encoded;
            qrImage.style.display = 'block';
            qrFallback.style.display = 'none';
          });
        } else {
          return response.text().then(function (url) {
            qrFallback.textContent = url;
            qrFallback.style.display = 'block';
            qrImage.style.display = 'none';
          });
        }
      })
      .catch(function () {
        // Silently fail — QR code is a nice-to-have on the staff page
      });
  }

  // --- Validation ---

  function validateForm() {
    var errors = {};

    if (!playerSelect.value) {
      errors.playerId = 'Välj en spelare';
    }

    var scoreVal = scoreInput.value.trim();
    if (scoreVal === '') {
      errors.score = 'Poäng krävs';
    } else {
      var num = Number(scoreVal);
      if (!Number.isInteger(num) || num <= 0) {
        errors.score = 'Poäng måste vara ett positivt heltal';
      }
    }

    return errors;
  }

  // Clear field errors on input
  playerSelect.addEventListener('change', function () {
    clearFieldError('playerId');
  });

  scoreInput.addEventListener('input', function () {
    clearFieldError('score');
  });

  // --- Form submission ---

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideServerError();

    var errors = validateForm();
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }

    // Get selected player name for confirmation
    var selectedOption = playerSelect.options[playerSelect.selectedIndex];
    var playerName = selectedOption ? selectedOption.textContent : '';
    var scoreValue = parseInt(scoreInput.value, 10);

    // Store pending submission and show confirmation
    pendingSubmission = {
      playerId: playerSelect.value,
      playerName: playerName,
      score: scoreValue
    };

    showConfirmation(playerName, scoreValue);
  });

  // --- Confirmation overlay ---

  function showConfirmation(playerName, score) {
    confirmPlayerName.textContent = playerName;
    confirmScore.textContent = score;
    confirmationOverlay.classList.add('visible');
    confirmBtn.focus();
  }

  function hideConfirmation() {
    confirmationOverlay.classList.remove('visible');
    pendingSubmission = null;
  }

  confirmBtn.addEventListener('click', function () {
    if (!pendingSubmission) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Sparar…';

    var body = {
      playerId: pendingSubmission.playerId,
      score: pendingSubmission.score
    };

    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (response) {
        return response.json().then(function (json) {
          return { ok: response.ok, status: response.status, data: json };
        });
      })
      .then(function (result) {
        if (result.ok) {
          hideConfirmation();
          showSuccessToast();
          // Clear score field but keep player list fresh
          scoreInput.value = '';
          loadPlayers();
        } else if (result.status === 400 && result.data.fields) {
          hideConfirmation();
          showFieldErrors(result.data.fields);
        } else if (result.status === 404) {
          hideConfirmation();
          showServerError('Spelaren hittades inte. Listan uppdaterades.');
          loadPlayers();
        } else {
          hideConfirmation();
          showServerError(result.data.error || 'Något gick fel. Försök igen.');
        }
      })
      .catch(function () {
        hideConfirmation();
        showServerError('Kunde inte ansluta till servern.');
      })
      .finally(function () {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Bekräfta';
      });
  });

  cancelBtn.addEventListener('click', function () {
    // Cancel: return to form with values preserved (do nothing to form fields)
    hideConfirmation();
    submitBtn.focus();
  });

  // Close overlay on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && confirmationOverlay.classList.contains('visible')) {
      hideConfirmation();
      submitBtn.focus();
    }
  });

  // --- Success toast ---

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

  // --- Error display helpers ---

  function showFieldErrors(errors) {
    clearAllFieldErrors();
    var firstErrorField = null;

    for (var field in errors) {
      if (errors.hasOwnProperty(field)) {
        var errorEl = document.getElementById(field + '-error');
        var inputEl = field === 'playerId' ? playerSelect : document.getElementById(field === 'score' ? 'score-input' : field);
        if (errorEl) {
          errorEl.textContent = errors[field];
          errorEl.classList.add('visible');
        }
        if (inputEl && inputEl.classList) {
          inputEl.classList.add('error');
        }
        if (!firstErrorField && inputEl) {
          firstErrorField = inputEl;
        }
      }
    }

    if (firstErrorField) {
      firstErrorField.focus();
    }
  }

  function clearFieldError(fieldName) {
    var errorEl = document.getElementById(fieldName + '-error');
    var inputEl = fieldName === 'playerId' ? playerSelect : document.getElementById(fieldName === 'score' ? 'score-input' : fieldName);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
    if (inputEl && inputEl.classList) {
      inputEl.classList.remove('error');
    }
  }

  function showEditError(fieldName, message) {
    var id = fieldName === 'displayName' ? 'edit-displayName-error' : 'edit-favouriteClub-error';
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
  }

  function clearEditErrors() {
    var ids = ['edit-displayName-error', 'edit-favouriteClub-error'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      el.textContent = '';
      el.classList.remove('visible');
    }
  }

  function clearAllFieldErrors() {
    clearFieldError('playerId');
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

  playerSelect.addEventListener('change', function () {
    syncSelectedPlayerDetails();
  });

  function syncSelectedPlayerDetails() {
    var player = playersById[playerSelect.value];
    if (!player) {
      editDisplayNameInput.value = '';
      editFavouriteClubInput.value = '';
      return;
    }

    editDisplayNameInput.value = player.displayName || '';
    editFavouriteClubInput.value = player.favouriteClub || '';
  }

  savePlayerBtn.addEventListener('click', function () {
    hideServerError();
    clearEditErrors();
    var playerId = playerSelect.value;
    var displayName = editDisplayNameInput.value.trim();
    var favouriteClub = editFavouriteClubInput.value.trim();

    if (!playerId) {
      showServerError('Välj en spelare att redigera.');
      return;
    }
    if (!displayName) {
      showEditError('displayName', 'Namn krävs');
      return;
    }
    if (displayName.split(/\s+/).length < 2) {
      showEditError('displayName', 'Ange förnamn och efternamn');
      return;
    }
    if (!favouriteClub) {
      showEditError('favouriteClub', 'Favoritlag krävs');
      return;
    }

    savePlayerBtn.disabled = true;
    savePlayerBtn.textContent = 'Sparar spelare…';

    fetch('/api/players/' + encodeURIComponent(playerId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: displayName, favouriteClub: favouriteClub })
    })
      .then(function (response) {
        return response.json().then(function (json) {
          return { ok: response.ok, status: response.status, data: json };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          if (result.status === 400 && result.data.fields) {
            if (result.data.fields.displayName) showEditError('displayName', result.data.fields.displayName);
            if (result.data.fields.favouriteClub) showEditError('favouriteClub', result.data.fields.favouriteClub);
            return;
          }
          showServerError(result.data.error || 'Kunde inte uppdatera spelare.');
          return;
        }

        showSuccessToast();
        loadPlayers();
      })
      .catch(function () {
        showServerError('Kunde inte ansluta till servern.');
      })
      .finally(function () {
        savePlayerBtn.disabled = false;
        savePlayerBtn.textContent = 'Spara spelarinfo';
      });
  });

  exportCsvBtn.addEventListener('click', function () {
    window.location.href = '/api/players/export/csv';
  });
})();
