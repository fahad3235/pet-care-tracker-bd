'use strict';
/* Pet Care Tracker BD \u2014 pure logic (no DOM). Testable in Node and in the browser.
   Money is integer paisa (1 BDT = 100 paisa) to avoid float error.
   Dates are ISO strings YYYY-MM-DD. `asof` is an ISO date string (today). */

const SPECIES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'other'];
const SEXES = ['male', 'female', 'unknown'];
const FOOD_TYPES = ['dry', 'wet', 'homemade', 'treat', 'other'];
const WEIGHT_UNITS = ['g', 'ml'];
const VACCINE_PRESETS = ['rabies', 'distemper', 'parvo', 'feline-panleukopenia', 'feline-calicivirus', 'deworming', 'other'];

const BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

function toBengaliDigits(str) {
  return String(str).replace(/[0-9]/g, d => BN_DIGITS[Number(d)]);
}

function formatNumber(n, lang) {
  const s = String(n);
  return lang === 'bn' ? toBengaliDigits(s) : s;
}

// ---------- date helpers ----------
function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function todayStr(asof) { return asof || new Date().toISOString().slice(0, 10); }

function daysBetween(a, b) {
  // whole days from a to b (b - a); both ISO date strings
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round((db - da) / 86400000);
}

function isFutureDate(s, asof) {
  return isValidDateStr(s) && daysBetween(todayStr(asof), s) > 0;
}

// Age from date of birth: { years, months, days } or null when dob missing/invalid.
function petAge(dob, asof) {
  if (!dob || !isValidDateStr(dob)) return null;
  const t = todayStr(asof);
  if (daysBetween(dob, t) < 0) return null;
  const [y1, m1, d1] = dob.split('-').map(Number);
  const [y2, m2, d2] = t.split('-').map(Number);
  let years = y2 - y1;
  let months = m2 - m1;
  let days = d2 - d1;
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(Date.UTC(y2, m2 - 1, 0));
    days += prevMonth.getUTCDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

function formatAge(age, lang) {
  if (!age) return '\u2014';
  const parts = [];
  if (age.years > 0) parts.push(formatNumber(age.years, lang) + (lang === 'bn' ? ' \u09ac\u099b\u09b0' : (age.years === 1 ? ' yr' : ' yrs')));
  if (age.months > 0) parts.push(formatNumber(age.months, lang) + (lang === 'bn' ? ' \u09ae\u09be\u09b8' : (age.months === 1 ? ' mo' : ' mos')));
  if (parts.length === 0) parts.push(formatNumber(age.days, lang) + (lang === 'bn' ? ' \u09a6\u09bf\u09a8' : (age.days === 1 ? ' day' : ' days')));
  return parts.join(' ');
}

// ---------- money ----------
function toPaisa(bdt) {
  const n = Number(bdt);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function fromPaisa(paisa) {
  return (paisa / 100).toFixed(2);
}

function formatBDT(paisa, lang) {
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const out = (lang === 'bn' ? '\u09f3' : '\u09f3') + sign + grouped + '.' + frac;
  return lang === 'bn' ? toBengaliDigits(out) : out;
}

// ---------- state ----------
function emptyState() {
  return { pets: [], feedings: [], vaccines: [], visits: [], weights: [], lang: 'en', nextId: 1 };
}

function nextId(state) {
  const id = state.nextId || 1;
  state.nextId = id + 1;
  return id;
}

function findPet(state, id) {
  return state.pets.find(p => p.id === id) || null;
}

// ---------- validation ----------
function err(field, code) { return { field, code }; }

function validatePet(p) {
  const errors = [];
  if (!p.name || !String(p.name).trim()) errors.push(err('name', 'required'));
  else if (String(p.name).trim().length > 60) errors.push(err('name', 'too_long'));
  if (!SPECIES.includes(p.species)) errors.push(err('species', 'invalid'));
  if (!SEXES.includes(p.sex)) errors.push(err('sex', 'invalid'));
  if (p.dob) {
    if (!isValidDateStr(p.dob)) errors.push(err('dob', 'invalid'));
    else if (isFutureDate(p.dob)) errors.push(err('dob', 'future'));
  }
  if (p.weightKg !== '' && p.weightKg !== null && p.weightKg !== undefined) {
    const w = Number(p.weightKg);
    if (!Number.isFinite(w) || w <= 0 || w > 300) errors.push(err('weightKg', 'invalid'));
  }
  if (p.breed && String(p.breed).length > 60) errors.push(err('breed', 'too_long'));
  if (p.notes && String(p.notes).length > 500) errors.push(err('notes', 'too_long'));
  return errors;
}

function validateFeeding(f, asof) {
  const errors = [];
  if (!Number.isInteger(f.petId)) errors.push(err('petId', 'invalid'));
  if (!isValidDateStr(f.date)) errors.push(err('date', 'invalid'));
  else if (isFutureDate(f.date, asof)) errors.push(err('date', 'future'));
  if (!/^\d{2}:\d{2}$/.test(f.time || '')) errors.push(err('time', 'invalid'));
  else {
    const [h, m] = f.time.split(':').map(Number);
    if (h > 23 || m > 59) errors.push(err('time', 'invalid'));
  }
  if (!FOOD_TYPES.includes(f.food)) errors.push(err('food', 'invalid'));
  const amt = Number(f.amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > 100000) errors.push(err('amount', 'invalid'));
  if (!WEIGHT_UNITS.includes(f.unit)) errors.push(err('unit', 'invalid'));
  if (f.note && String(f.note).length > 300) errors.push(err('note', 'too_long'));
  return errors;
}

function validateVaccine(v, asof) {
  const errors = [];
  if (!Number.isInteger(v.petId)) errors.push(err('petId', 'invalid'));
  if (!v.name || !String(v.name).trim()) errors.push(err('name', 'required'));
  else if (String(v.name).trim().length > 60) errors.push(err('name', 'too_long'));
  if (v.givenDate) {
    if (!isValidDateStr(v.givenDate)) errors.push(err('givenDate', 'invalid'));
    else if (isFutureDate(v.givenDate, asof)) errors.push(err('givenDate', 'future'));
  }
  if (v.dueDate) {
    if (!isValidDateStr(v.dueDate)) errors.push(err('dueDate', 'invalid'));
    // dueDate may be past (overdue) \u2014 that is meaningful, not an error.
  }
  if (v.givenDate && v.dueDate && isValidDateStr(v.givenDate) && isValidDateStr(v.dueDate)) {
    if (daysBetween(v.givenDate, v.dueDate) < 0) errors.push(err('dueDate', 'before_given'));
  }
  if (v.note && String(v.note).length > 300) errors.push(err('note', 'too_long'));
  return errors;
}

function validateVisit(v, asof) {
  const errors = [];
  if (!Number.isInteger(v.petId)) errors.push(err('petId', 'invalid'));
  if (!isValidDateStr(v.date)) errors.push(err('date', 'invalid'));
  else if (isFutureDate(v.date, asof)) errors.push(err('date', 'future'));
  if (!v.reason || !String(v.reason).trim()) errors.push(err('reason', 'required'));
  else if (String(v.reason).trim().length > 120) errors.push(err('reason', 'too_long'));
  if (v.clinic && String(v.clinic).length > 80) errors.push(err('clinic', 'too_long'));
  if (v.costPaisa !== '' && v.costPaisa !== null && v.costPaisa !== undefined) {
    if (!Number.isInteger(v.costPaisa) || v.costPaisa < 0 || v.costPaisa > 100000000) errors.push(err('costPaisa', 'invalid'));
  }
  if (v.note && String(v.note).length > 500) errors.push(err('note', 'too_long'));
  return errors;
}

function validateWeight(w, asof) {
  const errors = [];
  if (!Number.isInteger(w.petId)) errors.push(err('petId', 'invalid'));
  if (!isValidDateStr(w.date)) errors.push(err('date', 'invalid'));
  else if (isFutureDate(w.date, asof)) errors.push(err('date', 'future'));
  const kg = Number(w.weightKg);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 300) errors.push(err('weightKg', 'invalid'));
  return errors;
}

// ---------- CRUD ----------
function addPet(state, p) {
  const errors = validatePet(p);
  if (errors.length) return { ok: false, errors };
  const pet = {
    id: nextId(state),
    name: String(p.name).trim(),
    species: p.species,
    breed: (p.breed || '').trim(),
    sex: p.sex,
    dob: p.dob || '',
    weightKg: (p.weightKg === '' || p.weightKg === null || p.weightKg === undefined) ? null : Number(p.weightKg),
    notes: (p.notes || '').trim(),
    createdAt: todayStr()
  };
  state.pets.push(pet);
  return { ok: true, pet };
}

function updatePet(state, id, p) {
  const pet = findPet(state, id);
  if (!pet) return { ok: false, errors: [err('id', 'not_found')] };
  const errors = validatePet(p);
  if (errors.length) return { ok: false, errors };
  pet.name = String(p.name).trim();
  pet.species = p.species;
  pet.breed = (p.breed || '').trim();
  pet.sex = p.sex;
  pet.dob = p.dob || '';
  pet.weightKg = (p.weightKg === '' || p.weightKg === null || p.weightKg === undefined) ? null : Number(p.weightKg);
  pet.notes = (p.notes || '').trim();
  return { ok: true, pet };
}

function deletePet(state, id) {
  const idx = state.pets.findIndex(p => p.id === id);
  if (idx === -1) return false;
  state.pets.splice(idx, 1);
  for (const key of ['feedings', 'vaccines', 'visits', 'weights']) {
    state[key] = state[key].filter(r => r.petId !== id);
  }
  return true;
}

function addFeeding(state, f, asof) {
  const errors = validateFeeding(f, asof);
  if (errors.length) return { ok: false, errors };
  if (!findPet(state, f.petId)) return { ok: false, errors: [err('petId', 'not_found')] };
  const rec = { id: nextId(state), petId: f.petId, date: f.date, time: f.time, food: f.food, amount: Number(f.amount), unit: f.unit, note: (f.note || '').trim() };
  state.feedings.push(rec);
  return { ok: true, feeding: rec };
}

function deleteFeeding(state, id) {
  const idx = state.feedings.findIndex(r => r.id === id);
  if (idx === -1) return false;
  state.feedings.splice(idx, 1);
  return true;
}

function addVaccine(state, v, asof) {
  const errors = validateVaccine(v, asof);
  if (errors.length) return { ok: false, errors };
  if (!findPet(state, v.petId)) return { ok: false, errors: [err('petId', 'not_found')] };
  const rec = { id: nextId(state), petId: v.petId, name: String(v.name).trim(), givenDate: v.givenDate || '', dueDate: v.dueDate || '', note: (v.note || '').trim() };
  state.vaccines.push(rec);
  return { ok: true, vaccine: rec };
}

function deleteVaccine(state, id) {
  const idx = state.vaccines.findIndex(r => r.id === id);
  if (idx === -1) return false;
  state.vaccines.splice(idx, 1);
  return true;
}

// Mark a vaccine dose as given today; clears the due date (user adds the next due date).
function markVaccineGiven(state, id, asof) {
  const v = state.vaccines.find(r => r.id === id);
  if (!v) return false;
  v.givenDate = todayStr(asof);
  v.dueDate = '';
  return true;
}

function addVisit(state, v, asof) {
  const errors = validateVisit(v, asof);
  if (errors.length) return { ok: false, errors };
  if (!findPet(state, v.petId)) return { ok: false, errors: [err('petId', 'not_found')] };
  const rec = { id: nextId(state), petId: v.petId, date: v.date, reason: String(v.reason).trim(), clinic: (v.clinic || '').trim(), costPaisa: (v.costPaisa === '' || v.costPaisa === null || v.costPaisa === undefined) ? 0 : v.costPaisa, note: (v.note || '').trim() };
  state.visits.push(rec);
  return { ok: true, visit: rec };
}

function deleteVisit(state, id) {
  const idx = state.visits.findIndex(r => r.id === id);
  if (idx === -1) return false;
  state.visits.splice(idx, 1);
  return true;
}

function addWeight(state, w, asof) {
  const errors = validateWeight(w, asof);
  if (errors.length) return { ok: false, errors };
  if (!findPet(state, w.petId)) return { ok: false, errors: [err('petId', 'not_found')] };
  const rec = { id: nextId(state), petId: w.petId, date: w.date, weightKg: Number(w.weightKg) };
  state.weights.push(rec);
  // keep the pet profile's current weight in sync with the newest entry
  const pet = findPet(state, w.petId);
  const series = weightSeries(state, w.petId);
  if (series.length && series[series.length - 1].id === rec.id) pet.weightKg = rec.weightKg;
  return { ok: true, weight: rec };
}

function deleteWeight(state, id) {
  const idx = state.weights.findIndex(r => r.id === id);
  if (idx === -1) return false;
  state.weights.splice(idx, 1);
  return true;
}

// ---------- derived ----------
function vaccineStatus(v, asof) {
  if (!v.dueDate) return 'no-due';
  const diff = daysBetween(todayStr(asof), v.dueDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  if (diff <= 14) return 'due-soon';
  return 'up-to-date';
}

function upcomingVaccines(state, asof) {
  return state.vaccines
    .filter(v => v.dueDate)
    .map(v => ({ v, days: daysBetween(todayStr(asof), v.dueDate) }))
    .sort((a, b) => a.days - b.days)
    .map(x => x.v);
}

function feedingsToday(state, asof, petId) {
  const t = todayStr(asof);
  return state.feedings.filter(f => f.date === t && (petId === undefined || f.petId === petId));
}

function weightSeries(state, petId) {
  return state.weights
    .filter(w => w.petId === petId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
}

function latestWeight(state, petId) {
  const series = weightSeries(state, petId);
  return series.length ? series[series.length - 1] : null;
}

function totalVetSpend(state, petId) {
  return state.visits
    .filter(v => petId === undefined || v.petId === petId)
    .reduce((sum, v) => sum + (v.costPaisa || 0), 0);
}

function dashboardStats(state, asof) {
  const t = todayStr(asof);
  const overdue = state.vaccines.filter(v => vaccineStatus(v, t) === 'overdue').length;
  const dueSoon = state.vaccines.filter(v => ['due-today', 'due-soon'].includes(vaccineStatus(v, t))).length;
  return {
    petCount: state.pets.length,
    feedingsToday: feedingsToday(state, t).length,
    overdueVaccines: overdue,
    dueSoonVaccines: dueSoon,
    totalVetSpend: totalVetSpend(state),
    visitCount: state.visits.length
  };
}

// ---------- export / import ----------
function exportData(state) {
  return { version: 1, app: 'pet-care-tracker-bd', exportedAt: new Date().toISOString(), data: state };
}

function validateImport(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: [err('root', 'not_object')] };
  const data = obj.data || obj;
  if (!data || typeof data !== 'object') return { ok: false, errors: [err('root', 'not_object')] };
  for (const key of ['pets', 'feedings', 'vaccines', 'visits', 'weights']) {
    if (!Array.isArray(data[key])) return { ok: false, errors: [err(key, 'not_array')] };
  }
  const errors = [];
  const petIds = new Set();
  for (const p of data.pets) {
    if (!p || typeof p !== 'object' || !Number.isInteger(p.id)) { errors.push(err('pets', 'bad_id')); continue; }
    if (petIds.has(p.id)) errors.push(err('pets', 'dup_id'));
    petIds.add(p.id);
    const ve = validatePet(p);
    if (ve.length) errors.push(...ve.map(e => err('pets.' + e.field, e.code)));
  }
  const checkPetRef = (rec, key) => {
    if (!Number.isInteger(rec.petId) || !petIds.has(rec.petId)) errors.push(err(key, 'unknown_pet'));
  };
  for (const f of data.feedings) {
    if (!f || typeof f !== 'object' || !Number.isInteger(f.id)) { errors.push(err('feedings', 'bad_id')); continue; }
    checkPetRef(f, 'feedings');
    const ve = validateFeeding(f);
    if (ve.length) errors.push(...ve.map(e => err('feedings.' + e.field, e.code)));
  }
  for (const v of data.vaccines) {
    if (!v || typeof v !== 'object' || !Number.isInteger(v.id)) { errors.push(err('vaccines', 'bad_id')); continue; }
    checkPetRef(v, 'vaccines');
    const ve = validateVaccine(v);
    if (ve.length) errors.push(...ve.map(e => err('vaccines.' + e.field, e.code)));
  }
  for (const v of data.visits) {
    if (!v || typeof v !== 'object' || !Number.isInteger(v.id)) { errors.push(err('visits', 'bad_id')); continue; }
    checkPetRef(v, 'visits');
    const ve = validateVisit(v);
    if (ve.length) errors.push(...ve.map(e => err('visits.' + e.field, e.code)));
  }
  for (const w of data.weights) {
    if (!w || typeof w !== 'object' || !Number.isInteger(w.id)) { errors.push(err('weights', 'bad_id')); continue; }
    checkPetRef(w, 'weights');
    const ve = validateWeight(w);
    if (ve.length) errors.push(...ve.map(e => err('weights.' + e.field, e.code)));
  }
  if (errors.length) return { ok: false, errors };
  // normalize: rebuild a clean state
  const clean = emptyState();
  clean.pets = data.pets.map(p => ({ id: p.id, name: String(p.name).trim(), species: p.species, breed: (p.breed || '').trim(), sex: p.sex, dob: p.dob || '', weightKg: (p.weightKg === '' || p.weightKg === null || p.weightKg === undefined) ? null : Number(p.weightKg), notes: (p.notes || '').trim(), createdAt: p.createdAt || '' }));
  clean.feedings = data.feedings.map(f => ({ id: f.id, petId: f.petId, date: f.date, time: f.time, food: f.food, amount: Number(f.amount), unit: f.unit, note: (f.note || '').trim() }));
  clean.vaccines = data.vaccines.map(v => ({ id: v.id, petId: v.petId, name: String(v.name).trim(), givenDate: v.givenDate || '', dueDate: v.dueDate || '', note: (v.note || '').trim() }));
  clean.visits = data.visits.map(v => ({ id: v.id, petId: v.petId, date: v.date, reason: String(v.reason).trim(), clinic: (v.clinic || '').trim(), costPaisa: Number.isInteger(v.costPaisa) ? v.costPaisa : 0, note: (v.note || '').trim() }));
  clean.weights = data.weights.map(w => ({ id: w.id, petId: w.petId, date: w.date, weightKg: Number(w.weightKg) }));
  const maxId = Math.max(0, ...clean.pets.map(p => p.id), ...clean.feedings.map(f => f.id), ...clean.vaccines.map(v => v.id), ...clean.visits.map(v => v.id), ...clean.weights.map(w => w.id));
  clean.nextId = maxId + 1;
  clean.lang = (data.lang === 'bn' || data.lang === 'en') ? data.lang : 'en';
  return { ok: true, data: clean };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SPECIES, SEXES, FOOD_TYPES, WEIGHT_UNITS, VACCINE_PRESETS,
    toBengaliDigits, formatNumber, isValidDateStr, todayStr, daysBetween, isFutureDate,
    petAge, formatAge, toPaisa, fromPaisa, formatBDT,
    emptyState, nextId, findPet,
    validatePet, validateFeeding, validateVaccine, validateVisit, validateWeight,
    addPet, updatePet, deletePet, addFeeding, deleteFeeding,
    addVaccine, deleteVaccine, markVaccineGiven,
    addVisit, deleteVisit, addWeight, deleteWeight,
    vaccineStatus, upcomingVaccines, feedingsToday, weightSeries, latestWeight,
    totalVetSpend, dashboardStats, exportData, validateImport
  };
}
