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
      emailConsent: emailConsentInput.checked
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
      errors.displayName = 'Display name is required';
    } else if (trimmedName.length > 50) {
      errors.displayName = 'Display name must be 50 characters or fewer';
    }

    // favouriteClub: required, 1-100 chars, trimmed
    var trimmedClub = (data.favouriteClub || '').trim();
    if (trimmedClub.length === 0) {
      errors.favouriteClub = 'Favourite club is required';
    } else if (trimmedClub.length > 100) {
      errors.favouriteClub = 'Favourite club must be 100 characters or fewer';
    }

    // email: optional; if provided, must match email regex
    var hasEmail = data.email && data.email.length > 0;
    if (hasEmail) {
      if (!EMAIL_REGEX.test(data.email)) {
        errors.email = 'Email must be a valid email address';
      }
    }

    // emailConsent: required and true if email is provided
    if (hasEmail && !data.emailConsent) {
      errors.emailConsent = 'Consent is required when providing an email address';
    }

    return errors;
  }

  function submitRegistration(data) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering…';

    // Build request body — only include email/consent if email is provided
    var body = {
      displayName: data.displayName.trim(),
      favouriteClub: data.favouriteClub.trim()
    };

    if (data.email && data.email.length > 0) {
      body.email = data.email;
      body.emailConsent = data.emailConsent;
    }

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
          showServerError(result.data.error || 'Something went wrong. Please try again.');
          resetSubmitButton();
        }
      })
      .catch(function () {
        showServerError('Unable to connect to the server. Please check your connection and try again.');
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
    var fields = ['displayName', 'favouriteClub', 'email', 'emailConsent'];
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
    submitBtn.textContent = 'Register';
  }
})();
