'use strict';
/* Pet Care Tracker BD \u2014 DOM controller. Pure logic lives in js/logic.js. */
(function () {
  const STORAGE_KEY = 'pet-care-tracker-bd-v1';
  const params = new URLSearchParams(location.search);
  const ASOF = params.get('asof') || null; // deterministic date for tests

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      const res = validateImport(parsed.data ? parsed : { data: parsed });
      if (res.ok) return res.data;
      return emptyState();
    } catch (e) { return emptyState(); }
  }

  let state = loadState();
  let activeTab = 'dashboard';
  let editingPetId = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData(state))); } catch (e) { /* storage full/blocked */ }
  }

  function t(key) {
    const d = I18N[state.lang] || I18N.en;
    return d[key] !== undefined ? d[key] : (I18N.en[key] || key);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(n) { return formatNumber(n, state.lang); }
  function fmtDate(iso) {
    if (!iso) return '\u2014';
    return state.lang === 'bn' ? toBengaliDigits(iso) : iso;
  }
  function fmtKg(kg) {
    if (kg === null || kg === undefined || kg === '') return '\u2014';
    const s = String(kg);
    return (state.lang === 'bn' ? toBengaliDigits(s) : s) + ' kg';
  }

  function errMsg(e) {
    if (e.code === 'required') return t('errRequired');
    if (e.code === 'future') return t('errFuture');
    if (e.code === 'before_given') return t('errBeforeGiven');
    if (e.code === 'too_long') return t('errTooLong');
    return t('errInvalid');
  }

  function firstErrText(errors, field) {
    const e = errors.find(x => x.field === field);
    return e ? errMsg(e) : '';
  }

  function showErr(containerId, errors) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = errors.length ? errMsg(errors[0]) : '';
  }

  function applyStaticLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('#tabs button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === activeTab);
    });
  }

  function petOptions(selectedId, idAttr) {
    const opts = state.pets.map(p => '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    return '<select id="' + idAttr + '">' + (opts || '<option value="">' + esc(t('noPetsYet')) + '</option>') + '</select>';
  }

  function speciesLabel(s) { return t('species' + s.charAt(0).toUpperCase() + s.slice(1)); }
  function sexLabel(s) { return s === 'unknown' ? t('sexUnknown') : t(s === 'male' ? 'sexMale' : 'sexFemale'); }
  function foodLabel(f) {
    return { dry: t('foodDry'), wet: t('foodWet'), homemade: t('foodHomemade'), treat: t('foodTreat'), other: t('foodOther') }[f] || f;
  }

  function vaccineBadge(v) {
    const st = vaccineStatus(v, ASOF);
    const label = { overdue: t('statusOverdue'), 'due-today': t('statusDueToday'), 'due-soon': t('statusDueSoon'), 'up-to-date': t('statusUpToDate'), 'no-due': t('statusNoDue') }[st];
    let extra = '';
    if (v.dueDate && st === 'overdue') extra = ' (' + num(Math.abs(daysBetween(todayStr(ASOF), v.dueDate))) + ' ' + t('daysOverdue') + ')';
    if (v.dueDate && (st === 'due-soon')) extra = ' (' + num(daysBetween(todayStr(ASOF), v.dueDate)) + ' ' + t('daysLeft') + ')';
    return '<span class="badge ' + st + '">' + esc(label) + esc(extra) + '</span>';
  }

  // ---------------- Dashboard ----------------
  function renderDashboard() {
    const s = dashboardStats(state, ASOF);
    const upcoming = upcomingVaccines(state, ASOF).slice(0, 10);
    const petCards = state.pets.map(p => {
      const age = petAge(p.dob, ASOF);
      const lw = latestWeight(state, p.id);
      const next = upcomingVaccines(state, ASOF).filter(v => v.petId === p.id)[0];
      return '<div class="pet-card"><h3>' + esc(p.name) + '</h3>' +
        '<div class="meta">' + esc(speciesLabel(p.species)) + (p.breed ? ' \u00b7 ' + esc(p.breed) : '') + ' \u00b7 ' + esc(sexLabel(p.sex)) + '</div>' +
        '<div class="meta">' + esc(t('age')) + ': ' + esc(formatAge(age, state.lang)) + '</div>' +
        '<div class="meta">' + esc(t('latestWeight')) + ': ' + esc(fmtKg(lw ? lw.weightKg : p.weightKg)) + '</div>' +
        '<div class="meta">' + esc(t('nextVaccine')) + ': ' + (next ? esc(next.name) + ' \u2014 ' + esc(fmtDate(next.dueDate)) : esc(t('none'))) + '</div></div>';
    }).join('');
    return '<div class="stats">' +
      '<div class="stat"><div class="num">' + num(s.petCount) + '</div><div class="lbl">' + esc(t('statPets')) + '</div></div>' +
      '<div class="stat"><div class="num">' + num(s.feedingsToday) + '</div><div class="lbl">' + esc(t('statFeedingsToday')) + '</div></div>' +
      '<div class="stat' + (s.overdueVaccines > 0 ? ' warn' : '') + '"><div class="num">' + num(s.overdueVaccines) + '</div><div class="lbl">' + esc(t('statOverdue')) + '</div></div>' +
      '<div class="stat"><div class="num">' + num(s.dueSoonVaccines) + '</div><div class="lbl">' + esc(t('statDueSoon')) + '</div></div>' +
      '<div class="stat"><div class="num">' + esc(formatBDT(s.totalVetSpend, state.lang)) + '</div><div class="lbl">' + esc(t('statVetSpend')) + '</div></div>' +
      '<div class="stat"><div class="num">' + num(s.visitCount) + '</div><div class="lbl">' + esc(t('statVisits')) + '</div></div>' +
      '</div>' +
      '<div class="card"><h2>' + esc(t('upcomingVaccines')) + '</h2>' +
      (upcoming.length ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t('petName')) + '</th><th>' + esc(t('vaccineName')) + '</th><th>' + esc(t('dueDate')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        upcoming.map(v => { const p = findPet(state, v.petId); return '<tr><td>' + esc(p ? p.name : '?') + '</td><td>' + esc(v.name) + '</td><td>' + esc(fmtDate(v.dueDate)) + '</td><td>' + vaccineBadge(v) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="empty">' + esc(t('noVaccinesDue')) + '</p>') + '</div>' +
      '<div class="card"><h2>' + esc(t('tabPets')) + '</h2>' +
      (state.pets.length ? '<div class="pet-grid">' + petCards + '</div>' : '<p class="empty">' + esc(t('noPetsYet')) + '</p>') + '</div>';
  }

  // ---------------- Pets ----------------
  function renderPets() {
    const editing = editingPetId !== null ? findPet(state, editingPetId) : null;
    const cards = state.pets.map(p => {
      const age = petAge(p.dob, ASOF);
      const lw = latestWeight(state, p.id);
      return '<div class="pet-card"><h3>' + esc(p.name) + '</h3>' +
        '<div class="meta">' + esc(speciesLabel(p.species)) + (p.breed ? ' \u00b7 ' + esc(p.breed) : '') + ' \u00b7 ' + esc(sexLabel(p.sex)) + '</div>' +
        '<div class="meta">' + esc(t('age')) + ': ' + esc(formatAge(age, state.lang)) + (p.dob ? ' (' + esc(fmtDate(p.dob)) + ')' : '') + '</div>' +
        '<div class="meta">' + esc(t('latestWeight')) + ': ' + esc(fmtKg(lw ? lw.weightKg : p.weightKg)) + '</div>' +
        (p.notes ? '<div class="meta">' + esc(p.notes) + '</div>' : '') +
        '<div class="actions"><button type="button" class="btn small secondary" data-action="edit-pet" data-id="' + p.id + '">' + esc(t('edit')) + '</button>' +
        '<button type="button" class="btn small danger" data-action="delete-pet" data-id="' + p.id + '">' + esc(t('delete')) + '</button></div></div>';
    }).join('');
    return '<div class="card"><h2>' + esc(editing ? t('editPet') : t('addPet')) + '</h2>' +
      '<form id="pet-form" novalidate>' +
      '<div class="row"><div><label for="pet-name">' + esc(t('petName')) + '</label><input id="pet-name" maxlength="60" value="' + esc(editing ? editing.name : '') + '"><div class="err" id="pet-name-err"></div></div>' +
      '<div><label for="pet-species">' + esc(t('species')) + '</label><select id="pet-species">' + SPECIES.map(s => '<option value="' + s + '"' + ((editing ? editing.species : 'dog') === s ? ' selected' : '') + '>' + esc(speciesLabel(s)) + '</option>').join('') + '</select></div></div>' +
      '<div class="row"><div><label for="pet-breed">' + esc(t('breed')) + '</label><input id="pet-breed" maxlength="60" value="' + esc(editing ? editing.breed : '') + '"></div>' +
      '<div><label for="pet-sex">' + esc(t('sex')) + '</label><select id="pet-sex">' + SEXES.map(s => '<option value="' + s + '"' + ((editing ? editing.sex : 'unknown') === s ? ' selected' : '') + '>' + esc(sexLabel(s)) + '</option>').join('') + '</select></div></div>' +
      '<div class="row"><div><label for="pet-dob">' + esc(t('dob')) + '</label><input id="pet-dob" type="date" value="' + esc(editing ? editing.dob : '') + '"></div>' +
      '<div><label for="pet-weight">' + esc(t('weightKg')) + '</label><input id="pet-weight" type="number" min="0" max="300" step="0.01" value="' + (editing && editing.weightKg !== null ? editing.weightKg : '') + '"></div></div>' +
      '<label for="pet-notes">' + esc(t('notes')) + '</label><textarea id="pet-notes" rows="2" maxlength="500">' + esc(editing ? editing.notes : '') + '</textarea>' +
      '<div style="margin-top:12px;display:flex;gap:8px"><button class="btn" type="submit" id="pet-submit">' + esc(t('save')) + '</button>' +
      (editing ? '<button class="btn secondary" type="button" id="pet-cancel">' + esc(t('cancel')) + '</button>' : '') + '</div>' +
      '<div class="err" id="pet-form-err"></div><div class="ok" id="pet-form-ok"></div>' +
      '</form></div>' +
      '<div class="card"><h2>' + esc(t('tabPets')) + '</h2>' +
      (state.pets.length ? '<div class="pet-grid">' + cards + '</div>' : '<p class="empty">' + esc(t('noPetsYet')) + '</p>') + '</div>';
  }

  // ---------------- Feeding ----------------
  function renderFeeding() {
    const today = todayStr(ASOF);
    const rows = state.feedings.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.time < b.time ? 1 : a.time > b.time ? -1 : b.id - a.id))).slice(0, 100);
    return '<div class="card"><h2>' + esc(t('addFeeding')) + '</h2>' +
      '<form id="feeding-form" novalidate>' +
      '<div class="row"><div><label for="feeding-pet">' + esc(t('feedingPet')) + '</label>' + petOptions(null, 'feeding-pet') + '</div>' +
      '<div><label for="feeding-date">' + esc(t('feedingDate')) + '</label><input id="feeding-date" type="date" value="' + today + '"></div>' +
      '<div><label for="feeding-time">' + esc(t('feedingTime')) + '</label><input id="feeding-time" type="time" value="08:00"></div></div>' +
      '<div class="row"><div><label for="feeding-food">' + esc(t('foodType')) + '</label><select id="feeding-food">' + FOOD_TYPES.map(f => '<option value="' + f + '">' + esc(foodLabel(f)) + '</option>').join('') + '</select></div>' +
      '<div><label for="feeding-amount">' + esc(t('amount')) + '</label><input id="feeding-amount" type="number" min="0" step="0.1"></div>' +
      '<div><label for="feeding-unit">' + esc(t('unit')) + '</label><select id="feeding-unit"><option value="g">g</option><option value="ml">ml</option></select></div></div>' +
      '<label for="feeding-note">' + esc(t('note')) + '</label><input id="feeding-note" maxlength="300">' +
      '<div style="margin-top:12px"><button class="btn" type="submit" id="feeding-submit">' + esc(t('logFeeding')) + '</button></div>' +
      '<div class="err" id="feeding-form-err"></div><div class="ok" id="feeding-form-ok"></div>' +
      '</form></div>' +
      '<div class="card"><h2>' + esc(t('feedingHistory')) + '</h2>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t('feedingDate')) + '</th><th>' + esc(t('feedingTime')) + '</th><th>' + esc(t('petName')) + '</th><th>' + esc(t('foodType')) + '</th><th>' + esc(t('amount')) + '</th><th>' + esc(t('note')) + '</th><th></th></tr></thead><tbody>' +
        rows.map(f => { const p = findPet(state, f.petId); return '<tr><td>' + esc(fmtDate(f.date)) + '</td><td>' + esc(state.lang === 'bn' ? toBengaliDigits(f.time) : f.time) + '</td><td>' + esc(p ? p.name : '?') + '</td><td>' + esc(foodLabel(f.food)) + '</td><td>' + num(f.amount) + ' ' + esc(f.unit) + '</td><td>' + esc(f.note) + '</td><td><button type="button" class="btn small danger" data-action="delete-feeding" data-id="' + f.id + '">' + esc(t('delete')) + '</button></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="empty">' + esc(t('noFeedings')) + '</p>') + '</div>';
  }

  // ---------------- Vaccines ----------------
  function renderVaccines() {
    const rows = state.vaccines.slice().sort((a, b) => {
      const da = a.dueDate || '9999-12-31', db = b.dueDate || '9999-12-31';
      return da < db ? -1 : da > db ? 1 : b.id - a.id;
    });
    const presetOpts = VACCINE_PRESETS.map(v => '<option value="' + v + '">' + esc(v) + '</option>').join('');
    return '<div class="card"><h2>' + esc(t('addVaccine')) + '</h2>' +
      '<form id="vaccine-form" novalidate>' +
      '<div class="row"><div><label for="vaccine-pet">' + esc(t('feedingPet')) + '</label>' + petOptions(null, 'vaccine-pet') + '</div>' +
      '<div><label for="vaccine-preset">' + esc(t('vaccinePreset')) + '</label><select id="vaccine-preset">' + presetOpts + '</select></div>' +
      '<div><label for="vaccine-name">' + esc(t('vaccineName')) + '</label><input id="vaccine-name" maxlength="60" value="rabies"></div></div>' +
      '<div class="row"><div><label for="vaccine-given">' + esc(t('givenDate')) + '</label><input id="vaccine-given" type="date"></div>' +
      '<div><label for="vaccine-due">' + esc(t('dueDate')) + '</label><input id="vaccine-due" type="date"></div></div>' +
      '<label for="vaccine-note">' + esc(t('note')) + '</label><input id="vaccine-note" maxlength="300">' +
      '<div style="margin-top:12px"><button class="btn" type="submit" id="vaccine-submit">' + esc(t('save')) + '</button></div>' +
      '<div class="err" id="vaccine-form-err"></div><div class="ok" id="vaccine-form-ok"></div>' +
      '</form></div>' +
      '<div class="card"><h2>' + esc(t('vaccineList')) + '</h2>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t('petName')) + '</th><th>' + esc(t('vaccineName')) + '</th><th>' + esc(t('givenDate')) + '</th><th>' + esc(t('dueDate')) + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' +
        rows.map(v => { const p = findPet(state, v.petId); return '<tr><td>' + esc(p ? p.name : '?') + '</td><td>' + esc(v.name) + '</td><td>' + esc(fmtDate(v.givenDate)) + '</td><td>' + esc(fmtDate(v.dueDate)) + '</td><td>' + vaccineBadge(v) + '</td><td><button type="button" class="btn small secondary" data-action="mark-given" data-id="' + v.id + '">' + esc(t('markGiven')) + '</button> <button type="button" class="btn small danger" data-action="delete-vaccine" data-id="' + v.id + '">' + esc(t('delete')) + '</button></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="empty">' + esc(t('noVaccines')) + '</p>') + '</div>';
  }

  // ---------------- Visits ----------------
  function renderVisits() {
    const rows = state.visits.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    return '<div class="card"><h2>' + esc(t('addVisit')) + '</h2>' +
      '<form id="visit-form" novalidate>' +
      '<div class="row"><div><label for="visit-pet">' + esc(t('feedingPet')) + '</label>' + petOptions(null, 'visit-pet') + '</div>' +
      '<div><label for="visit-date">' + esc(t('visitDate')) + '</label><input id="visit-date" type="date" value="' + todayStr(ASOF) + '"></div></div>' +
      '<div class="row"><div><label for="visit-reason">' + esc(t('visitReason')) + '</label><input id="visit-reason" maxlength="120"></div>' +
      '<div><label for="visit-clinic">' + esc(t('visitClinic')) + '</label><input id="visit-clinic" maxlength="80"></div>' +
      '<div><label for="visit-cost">' + esc(t('visitCost')) + '</label><input id="visit-cost" type="number" min="0" step="0.01"></div></div>' +
      '<label for="visit-note">' + esc(t('note')) + '</label><input id="visit-note" maxlength="500">' +
      '<div style="margin-top:12px"><button class="btn" type="submit" id="visit-submit">' + esc(t('save')) + '</button></div>' +
      '<div class="err" id="visit-form-err"></div><div class="ok" id="visit-form-ok"></div>' +
      '</form></div>' +
      '<div class="card"><h2>' + esc(t('visitList')) + ' \u2014 ' + esc(t('totalSpend')) + ': ' + esc(formatBDT(totalVetSpend(state), state.lang)) + '</h2>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t('visitDate')) + '</th><th>' + esc(t('petName')) + '</th><th>' + esc(t('visitReason')) + '</th><th>' + esc(t('visitClinic')) + '</th><th>' + esc(t('visitCost')) + '</th><th>' + esc(t('note')) + '</th><th></th></tr></thead><tbody>' +
        rows.map(v => { const p = findPet(state, v.petId); return '<tr><td>' + esc(fmtDate(v.date)) + '</td><td>' + esc(p ? p.name : '?') + '</td><td>' + esc(v.reason) + '</td><td>' + esc(v.clinic) + '</td><td>' + esc(formatBDT(v.costPaisa || 0, state.lang)) + '</td><td>' + esc(v.note) + '</td><td><button type="button" class="btn small danger" data-action="delete-visit" data-id="' + v.id + '">' + esc(t('delete')) + '</button></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="empty">' + esc(t('noVisits')) + '</p>') + '</div>';
  }

  // ---------------- Weight ----------------
  function weightChart(petId) {
    const series = weightSeries(state, petId);
    if (series.length < 1) return '<p class="empty">' + esc(t('noWeights')) + '</p>';
    const W = 640, H = 220, padL = 44, padR = 12, padT = 12, padB = 28;
    const weights = series.map(w => w.weightKg);
    let min = Math.min.apply(null, weights), max = Math.max.apply(null, weights);
    if (min === max) { min -= 1; max += 1; }
    const x = i => padL + (i / Math.max(1, series.length - 1)) * (W - padL - padR);
    const y = v => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    const pts = series.map((w, i) => x(i).toFixed(1) + ',' + y(w.weightKg).toFixed(1)).join(' ');
    const circles = series.map((w, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(w.weightKg).toFixed(1) + '" r="4" fill="#1f7a4d"><title>' + esc(w.date + ': ' + w.weightKg + ' kg') + '</title></circle>').join('');
    return '<div class="chart-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(t('weightChart')) + '">' +
      '<polyline points="' + pts + '" fill="none" stroke="#1f7a4d" stroke-width="2"/>' + circles +
      '<text x="4" y="' + (y(max) + 4) + '">' + esc(num(max)) + '</text>' +
      '<text x="4" y="' + (y(min) + 4) + '">' + esc(num(min)) + '</text>' +
      '<text x="' + padL + '" y="' + (H - 8) + '">' + esc(fmtDate(series[0].date)) + '</text>' +
      '<text x="' + (W - padR - 90) + '" y="' + (H - 8) + '">' + esc(fmtDate(series[series.length - 1].date)) + '</text>' +
      '</svg></div>';
  }

  let weightPetId = null;
  function renderWeight() {
    if (weightPetId === null && state.pets.length) weightPetId = state.pets[0].id;
    if (weightPetId !== null && !findPet(state, weightPetId)) weightPetId = state.pets.length ? state.pets[0].id : null;
    const rows = weightPetId !== null ? weightSeries(state, weightPetId).slice().reverse() : [];
    return '<div class="card"><h2>' + esc(t('addWeight')) + '</h2>' +
      '<form id="weight-form" novalidate>' +
      '<div class="row"><div><label for="weight-pet">' + esc(t('feedingPet')) + '</label>' + petOptions(weightPetId, 'weight-pet') + '</div>' +
      '<div><label for="weight-date">' + esc(t('weightDate')) + '</label><input id="weight-date" type="date" value="' + todayStr(ASOF) + '"></div>' +
      '<div><label for="weight-kg">' + esc(t('weightKg')) + '</label><input id="weight-kg" type="number" min="0" max="300" step="0.01"></div></div>' +
      '<div style="margin-top:12px"><button class="btn" type="submit" id="weight-submit">' + esc(t('save')) + '</button></div>' +
      '<div class="err" id="weight-form-err"></div><div class="ok" id="weight-form-ok"></div>' +
      '</form></div>' +
      '<div class="card"><h2>' + esc(t('weightChart')) + '</h2>' +
      (weightPetId !== null ? weightChart(weightPetId) : '<p class="empty">' + esc(t('noPetsYet')) + '</p>') + '</div>' +
      '<div class="card"><h2>' + esc(t('weightHistory')) + '</h2>' +
      (rows.length ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t('weightDate')) + '</th><th>' + esc(t('weightKg')) + '</th><th></th></tr></thead><tbody>' +
        rows.map(w => '<tr><td>' + esc(fmtDate(w.date)) + '</td><td>' + esc(fmtKg(w.weightKg)) + '</td><td><button type="button" class="btn small danger" data-action="delete-weight" data-id="' + w.id + '">' + esc(t('delete')) + '</button></td></tr>').join('') +
        '</tbody></table></div>' : '<p class="empty">' + esc(t('noWeights')) + '</p>') + '</div>';
  }

  // ---------------- Data ----------------
  function renderData() {
    return '<div class="card"><h2>' + esc(t('dataTitle')) + '</h2>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn" type="button" id="export-btn">' + esc(t('exportBtn')) + '</button>' +
      '<label class="btn secondary" for="import-file" style="cursor:pointer">' + esc(t('importBtn')) + '</label>' +
      '<input type="file" id="import-file" accept=".json,application/json" class="hidden">' +
      '</div>' +
      '<div class="ok" id="import-msg"></div>' +
      '<h3>' + esc(t('eraseTitle')) + '</h3>' +
      '<p class="muted">' + esc(t('eraseHint')) + '</p>' +
      '<div class="row" style="max-width:420px"><input id="erase-input" placeholder="' + esc(t('erasePlaceholder')) + '">' +
      '<button class="btn danger" type="button" id="erase-btn">' + esc(t('eraseBtn')) + '</button></div>' +
      '<div class="err" id="erase-msg"></div></div>';
  }

  // ---------------- render + events ----------------
  function render() {
    applyStaticLang();
    const renderers = { dashboard: renderDashboard, pets: renderPets, feeding: renderFeeding, vaccines: renderVaccines, visits: renderVisits, weight: renderWeight, data: renderData };
    ['dashboard', 'pets', 'feeding', 'vaccines', 'visits', 'weight', 'data'].forEach(tab => {
      const el = document.getElementById('tab-' + tab);
      if (tab === activeTab) { el.innerHTML = renderers[tab](); el.classList.remove('hidden'); }
      else { el.classList.add('hidden'); }
    });
    wireForms();
  }

  function switchTab(tab) {
    activeTab = tab;
    render();
  }

  function wireForms() {
    const $ = id => document.getElementById(id);

    const petForm = $('pet-form');
    if (petForm) petForm.addEventListener('submit', e => {
      e.preventDefault();
      const p = { name: $('pet-name').value, species: $('pet-species').value, breed: $('pet-breed').value, sex: $('pet-sex').value, dob: $('pet-dob').value, weightKg: $('pet-weight').value, notes: $('pet-notes').value };
      const errors = validatePet(p);
      showErr('pet-form-err', errors);
      if (errors.length) return;
      let res;
      if (editingPetId !== null) { res = updatePet(state, editingPetId, p); editingPetId = null; }
      else res = addPet(state, p);
      if (!res.ok) { showErr('pet-form-err', res.errors); return; }
      save(); render();
      const ok = document.getElementById('pet-form-ok'); if (ok) ok.textContent = t('saved');
    });
    const petCancel = $('pet-cancel');
    if (petCancel) petCancel.addEventListener('click', () => { editingPetId = null; render(); });

    const feedingForm = $('feeding-form');
    if (feedingForm) feedingForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = { petId: Number($('feeding-pet').value), date: $('feeding-date').value, time: $('feeding-time').value, food: $('feeding-food').value, amount: $('feeding-amount').value, unit: $('feeding-unit').value, note: $('feeding-note').value };
      const errors = validateFeeding(f, ASOF);
      showErr('feeding-form-err', errors);
      if (errors.length) return;
      const res = addFeeding(state, f, ASOF);
      if (!res.ok) { showErr('feeding-form-err', res.errors); return; }
      save(); render();
      const ok = document.getElementById('feeding-form-ok'); if (ok) ok.textContent = t('saved');
    });

    const vaccineForm = $('vaccine-form');
    if (vaccineForm) {
      const preset = $('vaccine-preset');
      preset.addEventListener('change', () => { $('vaccine-name').value = preset.value; });
      vaccineForm.addEventListener('submit', e => {
        e.preventDefault();
        const v = { petId: Number($('vaccine-pet').value), name: $('vaccine-name').value, givenDate: $('vaccine-given').value, dueDate: $('vaccine-due').value, note: $('vaccine-note').value };
        const errors = validateVaccine(v, ASOF);
        showErr('vaccine-form-err', errors);
        if (errors.length) return;
        const res = addVaccine(state, v, ASOF);
        if (!res.ok) { showErr('vaccine-form-err', res.errors); return; }
        save(); render();
        const ok = document.getElementById('vaccine-form-ok'); if (ok) ok.textContent = t('saved');
      });
    }

    const visitForm = $('visit-form');
    if (visitForm) visitForm.addEventListener('submit', e => {
      e.preventDefault();
      const v = { petId: Number($('visit-pet').value), date: $('visit-date').value, reason: $('visit-reason').value, clinic: $('visit-clinic').value, costPaisa: $('visit-cost').value === '' ? 0 : toPaisa($('visit-cost').value), note: $('visit-note').value };
      const errors = validateVisit(v, ASOF);
      showErr('visit-form-err', errors);
      if (errors.length) return;
      const res = addVisit(state, v, ASOF);
      if (!res.ok) { showErr('visit-form-err', res.errors); return; }
      save(); render();
      const ok = document.getElementById('visit-form-ok'); if (ok) ok.textContent = t('saved');
    });

    const weightForm = $('weight-form');
    if (weightForm) {
      $('weight-pet').addEventListener('change', () => { weightPetId = Number($('weight-pet').value); render(); });
      weightForm.addEventListener('submit', e => {
        e.preventDefault();
        const w = { petId: Number($('weight-pet').value), date: $('weight-date').value, weightKg: $('weight-kg').value };
        const errors = validateWeight(w, ASOF);
        showErr('weight-form-err', errors);
        if (errors.length) return;
        const res = addWeight(state, w, ASOF);
        if (!res.ok) { showErr('weight-form-err', res.errors); return; }
        save(); render();
        const ok = document.getElementById('weight-form-ok'); if (ok) ok.textContent = t('saved');
      });
    }

    const exportBtn = $('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(exportData(state), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pet-care-tracker-bd-backup.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const importFile = $('import-file');
    if (importFile) importFile.addEventListener('change', () => {
      const file = importFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const res = validateImport(JSON.parse(reader.result));
          if (!res.ok) { const m = $('import-msg'); if (m) { m.textContent = t('importBad'); m.className = 'err'; } return; }
          state = res.data; save(); render();
          const m = document.getElementById('import-msg'); if (m) { m.textContent = t('importOk'); m.className = 'ok'; }
        } catch (err2) {
          const m = $('import-msg'); if (m) { m.textContent = t('importBad'); m.className = 'err'; }
        }
      };
      reader.readAsText(file);
    });
    const eraseBtn = $('erase-btn');
    if (eraseBtn) eraseBtn.addEventListener('click', () => {
      const input = $('erase-input');
      if (input.value !== 'DELETE') { const m = $('erase-msg'); if (m) m.textContent = t('eraseWrong'); return; }
      const lang = state.lang;
      state = emptyState(); state.lang = lang; save(); render();
      const m = document.getElementById('erase-msg'); if (m) m.textContent = t('erased');
    });
  }

  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) { editingPetId = null; switchTab(btn.getAttribute('data-tab')); }
  });

  document.getElementById('langBtn').addEventListener('click', () => {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    save(); render();
  });

  document.querySelector('main').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = Number(btn.getAttribute('data-id'));
    if (action === 'delete-pet') {
      if (confirm(t('confirmDeletePet'))) { deletePet(state, id); save(); render(); }
    } else if (action === 'edit-pet') {
      editingPetId = id; switchTab('pets');
    } else if (action === 'delete-feeding') { deleteFeeding(state, id); save(); render(); }
    else if (action === 'delete-vaccine') { deleteVaccine(state, id); save(); render(); }
    else if (action === 'mark-given') { markVaccineGiven(state, id, ASOF); save(); render(); }
    else if (action === 'delete-visit') { deleteVisit(state, id); save(); render(); }
    else if (action === 'delete-weight') { deleteWeight(state, id); save(); render(); }
  });

  render();
})();
