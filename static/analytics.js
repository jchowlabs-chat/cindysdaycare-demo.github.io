/* ============================================================
   Analytics Beacon — Cindy's Daycare
   ============================================================ */
(function () {
  var ANALYTICS_URL = 'https://cindys-daycare-dashboard.jchow-a27.workers.dev/api/event';

  // Per-tab session ID (no cookies, no PII)
  var sid = sessionStorage.getItem('_sid');
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('_sid', sid); }

  // Device classification
  var ua = navigator.userAgent || '';
  var isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  var isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  var deviceType = isTablet ? 'tablet' : (isMobileDevice ? 'mobile' : 'desktop');
  var screenSize = screen.width + 'x' + screen.height;

  // Bot detection
  var isBot = /bot|crawl|spider|slurp|gptbot|claudebot|bytespider|amazonbot|facebookexternalhit|linkedinbot|twitterbot|whatsapp|bingpreview|yandex|baidu|duckduckbot|semrush|ahrefs|mj12bot|dotbot|petalbot/i.test(ua)
    || !!navigator.webdriver
    || !navigator.languages || navigator.languages.length === 0;

  var pageLoadTime = Date.now();

  function send(eventType, data) {
    var payload = {
      event_type: eventType,
      session_id: sid,
      device_type: deviceType,
      screen_size: screenSize,
      referrer: document.referrer || null,
      user_agent: ua,
      is_bot: isBot ? 1 : 0,
      timestamp: Date.now()
    };
    if (data) { for (var k in data) { if (data.hasOwnProperty(k)) payload[k] = data[k]; } }
    fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {});
  }

  // Page view
  send('page_view', { slug: window.location.pathname });

  // Section visibility tracking
  var sectionsSeen = {};
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !sectionsSeen[e.target.id]) {
        sectionsSeen[e.target.id] = true;
        send('section_view', { section_id: e.target.id });
      }
    });
  }, { threshold: 0.5 });
  ['home', 'gallery', 'about', 'testimonials', 'neighborhood', 'contact'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  // Scroll depth tracking
  var maxScrollPct = 0;
  window.addEventListener('scroll', function () {
    var pct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
    if (pct > maxScrollPct) maxScrollPct = pct;
  }, { passive: true });

  // Session end
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      send('session_end', {
        duration_ms: Date.now() - pageLoadTime,
        max_scroll_pct: maxScrollPct,
        sections_viewed: Object.keys(sectionsSeen)
      });
    }
  });

  // Cross-script API for voice.js
  window._analytics = { send: send };
})();
