/**
 * photo-submit.js
 * Client-side validation and UX for the NWK photo submission form.
 *
 * Validation performed here is for user experience only.
 * All server-side validation is handled by the backend (Netlify Forms
 * or a future serverless function). Never trust client-side validation alone.
 *
 * File constraints enforced:
 *   - Allowed MIME types: image/jpeg, image/png
 *   - Allowed extensions: .jpg, .jpeg, .png
 *   - Max file size: 8 MB
 *   - Rejected: gif, svg, heic, pdf, webp, executables
 *
 * Submission method: native multipart/form-data POST (required by Netlify Forms
 * for file attachment support). JavaScript intercepts only to run validation;
 * the browser submits the form natively if validation passes.
 */
(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */

  var ALLOWED_MIME = ['image/jpeg', 'image/png'];
  var ALLOWED_EXT  = ['.jpg', '.jpeg', '.png'];
  var MAX_BYTES    = 8 * 1024 * 1024; // 8 MB

  var REJECTED_HINTS = {
    'image/gif':  'GIF files are not accepted. Please use JPEG or PNG.',
    'image/svg+xml': 'SVG files are not accepted. Please use JPEG or PNG.',
    'image/webp': 'WebP files are not currently accepted. Please use JPEG or PNG.',
    'image/heic': 'HEIC files are not accepted. Please convert to JPEG first.',
    'application/pdf': 'PDF files are not accepted. Please upload a JPEG or PNG photo.'
  };

  /* ── Utilities ─────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }

  function sanitizeText(str, maxLen) {
    if (!str) return '';
    return str
      .trim()
      .replace(/[<>]/g, '')       /* strip angle brackets */
      .replace(/\s+/g, ' ')       /* collapse whitespace */
      .slice(0, maxLen || 500);
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fileExtension(name) {
    var parts = name.toLowerCase().split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }

  /* ── File validation ───────────────────────────────────── */

  function validateFile(file) {
    if (!file) return 'Please select a photo to upload.';

    /* Check MIME type */
    if (REJECTED_HINTS[file.type]) return REJECTED_HINTS[file.type];
    if (!ALLOWED_MIME.includes(file.type)) {
      return 'Only JPEG and PNG photos are accepted (.' +
             ALLOWED_EXT.join(', .').replace(/\./g, '') + ').';
    }

    /* Check extension (belt-and-suspenders; MIME can be spoofed client-side) */
    var ext = fileExtension(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      return 'File extension "' + ext + '" is not accepted. Please use .jpg or .png.';
    }

    /* Check size */
    if (file.size > MAX_BYTES) {
      return 'This file is ' + formatBytes(file.size) +
             ' — the maximum is 8 MB. Please reduce the file size and try again.';
    }

    if (file.size === 0) return 'The selected file appears to be empty.';

    return null; /* valid */
  }

  /* ── Field error helpers ───────────────────────────────── */

  function setFieldError(fieldEl, errorEl, message) {
    if (!fieldEl || !errorEl) return;
    var wrapper = fieldEl.closest('.form-field') || fieldEl.parentElement;
    if (wrapper) wrapper.classList.toggle('form-field--error', !!message);
    errorEl.textContent = message || '';
    fieldEl.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) fieldEl.setAttribute('aria-describedby', errorEl.id);
  }

  function clearFieldError(fieldEl, errorEl) {
    setFieldError(fieldEl, errorEl, '');
  }

  /* ── Upload area UX ────────────────────────────────────── */

  function initUploadArea() {
    var area      = $('upload-area');
    var input     = $('photo-input');
    var preview   = $('upload-preview');
    var previewImg  = $('upload-preview-img');
    var previewName = $('upload-preview-name');
    var previewSize = $('upload-preview-size');
    var removeBtn = $('upload-remove');
    var errorEl   = $('photo-error');
    if (!area || !input) return;

    function showPreview(file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        if (previewImg)  { previewImg.src = e.target.result; }
        if (previewName) { previewName.textContent = file.name; }
        if (previewSize) { previewSize.textContent = formatBytes(file.size); }
        if (preview)     { preview.classList.add('is-visible'); }
        area.classList.add('upload-area--has-file');
        area.classList.remove('upload-area--error');
      };
      reader.readAsDataURL(file);
    }

    function clearPreview() {
      if (preview)     { preview.classList.remove('is-visible'); }
      if (previewImg)  { previewImg.src = ''; }
      if (previewName) { previewName.textContent = ''; }
      if (previewSize) { previewSize.textContent = ''; }
      area.classList.remove('upload-area--has-file');
      input.value = '';
    }

    function handleFile(file) {
      var err = validateFile(file);
      if (err) {
        clearPreview();
        area.classList.add('upload-area--error');
        setFieldError(input, errorEl, err);
        return;
      }
      clearFieldError(input, errorEl);
      showPreview(file);
    }

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearPreview();
        clearFieldError(input, errorEl);
      });
    }

    /* Drag and drop */
    area.addEventListener('dragover', function (e) {
      e.preventDefault();
      area.classList.add('upload-area--dragover');
    });
    area.addEventListener('dragleave', function () {
      area.classList.remove('upload-area--dragover');
    });
    area.addEventListener('drop', function (e) {
      e.preventDefault();
      area.classList.remove('upload-area--dragover');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        /* Assign to real input so it submits with the form */
        try {
          var dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        } catch (ex) { /* DataTransfer not supported in all browsers */ }
        handleFile(file);
      }
    });
  }

  /* ── Character counters ────────────────────────────────── */

  function initCharCounters() {
    document.querySelectorAll('[data-maxlength]').forEach(function (el) {
      var max     = parseInt(el.dataset.maxlength, 10);
      var counter = document.getElementById(el.id + '-counter');
      if (!counter || !max) return;

      function update() {
        var len = el.value.length;
        counter.textContent = len + ' / ' + max;
        counter.classList.toggle('near-limit', len > max * 0.85);
        counter.classList.toggle('at-limit',   len >= max);
        if (len > max) el.value = el.value.slice(0, max);
      }
      el.addEventListener('input', update);
      update();
    });
  }

  /* ── Conditional: identifiable people ─────────────────── */

  function initConditionals() {
    var checkbox = $('identifiable-people');
    var section  = $('people-permission-section');
    if (!checkbox || !section) return;

    checkbox.addEventListener('change', function () {
      section.classList.toggle('is-visible', checkbox.checked);
      /* Require selection when visible */
      section.querySelectorAll('input[type="radio"]').forEach(function (r) {
        r.required = checkbox.checked;
      });
    });
  }

  /* ── Full form validation ──────────────────────────────── */

  function validateForm(form) {
    var valid = true;

    function check(inputId, errorId, message, condition) {
      var inp = $(inputId);
      var err = $(errorId);
      if (inp && err) {
        var failed = condition ? condition(inp) : !inp.value.trim();
        setFieldError(inp, err, failed ? message : '');
        if (failed) valid = false;
      }
    }

    /* Photo */
    var photoInput = $('photo-input');
    var photoError = $('photo-error');
    if (photoInput && photoError) {
      var photoErr = validateFile(photoInput.files && photoInput.files[0]);
      if (!photoInput.files || !photoInput.files[0]) {
        photoErr = 'Please select a photo to upload.';
      }
      setFieldError(photoInput, photoError, photoErr || '');
      if (photoErr) valid = false;
    }

    check('photo-title',    'title-error',    'Please enter a title for this photo.');
    check('photo-category', 'category-error', 'Please select a category.',
          function (el) { return !el.value; });
    check('submitter-name', 'submitter-error', 'Please enter your name.');

    /* Permission checkbox */
    var permCheckbox = $('permission-confirm');
    var permError    = $('permission-error');
    if (permCheckbox && permError) {
      setFieldError(permCheckbox, permError,
        permCheckbox.checked ? '' : 'You must confirm you have the right to share this photo.');
      if (!permCheckbox.checked) valid = false;
    }

    /* Identifiable people radio if section is visible */
    var idPeople = $('identifiable-people');
    var ppSection = $('people-permission-section');
    if (idPeople && idPeople.checked && ppSection) {
      var anySelected = !!form.querySelector('input[name="people-permission"]:checked');
      var ppError = $('people-permission-error');
      if (ppError) {
        setFieldError(ppSection.querySelector('input[type="radio"]'), ppError,
          anySelected ? '' : 'Please select a permission status for the identifiable people shown.');
        if (!anySelected) valid = false;
      }
    }

    return valid;
  }

  /* ── Form submission ───────────────────────────────────── */

  function initForm() {
    var form      = $('photo-submit-form');
    var submitBtn = $('submit-btn');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      /* Block submission only when client-side validation fails. */
      if (!validateForm(form)) {
        e.preventDefault();
        var firstError = form.querySelector('.form-field--error');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      /* Sanitize text fields before the browser sends the POST. */
      ['photo-title', 'location', 'photographer', 'caption', 'tags',
       'related-event', 'people-shown', 'submitter-name'].forEach(function (id) {
        var el = $(id);
        if (el) el.value = sanitizeText(el.value, parseInt(el.dataset.maxlength || '500', 10));
      });

      /* Show loading state; the page will navigate away once Netlify processes the POST. */
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn--loading');
        submitBtn.textContent = 'Submitting…';
      }

      /*
       * Native multipart/form-data POST proceeds from here.
       * Netlify Forms requires a native browser POST (not fetch/XHR) for file attachments.
       * On success Netlify redirects to the form's action URL.
       */
    });

    /* Live validation on blur */
    form.querySelectorAll('input[required], select[required], textarea[required]')
      .forEach(function (el) {
        el.addEventListener('blur', function () {
          validateForm(form);
        });
      });
  }

  /* ── Bootstrap ─────────────────────────────────────────── */

  function init() {
    initUploadArea();
    initCharCounters();
    initConditionals();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
