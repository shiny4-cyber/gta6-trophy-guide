/* Leonida Legend - one file of behaviour: the checklist, its filters, the spoiler shield, the roadmap,
   the detail panel and the localStorage file in and out. Plain classic script, no library, no network. */
(function () {
  'use strict';

  var STORE_KEY = 'leonida-legend.v1';
  var KINDS = [
    { id: 'all', label: 'All' },
    { id: 'story', label: 'Story' },
    { id: 'missable', label: 'Missable' },
    { id: 'questlines', label: 'Questlines' },
    { id: 'collectibles', label: 'Collectibles' },
    { id: 'activities', label: 'Activities' },
    { id: 'crime', label: 'Crime' },
    { id: 'money', label: 'Money' },
    { id: 'online', label: 'Online', fixed: 0 }
  ];
  var GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

  var state = {
    data: null,
    done: {},
    spoiler: false,
    kind: 'all',
    query: '',
    todoOnly: false,
    view: 'list',
    selected: 1
  };

  var el = {
    list: document.getElementById('list'),
    detail: document.getElementById('detail'),
    chips: document.getElementById('chips'),
    q: document.getElementById('q'),
    todo: document.getElementById('only-todo'),
    spoiler: document.getElementById('spoiler'),
    pct: document.getElementById('pct'),
    doneOf: document.getElementById('done-of'),
    bar: document.getElementById('bar-fill'),
    tally: document.getElementById('tally'),
    roadmap: document.getElementById('roadmap'),
    roadmapLede: document.getElementById('roadmap-lede'),
    transferText: document.getElementById('transfer-text'),
    transferStatus: document.getElementById('transfer-status'),
    loadnote: document.getElementById('loadnote')
  };

  /* ---------- storage ---------- */

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeStore() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(payload()));
      return true;
    } catch (err) {
      return false;
    }
  }

  function payload() {
    var ids = Object.keys(state.done).filter(function (k) { return state.done[k]; }).map(Number).sort(function (a, b) { return a - b; });
    return {
      schema: 'leonida-legend/tracker',
      version: 1,
      game: 'Grand Theft Auto VI',
      platform: 'PlayStation 5',
      total: state.data ? state.data.trophies.length : 55,
      earned: ids.length,
      spoiler: state.spoiler,
      ids: ids
    };
  }

  /* ---------- helpers ---------- */

  function trophyById(id) {
    var found = null;
    state.data.trophies.forEach(function (t) { if (t.id === id) found = t; });
    return found;
  }

  function isDone(t) { return state.done[t.id] === true; }

  function shielded(t) {
    return state.spoiler && !isDone(t) && t.kinds.indexOf('story') !== -1;
  }

  function matches(t) {
    if (state.todoOnly && isDone(t)) return false;
    if (state.kind === 'online') return false;
    if (state.kind === 'missable' && !t.missable) return false;
    if (state.kind !== 'all' && state.kind !== 'missable' && t.kinds.indexOf(state.kind) === -1) return false;
    if (state.query) {
      var hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.chapter || '') + ' ' + t.kinds.join(' ')).toLowerCase();
      if (hay.indexOf(state.query) === -1) return false;
    }
    return true;
  }

  function countFor(kind) {
    if (kind === 'online') return 0;
    if (kind === 'all') return state.data.trophies.length;
    return state.data.trophies.filter(function (t) {
      if (kind === 'missable') return t.missable;
      return t.kinds.indexOf(kind) !== -1;
    }).length;
  }

  function pctText(n, total) {
    if (!total) return '0%';
    var pct = Math.round((n / total) * 100);
    return pct + '%';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function countLabel(c) {
    if (!c) return '';
    var done = c.done;
    var total = c.total;
    if (typeof done === 'number' && done >= 1000) {
      return (done / 1000) + 'k of ' + (total / 1000) + 'k ' + c.label;
    }
    return done + ' of ' + total + ' ' + c.label;
  }

  /* ---------- render: masthead ---------- */

  function renderMeter() {
    var all = state.data.trophies;
    var n = all.filter(isDone).length;
    el.pct.textContent = pctText(n, all.length);
    el.doneOf.textContent = n + ' of ' + all.length + ' earned';
    el.bar.style.width = (all.length ? (n / all.length) * 100 : 0) + '%';

    var parts = GRADE_ORDER.map(function (g) {
      var group = all.filter(function (t) { return t.grade === g; });
      var got = group.filter(isDone).length;
      return '<li>' + g + ' <b>' + got + '</b>/' + group.length + '</li>';
    });
    parts.push('<li>missable <b>' + all.filter(function (t) { return t.missable && !isDone(t); }).length + '</b> left</li>');
    el.tally.innerHTML = parts.join('');
  }

  /* ---------- render: chips ---------- */

  function renderChips() {
    el.chips.innerHTML = KINDS.map(function (k) {
      var n = countFor(k.id);
      var on = state.kind === k.id ? ' is-on' : '';
      return '<button class="chip' + on + '" data-kind="' + k.id + '">' + esc(k.label) + '<b>' + n + '</b></button>';
    }).join('');
  }

  /* ---------- render: list ---------- */

  function renderList() {
    var rows = state.data.trophies.filter(matches);
    if (!rows.length) {
      var why = state.kind === 'online'
        ? 'The list has no online trophies: all 55 are single-player, and the online mode is not part of this launch.'
        : 'Nothing matches that filter. Clear the search or pick another kind.';
      el.list.innerHTML = '<li class="detail-empty" style="padding:24px 4px">' + why + '</li>';
      return;
    }
    el.list.innerHTML = rows.map(function (t) {
      var hide = shielded(t);
      var name = hide ? 'Story trophy - shielded' : t.name;
      var desc = hide ? 'Name and description hidden until earned' : t.description;
      var tags = [];
      tags.push('<span class="pill chap">' + esc(t.chapter) + '</span>');
      if (t.missable) tags.push('<span class="pill missable">missable</span>');
      if (t.counts) tags.push('<span class="pill count">' + esc(countLabel(t.counts)) + '</span>');
      return '<li class="card' + (isDone(t) ? ' is-done' : '') + (state.selected === t.id ? ' is-sel' : '') + '" data-id="' + t.id + '">' +
        '<span class="tick" role="checkbox" aria-checked="' + (isDone(t) ? 'true' : 'false') + '" aria-label="Mark ' + esc(name) + ' earned"></span>' +
        '<div class="card-main">' +
          '<div class="card-name">' + esc(name) + '</div>' +
          '<div class="card-desc' + (hide ? ' shielded' : '') + '">' + esc(desc) + '</div>' +
          '<div class="card-meta">' + tags.join('') + '</div>' +
        '</div>' +
        '<span class="grade ' + esc(t.grade) + '" title="' + esc(t.grade) + '"></span>' +
      '</li>';
    }).join('');
  }

  /* ---------- render: detail ---------- */

  function renderDetail() {
    var t = trophyById(state.selected);
    if (!t) {
      el.detail.innerHTML = '<p class="detail-empty">Pick a trophy from the list.</p>';
      return;
    }
    var hide = shielded(t);
    var badges = ['<span class="pill">' + esc(t.grade) + '</span>', '<span class="pill chap">' + esc(t.chapter) + '</span>'];
    if (t.missable) badges.push('<span class="pill missable">missable</span>');
    if (t.counts) badges.push('<span class="pill count">' + esc(countLabel(t.counts)) + '</span>');
    if (t.hidden) badges.push('<span class="pill">hidden on PSN</span>');

    var steps = hide ? '' :
      '<h3 class="d-h">In order</h3><ol class="d-steps">' +
      t.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';

    var sources = hide ? '' :
      '<h3 class="d-h">Where this comes from</h3><div class="d-sources">' +
      t.sources.map(function (s) {
        return '<a href="' + esc(s.url) + '" rel="noreferrer">' + esc(s.name) + '</a><span>' + esc(s.url.replace(/^https?:\/\//, '')) + '</span>';
      }).join('') + '</div>';

    var missable = t.missable
      ? '<p class="d-note">Missable: this is the only trophy on the list with a closing window, and it closes with Chapter 1.</p>'
      : '<p class="d-note">Not missable: available in free roam after the credits.</p>';

    el.detail.innerHTML =
      '<div class="d-top"><div>' +
        '<div class="d-grade">' + esc(t.grade) + ' trophy</div>' +
        '<h2 class="d-title">' + esc(hide ? 'Story trophy' : t.name) + '</h2>' +
        '<p class="d-desc' + (hide ? ' shielded' : '') + '">' + esc(hide ? 'Hidden by the spoiler shield until you mark it earned.' : t.description) + '</p>' +
      '</div><span class="grade ' + esc(t.grade) + '"></span></div>' +
      '<div class="d-badges">' + badges.join('') + '</div>' +
      '<h3 class="d-h">What to do</h3>' +
      '<p class="d-guide' + (hide ? ' shielded' : '') + '">' +
        esc(hide ? 'The guide stays behind the shield while the name is hidden. Switch the shield off, or mark the trophy earned, to read it.' : t.guide) +
      '</p>' + steps + sources + missable +
      '<div class="checkline"><button data-toggle="' + t.id + '" class="' + (isDone(t) ? 'is-done' : '') + '">' +
        (isDone(t) ? 'Earned - click to undo' : 'Mark as earned') + '</button></div>';
  }

  /* ---------- render: roadmap ---------- */

  function renderRoadmap() {
    var all = state.data.trophies;
    var missables = all.filter(function (t) { return t.missable; });
    var hiddenCount = all.filter(function (t) { return t.hidden; }).length;
    var onlineCount = all.filter(function (t) { return t.kinds.indexOf('online') !== -1; }).length;

    el.roadmapLede.innerHTML =
      '<span class="big">' + missables.length + ' missable trophy</span> in 55, and its window closes with Chapter 1: ' +
      esc(missables.map(function (t) { return t.name; }).join(', ')) +
      '. Everything else can be finished after the credits, which is the whole reason this roadmap can be played at any pace. ' +
      hiddenCount + ' are hidden on PlayStation until earned, and the list carries ' + onlineCount + ' online trophies.';

    el.roadmap.innerHTML =
      '<div class="missable-board"><h3>The one that closes</h3><p>' +
        '<span class="big">Positive Mental Attitude</span> - Chapter 1, the morning after Down to Earth: Lucia walks out to the balcony at Jason\'s house and says she is going to meditate. Follow her and accept. That session cannot be repeated once Chapter 1 ends. It adds one to the meditation counter but is not flagged as a meditation spot like the other 18, so whether the trophy strictly requires it is still unconfirmed; doing it takes a minute and removes the question. <b>Window closes:</b> end of Chapter 1.</p></div>' +
      state.data.roadmap.map(function (stage) {
        var done = stage.ids.filter(function (id) { return state.done[id]; }).length;
        var now = done === stage.ids.length ? '' : (done > 0 ? '' : '');
        return '<section class="stage' + now + '">' +
          '<div class="stage-num">' + esc(stage.stage) + '</div>' +
          '<div>' +
            '<div class="stage-head"><h3 class="stage-title">' + esc(stage.title) + '</h3>' +
              '<span class="stage-when">' + esc(stage.window) + ' &middot; ' + esc(stage.hours) + ' &middot; ' + done + '/' + stage.ids.length + '</span></div>' +
            '<p class="stage-sum">' + esc(stage.summary) + '</p>' +
            '<div class="stage-rows">' + stage.ids.map(function (id) {
              var t = trophyById(id);
              var hide = shielded(t);
              var cls = 'mini' + (isDone(t) ? ' is-done' : '') + (t.missable ? ' miss' : '');
              return '<button class="' + cls + '" data-id="' + t.id + '"><span class="grade ' + esc(t.grade) + '"></span><span class="mini-name">' +
                esc(hide ? 'Story trophy' : t.name) + '</span></button>';
            }).join('') + '</div>' +
          '</div>' +
        '</section>';
      }).join('');
  }

  /* ---------- render all ---------- */

  function renderAll() {
    renderMeter();
    renderChips();
    renderList();
    renderDetail();
    renderRoadmap();
  }

  /* ---------- actions ---------- */

  function toggle(id) {
    if (state.done[id]) delete state.done[id];
    else state.done[id] = true;
    writeStore();
    renderAll();
  }

  function setView(view) {
    state.view = view;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-view') === view);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (s) {
      s.classList.toggle('is-on', s.id === 'view-' + view);
    });
  }

  function exportText() {
    return JSON.stringify(payload(), null, 2) + '\n';
  }

  function setStatus(msg) { el.transferStatus.textContent = msg; }

  function doExport() {
    var text = exportText();
    el.transferText.value = text;
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'leonida-legend-progress.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setStatus('Exported ' + payload().ids.length + ' earned trophies to leonida-legend-progress.json.');
  }

  function importObject(obj, mode) {
    var ids = null;
    if (Array.isArray(obj)) ids = obj;
    else if (obj && Array.isArray(obj.ids)) ids = obj.ids;
    else if (obj && Array.isArray(obj.done)) ids = obj.done;
    if (!ids) return { ok: false, why: 'No ids array in that file.' };
    var valid = ids.map(Number).filter(function (n) { return n >= 1 && n <= 55 && trophyById(n); });
    if (mode === 'replace') state.done = {};
    valid.forEach(function (n) { state.done[n] = true; });
    if (obj && typeof obj.spoiler === 'boolean') state.spoiler = obj.spoiler;
    writeStore();
    renderAll();
    syncSpoilerButton();
    return { ok: true, n: valid.length, skipped: ids.length - valid.length };
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var res = importObject(JSON.parse(String(reader.result)), 'replace');
        if (res.ok) setStatus('Imported ' + res.n + ' earned trophies from ' + file.name + (res.skipped ? ' (' + res.skipped + ' unknown ids skipped)' : '') + '.');
        else setStatus('That file could not be read: ' + res.why);
      } catch (err) {
        setStatus('That file is not valid JSON.');
      }
    };
    reader.readAsText(file);
  }

  function syncSpoilerButton() {
    el.spoiler.setAttribute('aria-pressed', state.spoiler ? 'true' : 'false');
  }

  /* ---------- wiring ---------- */

  document.addEventListener('click', function (ev) {
    var target = ev.target;
    var tab = target.closest('[data-view]');
    if (tab) { setView(tab.getAttribute('data-view')); return; }

    var chip = target.closest('[data-kind]');
    if (chip) {
      state.kind = chip.getAttribute('data-kind');
      renderChips(); renderList();
      return;
    }

    var tick = target.closest('.tick');
    var card = target.closest('.card');
    if (tick && card) { toggle(Number(card.getAttribute('data-id'))); return; }

    var toggleBtn = target.closest('[data-toggle]');
    if (toggleBtn) { toggle(Number(toggleBtn.getAttribute('data-toggle'))); return; }

    var mini = target.closest('.mini');
    if (mini) {
      state.selected = Number(mini.getAttribute('data-id'));
      setView('list');
      renderList(); renderDetail();
      var chosen = document.querySelector('.card.is-sel');
      if (chosen && chosen.scrollIntoView) chosen.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (card) {
      state.selected = Number(card.getAttribute('data-id'));
      renderList(); renderDetail();
    }
  });

  el.q.addEventListener('input', function () {
    state.query = el.q.value.trim().toLowerCase();
    renderList();
  });

  el.todo.addEventListener('click', function () {
    state.todoOnly = !state.todoOnly;
    el.todo.classList.toggle('is-on', state.todoOnly);
    el.todo.setAttribute('aria-pressed', state.todoOnly ? 'true' : 'false');
    renderList();
  });

  el.spoiler.addEventListener('click', function () {
    state.spoiler = !state.spoiler;
    syncSpoilerButton();
    writeStore();
    renderAll();
  });

  document.getElementById('export-file').addEventListener('click', doExport);
  document.getElementById('export-copy').addEventListener('click', function () {
    el.transferText.value = exportText();
    setStatus('The JSON above is the whole file: ' + payload().ids.length + ' earned trophies.');
  });
  document.getElementById('import-file').addEventListener('change', function (ev) {
    if (ev.target.files && ev.target.files[0]) readFile(ev.target.files[0]);
  });
  document.getElementById('import-text').addEventListener('click', function () {
    var text = el.transferText.value.trim();
    if (!text) { setStatus('Paste a file into the box first.'); return; }
    try {
      var res = importObject(JSON.parse(text), 'replace');
      if (res.ok) setStatus('Imported ' + res.n + ' earned trophies from the box.');
      else setStatus('Nothing to import: ' + res.why);
    } catch (err) {
      setStatus('The box does not hold valid JSON.');
    }
  });
  document.getElementById('wipe').addEventListener('click', function () {
    state.done = {};
    writeStore();
    renderAll();
    setStatus('Progress erased. The export file, if you kept one, still holds it.');
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === '/' && document.activeElement !== el.q) {
      ev.preventDefault();
      el.q.focus();
    }
    if (ev.key === 'Escape' && document.activeElement === el.q) {
      el.q.value = '';
      state.query = '';
      renderList();
    }
  });

  /* ---------- boot ---------- */

  function boot(data) {
    state.data = data;
    var stored = readStore();
    if (stored) {
      state.spoiler = stored.spoiler === true;
      var ids = Array.isArray(stored.ids) ? stored.ids : [];
      ids.forEach(function (n) { if (trophyById(n)) state.done[Number(n)] = true; });
    }
    var missables = data.trophies.filter(function (t) { return t.missable; }).length;
    el.loadnote.textContent = data.trophies.length + ' trophies, ' + data.roadmap.length +
      ' roadmap stages, ' + missables + ' missable, 0 online, all local files.';
    syncSpoilerButton();
    renderAll();
    setView('list');
    setStatus('Nothing exported yet in this session.');
  }

  fetch('data/trophies.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(boot)
    .catch(function (err) {
      el.list.innerHTML = '<li class="detail-empty" style="padding:24px 4px">The trophy file could not be read (' +
        esc(err.message) + '). Serve app/ over HTTP, for example with the kit\'s serve.ts, rather than opening the page as a file.</li>';
    });
})();
