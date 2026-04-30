/* ============================================================
   Feature Flag: set to true to show the privacy notice banner,
   false to skip it and enable the voice concierge immediately.
   ============================================================ */
var PRIVACY_NOTICE_ENABLED = false;

/* ============================================================
   Privacy Consent
   ============================================================ */
(function () {
  var banner    = document.getElementById('privacy-banner');
  var acceptBtn = document.getElementById('privacy-accept');
  var declineBtn = document.getElementById('privacy-decline');
  var wrapper   = document.getElementById('va-toast-wrapper');

  var consent = localStorage.getItem('privacyConsent');

  function showBanner() {
    if (wrapper) wrapper.style.display = 'none';
    banner.classList.add('show');
    banner.offsetHeight;
    banner.classList.add('visible');
  }

  window._showPrivacyBanner = showBanner;

  function enableVoice() {
    var toast = document.getElementById('va-toast');
    if (toast) toast.classList.remove('va-consent-declined');
    var label = document.getElementById('va-toast-label');
    if (label) label.textContent = 'Ask me about:';
    var rotating = document.getElementById('va-toast-rotating');
    if (rotating) rotating.style.display = '';
    var pillHint = document.querySelector('.va-toast-pill-hint');
    if (pillHint) pillHint.textContent = 'Tap to speak';
    var cardPrimary = document.querySelector('.va-toast-card-primary');
    if (cardPrimary) cardPrimary.textContent = 'Voice Assistant';
    var cardSecondary = document.querySelector('.va-toast-card-secondary');
    if (cardSecondary) cardSecondary.textContent = 'Swipe \u2191 to speak';
    if (wrapper) wrapper.style.display = '';
    window.dispatchEvent(new CustomEvent('privacy-consent-granted'));
  }

  function declineVoice() {
    var isMobileUA = /Mobi|Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent || '');
    var toast = document.getElementById('va-toast');
    if (wrapper) wrapper.style.display = '';
    if (toast) {
      toast.classList.add('va-consent-declined');
      if (isMobileUA) {
        requestAnimationFrame(function() {
          toast.classList.add('va-toast--visible');
        });
      }
    }
    var label = document.getElementById('va-toast-label');
    if (label) label.textContent = 'Tap to enable voice';
    var rotating = document.getElementById('va-toast-rotating');
    if (rotating) rotating.style.display = 'none';
    var pillHint = document.querySelector('.va-toast-pill-hint');
    if (pillHint) pillHint.textContent = 'Disabled';
    var cardPrimary = document.querySelector('.va-toast-card-primary');
    if (cardPrimary) cardPrimary.textContent = 'Tap to enable voice';
    var cardSecondary = document.querySelector('.va-toast-card-secondary');
    if (cardSecondary) cardSecondary.textContent = 'Tap to enable';
  }

  function dismissBanner() {
    banner.classList.remove('visible');
    setTimeout(function () { banner.classList.remove('show'); }, 500);
  }

  function handleConsent(accepted) {
    localStorage.setItem('privacyConsent', accepted ? 'allowed' : 'declined');
    dismissBanner();
    if (accepted) enableVoice(); else declineVoice();
  }

  if (!PRIVACY_NOTICE_ENABLED) {
    enableVoice();
  } else if (consent === 'allowed') {
    enableVoice();
  } else if (consent === 'declined') {
    declineVoice();
  } else {
    setTimeout(function () {
      showBanner();
    }, 1500);
  }

  acceptBtn.addEventListener('click', function () { handleConsent(true); });
  declineBtn.addEventListener('click', function () { handleConsent(false); });
}());

/* ============================================================
   Voice Concierge
   ============================================================ */
(function() {
  var toast = document.getElementById('va-toast');
  var label = document.getElementById('va-toast-label');

  var status = 'idle'; // idle | connecting | listening | speaking | error | mic-blocked
  var conversation = null;
  var ending = false;
  var endingTimer = null;
  var sessionGen = 0;
  var voiceStartTime = null;

  var AGENT_ID = 'agent_4401kqda2ghffyq9x6pkmn4wf2ds';

  // ─── Wave animation constants ────────────────────────────────────────────
  // 20 frequency bin indices, logarithmically spaced across 80–4000 Hz.
  var WAVE_BINS = [3, 4, 5, 6, 8, 10, 12, 14, 18, 22, 27, 33, 40, 49, 60, 74, 91, 112, 137, 169];
  // 10-bar subset for the desktop dock
  var DOCK_BINS = [3, 5, 8, 12, 18, 27, 40, 60, 91, 137];
  var WAVE_MIN = 3, WAVE_MAX = 22, WAVE_SMOOTH = 0.35;

  // Smoothing arrays (pre-allocated floats)
  var dockSmoothed = new Array(10).fill(WAVE_MIN);
  var mobileSmoothed = new Array(20).fill(WAVE_MIN);
  var dockRafId = null;
  var mobileRafId = null;

  // Pre-load SDK at page load so it's ready when the user taps
  var sdkPromise = import('https://cdn.jsdelivr.net/npm/@elevenlabs/client@0.15.2/+esm');

  var LABELS = {
    idle: 'Ask me about:',
    connecting: 'Connecting\u2026',
    listening: 'Listening\u2026',
    speaking: 'Speaking\u2026',
    error: 'Allow microphone access',
    'mic-blocked': 'Allow microphone access'
  };

  var cardSecondary = document.querySelector('.va-toast-card-secondary');
  var isMobile = function() { return window.innerWidth <= 480; };

  var hasSeenReady = false;

  var setStatus = function(s) {
    status = s;

    if (!toast.classList.contains('va-consent-declined')) {
      label.textContent = LABELS[s] || '';
    }

    if (rotatingEl) {
      rotatingEl.style.display = (s === 'idle') ? '' : 'none';
    }

    if (cardSecondary && s !== 'idle') {
      var isSessionState = s === 'connecting' || s === 'listening' || s === 'speaking';
      cardSecondary.textContent = isSessionState ? 'Swipe \u2193 to end' : (LABELS[s] || '');
    }

    var isActive = s === 'listening' || s === 'speaking';
    var isConnecting = s === 'connecting';

    var wasDeclined = toast.classList.contains('va-consent-declined');
    var wasVisible  = toast.classList.contains('va-toast--visible');
    var wasReady    = toast.classList.contains('va-toast--ready');
    var classes = [
      'va-toast',
      (isActive || isConnecting) ? 'session-active' : '',
      (isActive || isConnecting) ? 'active' : '',
      isConnecting ? 'connecting' : '',
      s === 'speaking' ? 'speaking' : '',
      (s === 'error' || s === 'mic-blocked') ? 'error' : ''
    ].filter(Boolean).join(' ');

    toast.className = classes;
    if (wasDeclined) toast.classList.add('va-consent-declined');
    if (wasVisible)  toast.classList.add('va-toast--visible');
    if (wasReady && !isActive && !isConnecting) toast.classList.add('va-toast--ready');

    toast.setAttribute('aria-label',
      isActive ? 'Assistant active' :
      s === 'mic-blocked' ? 'Microphone access required' :
      s === 'error' ? 'Assistant unavailable' :
      'Open assistant'
    );
  };

  // ─── Real-time wave animation ───────────────────────────────────────────

  function stopDockWave() {
    if (dockRafId) { cancelAnimationFrame(dockRafId); dockRafId = null; }
    dockSmoothed.fill(WAVE_MIN);
    var bars = document.querySelectorAll('#va-dock-wave span');
    bars.forEach(function(b) { b.style.height = WAVE_MIN + 'px'; });
  }

  function startDockWave() {
    if (isMobile()) return;
    var bars = document.querySelectorAll('#va-dock-wave span');
    if (!bars.length) return;

    function tick() {
      var s = status;
      if (s !== 'listening' && s !== 'speaking' && s !== 'connecting') {
        stopDockWave();
        return;
      }
      var freqData;
      try {
        freqData = s === 'speaking'
          ? conversation && conversation.getOutputByteFrequencyData()
          : conversation && conversation.getInputByteFrequencyData();
      } catch(e) { freqData = null; }

      if (freqData && freqData.length > 0) {
        DOCK_BINS.forEach(function(bin, i) {
          var raw = bin < freqData.length ? freqData[bin] : 0;
          var target = WAVE_MIN + (raw / 255) * (WAVE_MAX - WAVE_MIN);
          dockSmoothed[i] = dockSmoothed[i] * (1 - WAVE_SMOOTH) + target * WAVE_SMOOTH;
          if (bars[i]) bars[i].style.height = dockSmoothed[i].toFixed(1) + 'px';
        });
      } else {
        DOCK_BINS.forEach(function(bin, i) {
          dockSmoothed[i] = dockSmoothed[i] * (1 - WAVE_SMOOTH) + WAVE_MIN * WAVE_SMOOTH;
          if (bars[i]) bars[i].style.height = dockSmoothed[i].toFixed(1) + 'px';
        });
      }
      dockRafId = requestAnimationFrame(tick);
    }
    dockRafId = requestAnimationFrame(tick);
  }

  function stopMobileWave() {
    if (mobileRafId) { cancelAnimationFrame(mobileRafId); mobileRafId = null; }
    mobileSmoothed.fill(WAVE_MIN);
    var bars = document.querySelectorAll('#va-mobile-wave span');
    bars.forEach(function(b) { b.style.height = WAVE_MIN + 'px'; });
  }

  function startMobileWave() {
    if (!isMobile()) return;
    var bars = document.querySelectorAll('#va-mobile-wave span');
    if (!bars.length) return;

    function tick() {
      var s = status;
      if (s !== 'listening' && s !== 'speaking' && s !== 'connecting') {
        stopMobileWave();
        return;
      }
      var freqData;
      try {
        freqData = s === 'speaking'
          ? conversation && conversation.getOutputByteFrequencyData()
          : conversation && conversation.getInputByteFrequencyData();
      } catch(e) { freqData = null; }

      if (freqData && freqData.length > 0) {
        WAVE_BINS.forEach(function(bin, i) {
          var raw = bin < freqData.length ? freqData[bin] : 0;
          var target = WAVE_MIN + (raw / 255) * (WAVE_MAX - WAVE_MIN);
          mobileSmoothed[i] = mobileSmoothed[i] * (1 - WAVE_SMOOTH) + target * WAVE_SMOOTH;
          if (bars[i]) bars[i].style.height = mobileSmoothed[i].toFixed(1) + 'px';
        });
      } else {
        WAVE_BINS.forEach(function(bin, i) {
          mobileSmoothed[i] = mobileSmoothed[i] * (1 - WAVE_SMOOTH) + WAVE_MIN * WAVE_SMOOTH;
          if (bars[i]) bars[i].style.height = mobileSmoothed[i].toFixed(1) + 'px';
        });
      }
      mobileRafId = requestAnimationFrame(tick);
    }
    mobileRafId = requestAnimationFrame(tick);
  }

  // ─── Client tools ──────────────────────────────────────────────────────
  var clientTools = {
    navigate: function(params) {
      var el = document.getElementById(params.section);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return 'Navigated successfully';
    },

    end_session: function() {
      ending = true;
      if (status === 'listening') {
        endingTimer = setTimeout(function() { endSession(); }, 1500);
      }
      setTimeout(function() {
        if (ending) endSession();
      }, 15000);
      return 'Session ending';
    },

    fill_form_field: function(params) {
      var FIELD_MAP = {
        name: 'cf-name',
        phone: 'cf-phone',
        message: 'cf-message'
      };
      var elId = FIELD_MAP[params.field];
      if (!elId) return 'Unknown field: ' + params.field;
      var el = document.getElementById(elId);
      if (!el) return 'Field not found';
      el.value = params.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'Set ' + params.field + ' to: ' + params.value;
    },

    submit_form: function() {
      var form = document.getElementById('contact-form');
      if (!form) return 'Form not found';
      var name = document.getElementById('cf-name').value;
      var phone = document.getElementById('cf-phone').value;
      if (!name || !phone) return 'Missing required fields: name and phone must be filled';
      form.requestSubmit();
      return 'Form submitted successfully';
    }
  };

  async function startSession() {
    if (conversation || status === 'connecting') return;

    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
      setStatus('error');
      setTimeout(function() { if (status === 'error') setStatus('idle'); }, 4000);
      return;
    }

    sessionGen++;
    var myGen = sessionGen;
    setStatus('connecting');
    ending = false;
    if (isMobile()) { toast.style.transition = ''; toast.style.transform = ''; }

    try {
      if (!sdkPromise) sdkPromise = import('https://cdn.jsdelivr.net/npm/@elevenlabs/client@0.15.2/+esm');
      var mod;
      try { mod = await sdkPromise; } catch(e) { sdkPromise = null; throw e; }
      var Conversation = mod.Conversation;

      if (myGen !== sessionGen) return;

      var conv = await Conversation.startSession({
        agentId: AGENT_ID,

        dynamicVariables: {
          current_date: new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          }),
          current_time: new Date().toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
          })
        },

        onConnect: function() {
          if (myGen !== sessionGen) return;
          voiceStartTime = Date.now();
          setStatus('listening');
          if (isMobile()) startMobileWave(); else startDockWave();
          if (window._analytics) window._analytics.send('voice_start');
        },

        onDisconnect: function() {
          if (myGen !== sessionGen) return;
          stopDockWave();
          stopMobileWave();
          if (window._analytics) window._analytics.send('voice_end', {
            duration_ms: voiceStartTime ? Date.now() - voiceStartTime : null
          });
          conversation = null;
          setStatus('idle');
        },

        onModeChange: function(data) {
          if (myGen !== sessionGen) return;
          if (data.mode === 'speaking') {
            setStatus('speaking');
            if (endingTimer) { clearTimeout(endingTimer); endingTimer = null; }
          } else {
            setStatus('listening');
          }
          if (isMobile()) { stopMobileWave(); startMobileWave(); }
          else { stopDockWave(); startDockWave(); }
          if (data.mode === 'listening' && ending) {
            endingTimer = setTimeout(function() { endSession(); }, 1500);
          }
        },

        onError: function() {
          if (myGen !== sessionGen) return;
          if (window._analytics) window._analytics.send('voice_error', { error_type: 'session_error' });
          conversation = null;
          setStatus('error');
          setTimeout(function() { if (status === 'error') setStatus('idle'); }, 4000);
        },

        clientTools: clientTools
      });

      if (myGen !== sessionGen) {
        try { conv.endSession(); } catch(e) {}
        return;
      }
      conversation = conv;

    } catch (e) {
      if (myGen !== sessionGen) return;
      conversation = null;
      var micDenied = e && (e.name === 'NotAllowedError' || e.name === 'NotFoundError' ||
        (e.message && /microphone|permission|not allowed/i.test(e.message)));
      if (micDenied) {
        if (window._analytics) window._analytics.send('voice_error', { error_type: 'mic_blocked' });
        setStatus('mic-blocked');
      } else {
        setStatus('error');
        setTimeout(function() { if (status === 'error') setStatus('idle'); }, 4000);
      }
    }
  }

  function endSession() {
    sessionGen++;
    ending = false;
    stopDockWave();
    stopMobileWave();
    if (endingTimer) { clearTimeout(endingTimer); endingTimer = null; }
    voiceStartTime = null;
    var conv = conversation;
    conversation = null;
    if (conv) {
      try { conv.endSession(); } catch(e) {}
    }
    setStatus('idle');
  }

  setStatus('idle');

  // ─── Mobile: set initial secondary text ─────────────────────────────────
  if (cardSecondary) {
    cardSecondary.textContent = 'Swipe \u2191 to speak';
  }

  // ─── Helper: expand toast to ready state (mobile) ────────────────────────
  function showReady() {
    if (!isMobile()) return;
    toast.classList.remove('session-active');
    toast.classList.add('va-toast--ready');
  }

  function collapseToast() {
    toast.classList.remove('va-toast--ready');
    toast.classList.remove('session-active');
    toast.style.transform = '';
    if (cardSecondary) cardSecondary.textContent = 'Swipe ↑ to speak';
  }

  // ─── Desktop: rotating words + attention pulse on load ─────────────────
  var rotateWords = ['programs', 'schedule', 'enrollment', 'about us', 'certifications', 'contact'];
  var rotateIndex = 0;
  var rotateInterval = null;
  var rotatingEl = document.getElementById('va-toast-rotating');

  var measurer = document.createElement('span');
  measurer.className = 'va-toast-rotating-word';
  measurer.style.cssText = 'position:absolute;visibility:hidden;height:auto;width:auto;white-space:nowrap;pointer-events:none';
  if (rotatingEl) rotatingEl.appendChild(measurer);

  function measureWord(word) {
    measurer.textContent = word;
    return Math.ceil(measurer.getBoundingClientRect().width);
  }

  if (rotatingEl) {
    var firstWord = rotatingEl.querySelector('.va-toast-rotating-word:not([style])');
    if (firstWord) {
      rotatingEl.style.width = measureWord(firstWord.textContent) + 'px';
    }
  }

  function startWordRotation() {
    if (rotateInterval || isMobile()) return;
    rotateInterval = setInterval(function() {
      if (!rotatingEl) return;
      var current = rotatingEl.querySelector('.va-toast-rotating-word:not([style])');
      if (!current) return;

      var nextIndex = (rotateIndex + 1) % rotateWords.length;
      var nextWidth = measureWord(rotateWords[nextIndex]);
      rotatingEl.style.width = nextWidth + 'px';

      current.classList.add('flip-out');

      setTimeout(function() {
        rotateIndex = nextIndex;

        var next = document.createElement('span');
        next.className = 'va-toast-rotating-word flip-in';
        next.textContent = rotateWords[rotateIndex];
        rotatingEl.appendChild(next);

        current.remove();

        next.addEventListener('animationend', function() {
          next.classList.remove('flip-in');
        });
      }, 350);
    }, 2500);
  }

  function stopWordRotation() {
    if (rotateInterval) {
      clearInterval(rotateInterval);
      rotateInterval = null;
    }
  }

  function initDesktopPill() {
    if (isMobile()) return;

    toast.classList.add('va-toast--attention');
    toast.addEventListener('animationend', function onEnd() {
      toast.classList.remove('va-toast--attention');
      toast.removeEventListener('animationend', onEnd);
    });

    startWordRotation();

    setTimeout(function() {
      var mic = document.querySelector('.va-toast-mic');
      if (!mic) return;
      var rings = 0;
      function ring() {
        mic.classList.add('va-toast-mic--ring');
        mic.addEventListener('animationend', function onEnd() {
          mic.classList.remove('va-toast-mic--ring');
          mic.removeEventListener('animationend', onEnd);
          rings++;
          if (rings < 3) setTimeout(ring, 1500);
        });
      }
      ring();
    }, 5000);
  }

  function onScrollExpand() {
    // Mobile scroll no longer triggers auto-expand; initVoiceUI handles it.
  }

  function initVoiceUI() {
    if (!isMobile()) {
      initDesktopPill();
    } else {
      toast.classList.add('va-toast--visible');
      if (!hasSeenReady) {
        setTimeout(function() {
          if (status === 'idle' && !toast.classList.contains('va-consent-declined')) {
            showReady();
          }
        }, 1500);
      }
    }
  }

  if (!PRIVACY_NOTICE_ENABLED || localStorage.getItem('privacyConsent') === 'allowed') {
    initVoiceUI();
  } else {
    window.addEventListener('privacy-consent-granted', function onConsent() {
      window.removeEventListener('privacy-consent-granted', onConsent);
      if (isMobile()) {
        toast.classList.add('va-toast--visible');
        hasSeenReady = false;
      }
      initVoiceUI();
    });
  }

  if (!isMobile()) {
    startWordRotation();
  }

  window.addEventListener('scroll', onScrollExpand, { passive: true });

  // Stop/resume word rotation on session state changes
  var _origSetStatus = setStatus;
  setStatus = function(s) {
    _origSetStatus(s);
    if (!isMobile()) {
      if (s === 'idle') {
        startWordRotation();
      } else {
        stopWordRotation();
      }
    }
    if (isMobile() && s === 'idle') {
      hasSeenReady = true;
      collapseToast();
      if (toast.classList.contains('va-toast--visible')) {
        toast.style.transition = '';
        void toast.offsetHeight;
        toast.style.transform = '';
      }
    }
  };

  // ─── Toast click handler ─────────────────────────────────────────────────
  toast.addEventListener('click', function(e) {
    if (toast.classList.contains('va-consent-declined')) {
      if (window._showPrivacyBanner) window._showPrivacyBanner();
      return;
    }

    if (!isMobile() && toast.classList.contains('session-active')) {
      endSession();
      return;
    }
    if (toast.classList.contains('session-active')) return;

    if (isMobile()) {
      var isReady = toast.classList.contains('va-toast--ready');

      if (!isReady) {
        showReady();
      } else {
        startSession();
      }
    } else {
      if (status === 'idle' || status === 'mic-blocked') startSession();
    }
  });

  toast.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (toast.classList.contains('session-active')) return;
      if (status === 'idle' || status === 'mic-blocked') startSession();
    }
  });

  // ─── Close button: end session or collapse ────────────────────────────────
  document.getElementById('va-toast-close').addEventListener('click', function(e) {
    e.stopPropagation();
    if (toast.classList.contains('session-active')) {
      endSession();
    } else if (isMobile() && toast.classList.contains('va-toast--ready')) {
      hasSeenReady = true;
      collapseToast();
    }
  });

  // ─── Pill close button (desktop): end session ────────────────────────────
  document.getElementById('va-toast-pill-close').addEventListener('click', function(e) {
    e.stopPropagation();
    if (toast.classList.contains('session-active')) {
      endSession();
    }
  });

  // ─── Mobile swipe gesture: translateY physics ────────────────────────────
  (function() {
    if (!isMobile()) return;

    var TOAST_H  = 180;
    var PEEK_Y   = 70;
    var READY_Y  = 52;
    var ACTIVE_Y = 0;
    var swipeLocked = false;
    var swipeLockTimer = null;

    var startY = 0, currentY = 0, dragging = false, hasMoved = false, gestureRestY = PEEK_Y;

    function getCurrentY() {
      var inline = toast.style.transform;
      if (inline) {
        var m = inline.match(/translateY\(([\d.-]+)px\)/);
        if (m) return parseFloat(m[1]);
      }
      if (toast.classList.contains('session-active')) return ACTIVE_Y;
      if (toast.classList.contains('va-toast--ready')) return READY_Y;
      if (toast.classList.contains('va-toast--visible')) return PEEK_Y;
      return TOAST_H;
    }

    function snapTo(targetY) {
      toast.style.transition = '';
      void toast.offsetHeight;
      toast.style.transform = 'translateY(' + targetY + 'px)';
    }

    function lockSwipe() {
      swipeLocked = true;
      if (swipeLockTimer) clearTimeout(swipeLockTimer);
      swipeLockTimer = setTimeout(function() { swipeLocked = false; }, 500);
    }

    function onStart(e) {
      if (e.touches.length !== 1) return;
      var closeBtn = document.getElementById('va-toast-close');
      if (closeBtn && (e.target === closeBtn || closeBtn.contains(e.target))) return;
      e.preventDefault();
      startY = e.touches[0].clientY;
      currentY = startY;
      dragging = true;
      hasMoved = false;
      gestureRestY = getCurrentY();
      toast.style.transition = 'none';
      toast.style.transform = 'translateY(' + gestureRestY + 'px)';
    }

    function onMove(e) {
      if (!dragging) return;
      if (e.touches.length !== 1) { dragging = false; snapTo(gestureRestY); return; }
      e.preventDefault();
      currentY = e.touches[0].clientY;
      var dy = currentY - startY;
      if (Math.abs(dy) >= 2) hasMoved = true;
      if (!hasMoved) return;

      var rawY = gestureRestY + dy;
      var clampedY;
      if (gestureRestY === PEEK_Y) {
        clampedY = rawY < PEEK_Y
          ? Math.max(ACTIVE_Y, rawY)
          : PEEK_Y + (rawY - PEEK_Y) * 0.15;
      } else {
        clampedY = rawY > gestureRestY
          ? Math.min(TOAST_H, rawY)
          : gestureRestY + (rawY - gestureRestY) * 0.08;
      }
      toast.style.transform = 'translateY(' + clampedY + 'px)';
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      var dy = currentY - startY;

      if (!hasMoved) {
        if (toast.classList.contains('va-consent-declined') && window._showPrivacyBanner) {
          window._showPrivacyBanner();
        }
        snapTo(gestureRestY);
        return;
      }
      if (swipeLocked) { snapTo(gestureRestY); return; }

      var THRESHOLD = 50;
      var isActive = toast.classList.contains('session-active');
      var isReady  = toast.classList.contains('va-toast--ready');

      if (dy < -THRESHOLD) {
        if (toast.classList.contains('va-consent-declined')) {
          if (window._showPrivacyBanner) window._showPrivacyBanner();
          snapTo(gestureRestY);
          return;
        }
        lockSwipe();
        if (gestureRestY === PEEK_Y) {
          if (hasSeenReady) {
            showReady();
            startSession();
            requestAnimationFrame(function() { requestAnimationFrame(function() { snapTo(ACTIVE_Y); }); });
          } else {
            showReady();
            requestAnimationFrame(function() { requestAnimationFrame(function() { snapTo(READY_Y); }); });
          }
        } else if (isReady) {
          startSession();
          requestAnimationFrame(function() { requestAnimationFrame(function() { snapTo(ACTIVE_Y); }); });
        } else {
          snapTo(gestureRestY);
        }
      } else if (dy > THRESHOLD) {
        lockSwipe();
        if (isActive) {
          snapTo(PEEK_Y);
          endSession();
        } else if (isReady) {
          hasSeenReady = true;
          collapseToast();
          requestAnimationFrame(function() { requestAnimationFrame(function() { snapTo(PEEK_Y); }); });
        } else {
          snapTo(PEEK_Y);
        }
      } else {
        snapTo(gestureRestY);
      }
    }

    function onCancel() { dragging = false; hasMoved = false; snapTo(gestureRestY); }

    toast.addEventListener('touchstart', onStart, { passive: false });
    toast.addEventListener('touchmove', onMove, { passive: false });
    toast.addEventListener('touchend', onEnd);
    toast.addEventListener('touchcancel', onCancel);
  })();

})();
