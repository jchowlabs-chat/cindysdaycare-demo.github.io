(function () {
  var currentRange = '7d';

  function formatMs(ms) {
    if (!ms || ms <= 0) return '—';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }

  function pct(n, total) {
    if (!total) return '0%';
    return Math.round((n / total) * 100) + '%';
  }

  function $(id) { return document.getElementById(id); }

  function barRow(label, fills, count, maxVal) {
    var row = document.createElement('div');
    row.className = 'bar-row';

    var lbl = document.createElement('div');
    lbl.className = 'bar-label';
    lbl.textContent = label;

    var track = document.createElement('div');
    track.className = 'bar-track';

    fills.forEach(function (f) {
      if (f.value <= 0) return;
      var fill = document.createElement('div');
      fill.className = 'bar-fill ' + f.className;
      var w = maxVal > 0 ? Math.max(1, Math.round((f.value / maxVal) * 100)) : 0;
      fill.style.width = w + '%';
      track.appendChild(fill);
    });

    var cnt = document.createElement('div');
    cnt.className = 'bar-count';
    cnt.textContent = count;

    row.appendChild(lbl);
    row.appendChild(track);
    row.appendChild(cnt);
    return row;
  }

  function fetchAll(range) {
    var base = '/api/';
    var q = '?range=' + range;
    return Promise.all([
      fetch(base + 'summary' + q).then(function (r) { return r.json(); }),
      fetch(base + 'visitors' + q).then(function (r) { return r.json(); }),
      fetch(base + 'devices' + q).then(function (r) { return r.json(); }),
      fetch(base + 'sections' + q).then(function (r) { return r.json(); }),
      fetch(base + 'voice' + q).then(function (r) { return r.json(); }),
    ]);
  }

  function render(data) {
    var summary = data[0];
    var visitors = data[1];
    var devices = data[2];
    var sections = data[3];
    var voice = data[4];

    // Cards
    $('c-total').textContent = summary.total_visitors;
    $('c-human-bot').textContent = summary.humans + ' human · ' + summary.bots + ' bot';
    $('c-time').textContent = formatMs(summary.avg_time_ms);
    $('c-time-sub').textContent = summary.avg_time_ms > 0 ? 'avg per session' : 'no data yet';
    $('c-voice').textContent = summary.voice_engaged + ' of ' + summary.humans;
    $('c-voice-sub').textContent = summary.voice_rate + '% of humans';

    // Visitors by Day
    var chartV = $('chart-visitors');
    chartV.innerHTML = '';
    var days = visitors.days || [];
    var maxDay = 0;
    days.forEach(function (d) { var t = (d.humans || 0) + (d.bots || 0); if (t > maxDay) maxDay = t; });
    if (days.length === 0) {
      chartV.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">No data yet</div>';
    }
    days.forEach(function (d) {
      var label = d.day;
      try {
        var dt = new Date(d.day + 'T12:00:00');
        var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        label = names[dt.getDay()] + ' ' + (dt.getMonth() + 1) + '/' + dt.getDate();
      } catch (e) {}
      var total = (d.humans || 0) + (d.bots || 0);
      chartV.appendChild(barRow(label, [
        { value: d.humans || 0, className: 'human' },
        { value: d.bots || 0, className: 'bot' },
      ], total, maxDay));
    });

    // Devices
    var chartD = $('chart-devices');
    chartD.innerHTML = '';
    var devs = devices.by_device || [];
    var maxDev = devs.length ? devs[0].count : 0;
    if (devs.length === 0) {
      chartD.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">No data yet</div>';
    }
    devs.forEach(function (d) {
      chartD.appendChild(barRow(d.device, [
        { value: d.count, className: 'device' },
      ], d.count, maxDev));
    });

    var ds = $('device-summary');
    var types = devices.by_type || [];
    var totalDevices = types.reduce(function (a, t) { return a + t.count; }, 0);
    ds.innerHTML = types.map(function (t) {
      var name = (t.device_type || 'Unknown');
      name = name.charAt(0).toUpperCase() + name.slice(1);
      return name + ' ' + pct(t.count, totalDevices);
    }).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');

    // Sections
    var chartS = $('chart-sections');
    chartS.innerHTML = '';
    var secs = sections.sections || [];
    var maxSec = secs.length ? secs[0].unique_viewers : 0;
    if (secs.length === 0) {
      chartS.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">No data yet</div>';
    }
    var sectionNames = {
      home: 'Home',
      gallery: 'Gallery',
      about: 'About',
      testimonials: 'Testimonials',
      neighborhood: 'Neighborhood',
      contact: 'Contact',
    };
    secs.forEach(function (s) {
      var name = sectionNames[s.section_id] || s.section_id || 'unknown';
      chartS.appendChild(barRow(name, [
        { value: s.unique_viewers, className: 'section' },
      ], s.unique_viewers, maxSec));
    });
    $('scroll-depth').textContent = 'Avg scroll depth: ' + (sections.avg_scroll_depth || 0) + '%';

    // Voice
    var vs = $('voice-stats');
    vs.innerHTML = '';
    var stats = [
      { label: 'Unique users', value: voice.unique_users, highlight: true },
      { label: 'Total sessions', value: voice.total_sessions },
      { label: 'Avg duration', value: formatMs(voice.avg_duration_ms) },
      { label: 'Multi-session visits', value: voice.multi_session_visits + ' (' + (voice.unique_users > 0 ? Math.round((voice.multi_session_visits / voice.unique_users) * 100) : 0) + '%)' },
      { label: 'Avg sessions / user', value: voice.avg_sessions_per_user },
      { label: 'Mic blocked errors', value: voice.mic_errors },
    ];
    stats.forEach(function (s) {
      var row = document.createElement('div');
      row.className = 'stat-row';
      var lbl = document.createElement('div');
      lbl.className = 'stat-label';
      lbl.textContent = s.label;
      var val = document.createElement('div');
      val.className = 'stat-value' + (s.highlight ? ' highlight' : '');
      val.textContent = s.value;
      row.appendChild(lbl);
      row.appendChild(val);
      vs.appendChild(row);
    });
  }

  function load(range) {
    currentRange = range;
    fetchAll(range).then(render).catch(function (err) {
      console.error('Dashboard fetch error:', err);
    });
  }

  document.querySelectorAll('.range-btns button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.range-btns button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      load(btn.dataset.range);
    });
  });

  load('7d');
})();
