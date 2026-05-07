// Registration form client-side logic
(function () {
  'use strict';

  // DOM elements
  var form = document.getElementById('registration-form');
  var submitBtn = document.getElementById('submit-btn');
  var serverError = document.getElementById('server-error');
  var successScreen = document.getElementById('success-screen');
  var successPlayerName = document.getElementById('success-player-name');

  var displayNameInput = document.getElementById('displayName');
  var favouriteClubInput = document.getElementById('favouriteClub');
  var emailInput = document.getElementById('email');
  var emailConsentInput = document.getElementById('emailConsent');
  var gdprConsentInput = document.getElementById('gdprConsent');
  var consentGroup = document.getElementById('consent-group');

  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Show/hide consent checkbox based on email field content
  emailInput.addEventListener('input', function () {
    var hasEmail = emailInput.value.trim().length > 0;
    if (hasEmail) {
      consentGroup.classList.add('visible');
    } else {
      consentGroup.classList.remove('visible');
      emailConsentInput.checked = false;
      clearFieldError('emailConsent');
    }
  });

  // Clear field errors on input
  displayNameInput.addEventListener('input', function () {
    clearFieldError('displayName');
  });
  favouriteClubInput.addEventListener('input', function () {
    clearFieldError('favouriteClub');
  });
  emailInput.addEventListener('input', function () {
    clearFieldError('email');
  });
  emailConsentInput.addEventListener('change', function () {
    clearFieldError('emailConsent');
  });
  gdprConsentInput.addEventListener('change', function () {
    clearFieldError('gdprConsent');
  });

  // Form submission
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideServerError();

    var data = getFormData();
    var errors = validateRegistration(data);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }

    submitRegistration(data);
  });

  function getFormData() {
    return {
      displayName: displayNameInput.value,
      favouriteClub: favouriteClubInput.value,
      email: emailInput.value.trim(),
      emailConsent: emailConsentInput.checked,
      gdprConsent: gdprConsentInput.checked
    };
  }

  /**
   * Client-side validation mirroring server-side rules.
   * Returns an object of field -> error message.
   */
  function validateRegistration(data) {
    var errors = {};

    // displayName: required, 1-50 chars, trimmed
    var trimmedName = (data.displayName || '').trim();
    if (trimmedName.length === 0) {
      errors.displayName = 'Namn krävs';
    } else if (trimmedName.length > 50) {
      errors.displayName = 'Namn får vara max 50 tecken';
    }

    // favouriteClub: required, 1-100 chars, trimmed
    var trimmedClub = (data.favouriteClub || '').trim();
    if (trimmedClub.length === 0) {
      errors.favouriteClub = 'Favoritlag krävs';
    } else if (trimmedClub.length > 100) {
      errors.favouriteClub = 'Favoritlag får vara max 100 tecken';
    }

    // email: optional; if provided, must match email regex
    var hasEmail = data.email && data.email.length > 0;
    if (hasEmail) {
      if (!EMAIL_REGEX.test(data.email)) {
        errors.email = 'Ogiltig e-postadress';
      }
    }

    // emailConsent: required and true if email is provided
    if (hasEmail && !data.emailConsent) {
      errors.emailConsent = 'Samtycke krävs när e-post anges';
    }

    if (!data.gdprConsent) {
      errors.gdprConsent = 'Du måste godkänna GDPR-hantering';
    }

    return errors;
  }

  function submitRegistration(data) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrerar…';

    // Build request body — only include email/consent if email is provided
    var body = {
      displayName: data.displayName.trim(),
      favouriteClub: data.favouriteClub.trim()
    };

    if (data.email && data.email.length > 0) {
      body.email = data.email;
      body.emailConsent = data.emailConsent;
    }
    body.gdprConsent = data.gdprConsent;

    fetch('/api/players', {
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
          showSuccess(result.data.displayName || data.displayName.trim());
        } else if (result.status === 400 && result.data.fields) {
          showFieldErrors(result.data.fields);
          resetSubmitButton();
        } else {
          showServerError(result.data.error || 'Något gick fel. Försök igen.');
          resetSubmitButton();
        }
      })
      .catch(function () {
        showServerError('Kunde inte ansluta till servern. Kontrollera anslutningen och försök igen.');
        resetSubmitButton();
      });
  }

  function showSuccess(playerName) {
    form.style.display = 'none';
    var privacyNotice = document.querySelector('.privacy-notice');
    if (privacyNotice) {
      privacyNotice.style.display = 'none';
    }
    successPlayerName.textContent = playerName;
    successScreen.classList.add('visible');
  }

  function showFieldErrors(errors) {
    clearAllFieldErrors();
    var firstErrorField = null;

    for (var field in errors) {
      if (errors.hasOwnProperty(field)) {
        var errorEl = document.getElementById(field + '-error');
        var inputEl = document.getElementById(field);
        if (errorEl) {
          errorEl.textContent = errors[field];
          errorEl.classList.add('visible');
        }
        if (inputEl && inputEl.classList && inputEl.type !== 'checkbox') {
          inputEl.classList.add('error');
        }
        if (!firstErrorField && inputEl) {
          firstErrorField = inputEl;
        }
      }
    }

    // Focus the first field with an error
    if (firstErrorField) {
      firstErrorField.focus();
    }
  }

  function clearFieldError(fieldName) {
    var errorEl = document.getElementById(fieldName + '-error');
    var inputEl = document.getElementById(fieldName);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
    if (inputEl && inputEl.classList) {
      inputEl.classList.remove('error');
    }
  }

  function clearAllFieldErrors() {
    var fields = ['displayName', 'favouriteClub', 'email', 'emailConsent', 'gdprConsent'];
    for (var i = 0; i < fields.length; i++) {
      clearFieldError(fields[i]);
    }
  }

  function showServerError(message) {
    serverError.textContent = message;
    serverError.classList.add('visible');
  }

  function hideServerError() {
    serverError.textContent = '';
    serverError.classList.remove('visible');
  }

  function resetSubmitButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Registrera';
  }
})();
