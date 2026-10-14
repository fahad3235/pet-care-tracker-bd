'use strict';
const assert = require('assert');
const L = require('../js/logic.js');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}
const ASOF = '2026-10-14';

// dates
check('isValidDateStr rejects 2026-02-30', () => assert.strictEqual(L.isValidDateStr('2026-02-30'), false));
check('isValidDateStr accepts leap 2024-02-29', () => assert.strictEqual(L.isValidDateStr('2024-02-29'), true));
check('isValidDateStr rejects 2023-02-29', () => assert.strictEqual(L.isValidDateStr('2023-02-29'), false));
check('daysBetween', () => assert.strictEqual(L.daysBetween('2026-10-01', '2026-10-14'), 13));
check('daysBetween negative', () => assert.strictEqual(L.daysBetween('2026-10-14', '2026-10-01'), -13));

// age
check('petAge 2020-05-10 @ 2026-10-14 = 6y 5m', () => {
  assert.deepStrictEqual(L.petAge('2020-05-10', ASOF), { years: 6, months: 5, days: 4 });
});
check('petAge newborn same day', () => {
  assert.deepStrictEqual(L.petAge('2026-10-14', ASOF), { years: 0, months: 0, days: 0 });
});
check('petAge future dob null', () => assert.strictEqual(L.petAge('2027-01-01', ASOF), null));
check('petAge month borrow: 2026-01-20 @ 2026-10-14', () => {
  assert.deepStrictEqual(L.petAge('2026-01-20', ASOF), { years: 0, months: 8, days: 24 });
});
check('formatAge EN', () => assert.strictEqual(L.formatAge({ years: 2, months: 1, days: 0 }, 'en'), '2 yrs 1 mo'));
check('formatAge BN', () => assert.strictEqual(L.formatAge({ years: 1, months: 0, days: 0 }, 'bn'), '\u09e7 \u09ac\u099b\u09b0'));
check('formatAge days only', () => assert.strictEqual(L.formatAge({ years: 0, months: 0, days: 5 }, 'en'), '5 days'));

// money
check('toPaisa 123.45', () => assert.strictEqual(L.toPaisa(123.45), 12345));
check('toPaisa rounds 0.005-ish', () => assert.strictEqual(L.toPaisa(10.1), 1010));
check('fromPaisa', () => assert.strictEqual(L.fromPaisa(12345), '123.45'));
check('formatBDT EN grouping', () => assert.strictEqual(L.formatBDT(1234567, 'en'), '\u09f312,345.67'));
check('formatBDT BN digits', () => assert.strictEqual(L.formatBDT(1234567, 'bn'), '\u09f3\u09e7\u09e8,\u09e9\u09ea\u09eb.\u09ec\u09ed'));
check('toBengaliDigits', () => assert.strictEqual(L.toBengaliDigits('2026-10-14'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e6-\u09e7\u09ea'));

// pet validation + CRUD
check('validatePet empty name', () => assert.ok(L.validatePet({ name: ' ', species: 'dog', sex: 'male' }).some(e => e.field === 'name')));
check('validatePet bad species', () => assert.ok(L.validatePet({ name: 'A', species: 'dragon', sex: 'male' }).some(e => e.field === 'species')));
check('validatePet future dob', () => assert.ok(L.validatePet({ name: 'A', species: 'dog', sex: 'male', dob: '2030-01-01' }).some(e => e.code === 'future')));
check('validatePet weight 0 invalid', () => assert.ok(L.validatePet({ name: 'A', species: 'dog', sex: 'male', weightKg: 0 }).some(e => e.field === 'weightKg')));
check('validatePet weight 301 invalid', () => assert.ok(L.validatePet({ name: 'A', species: 'dog', sex: 'male', weightKg: 301 }).some(e => e.field === 'weightKg')));
check('addPet + findPet', () => {
  const s = L.emptyState();
  const r = L.addPet(s, { name: 'Mimi', species: 'cat', sex: 'female', dob: '2021-03-05', weightKg: 3.5 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(L.findPet(s, r.pet.id).name, 'Mimi');
  assert.strictEqual(s.pets.length, 1);
});
check('updatePet', () => {
  const s = L.emptyState();
  const r = L.addPet(s, { name: 'Mimi', species: 'cat', sex: 'female' });
  const u = L.updatePet(s, r.pet.id, { name: 'Mimi 2', species: 'cat', sex: 'female' });
  assert.strictEqual(u.ok, true);
  assert.strictEqual(L.findPet(s, r.pet.id).name, 'Mimi 2');
});
check('updatePet unknown id', () => {
  const s = L.emptyState();
  assert.strictEqual(L.updatePet(s, 99, { name: 'X', species: 'dog', sex: 'male' }).ok, false);
});
check('deletePet cascades', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'Babu', species: 'dog', sex: 'male' }).pet;
  L.addFeeding(s, { petId: p.id, date: '2026-10-14', time: '08:00', food: 'dry', amount: 100, unit: 'g' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'rabies', givenDate: '2026-01-01', dueDate: '2027-01-01' }, ASOF);
  L.addVisit(s, { petId: p.id, date: '2026-10-01', reason: 'Checkup', costPaisa: 50000 }, ASOF);
  L.addWeight(s, { petId: p.id, date: '2026-10-01', weightKg: 12 }, ASOF);
  assert.strictEqual(L.deletePet(s, p.id), true);
  assert.deepStrictEqual([s.pets.length, s.feedings.length, s.vaccines.length, s.visits.length, s.weights.length], [0, 0, 0, 0, 0]);
});

// feeding validation
check('validateFeeding future date', () => assert.ok(L.validateFeeding({ petId: 1, date: '2030-01-01', time: '08:00', food: 'dry', amount: 10, unit: 'g' }, ASOF).some(e => e.code === 'future')));
check('validateFeeding bad time 24:00', () => assert.ok(L.validateFeeding({ petId: 1, date: '2026-10-14', time: '24:00', food: 'dry', amount: 10, unit: 'g' }, ASOF).some(e => e.field === 'time')));
check('validateFeeding amount 0', () => assert.ok(L.validateFeeding({ petId: 1, date: '2026-10-14', time: '08:00', food: 'dry', amount: 0, unit: 'g' }, ASOF).some(e => e.field === 'amount')));
check('addFeeding unknown pet', () => {
  const s = L.emptyState();
  assert.strictEqual(L.addFeeding(s, { petId: 42, date: '2026-10-14', time: '08:00', food: 'dry', amount: 10, unit: 'g' }, ASOF).ok, false);
});
check('feedingsToday counts only today', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'A', species: 'dog', sex: 'male' }).pet;
  L.addFeeding(s, { petId: p.id, date: '2026-10-14', time: '08:00', food: 'dry', amount: 10, unit: 'g' }, ASOF);
  L.addFeeding(s, { petId: p.id, date: '2026-10-13', time: '08:00', food: 'dry', amount: 10, unit: 'g' }, ASOF);
  assert.strictEqual(L.feedingsToday(s, ASOF).length, 1);
  assert.strictEqual(L.feedingsToday(s, ASOF, p.id).length, 1);
});

// vaccine status boundaries
function vStatus(due) { return L.vaccineStatus({ dueDate: due }, ASOF); }
check('vaccineStatus overdue', () => assert.strictEqual(vStatus('2026-10-13'), 'overdue'));
check('vaccineStatus due-today', () => assert.strictEqual(vStatus('2026-10-14'), 'due-today'));
check('vaccineStatus due-soon at +14', () => assert.strictEqual(vStatus('2026-10-28'), 'due-soon'));
check('vaccineStatus up-to-date at +15', () => assert.strictEqual(vStatus('2026-10-29'), 'up-to-date'));
check('vaccineStatus no-due', () => assert.strictEqual(L.vaccineStatus({ dueDate: '' }, ASOF), 'no-due'));
check('validateVaccine due before given', () => assert.ok(L.validateVaccine({ petId: 1, name: 'rabies', givenDate: '2026-10-10', dueDate: '2026-10-01' }, ASOF).some(e => e.code === 'before_given')));
check('validateVaccine past due allowed', () => assert.strictEqual(L.validateVaccine({ petId: 1, name: 'rabies', givenDate: '2025-01-01', dueDate: '2026-01-01' }, ASOF).length, 0));
check('markVaccineGiven sets today + clears due', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'A', species: 'dog', sex: 'male' }).pet;
  const v = L.addVaccine(s, { petId: p.id, name: 'rabies', givenDate: '2025-01-01', dueDate: '2026-01-01' }, ASOF).vaccine;
  assert.strictEqual(L.markVaccineGiven(s, v.id, ASOF), true);
  assert.strictEqual(v.givenDate, '2026-10-14');
  assert.strictEqual(v.dueDate, '');
  assert.strictEqual(L.vaccineStatus(v, ASOF), 'no-due');
});
check('upcomingVaccines sorted overdue-first', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'A', species: 'dog', sex: 'male' }).pet;
  L.addVaccine(s, { petId: p.id, name: 'later', dueDate: '2026-12-01' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'overdue', dueDate: '2026-09-01' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'nodue' }, ASOF);
  const up = L.upcomingVaccines(s, ASOF);
  assert.deepStrictEqual(up.map(v => v.name), ['overdue', 'later']);
});

// visits
check('validateVisit empty reason', () => assert.ok(L.validateVisit({ petId: 1, date: '2026-10-14', reason: ' ' }, ASOF).some(e => e.field === 'reason')));
check('validateVisit negative cost', () => assert.ok(L.validateVisit({ petId: 1, date: '2026-10-14', reason: 'X', costPaisa: -5 }, ASOF).some(e => e.field === 'costPaisa')));
check('totalVetSpend per pet + all', () => {
  const s = L.emptyState();
  const a = L.addPet(s, { name: 'A', species: 'dog', sex: 'male' }).pet;
  const b = L.addPet(s, { name: 'B', species: 'cat', sex: 'female' }).pet;
  L.addVisit(s, { petId: a.id, date: '2026-10-01', reason: 'X', costPaisa: 10000 }, ASOF);
  L.addVisit(s, { petId: b.id, date: '2026-10-01', reason: 'Y', costPaisa: 25050 }, ASOF);
  assert.strictEqual(L.totalVetSpend(s, a.id), 10000);
  assert.strictEqual(L.totalVetSpend(s), 35050);
});

// weights
check('addWeight syncs pet profile to newest', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'A', species: 'dog', sex: 'male', weightKg: 10 }).pet;
  L.addWeight(s, { petId: p.id, date: '2026-10-01', weightKg: 11 }, ASOF);
  assert.strictEqual(L.findPet(s, p.id).weightKg, 11);
  // older entry does NOT move profile weight back
  L.addWeight(s, { petId: p.id, date: '2026-09-01', weightKg: 9 }, ASOF);
  assert.strictEqual(L.findPet(s, p.id).weightKg, 11);
});
check('weightSeries sorted + latestWeight', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'A', species: 'dog', sex: 'male' }).pet;
  L.addWeight(s, { petId: p.id, date: '2026-10-10', weightKg: 12 }, ASOF);
  L.addWeight(s, { petId: p.id, date: '2026-10-01', weightKg: 11 }, ASOF);
  const series = L.weightSeries(s, p.id);
  assert.deepStrictEqual(series.map(w => w.weightKg), [11, 12]);
  assert.strictEqual(L.latestWeight(s, p.id).weightKg, 12);
});
check('validateWeight 0 invalid', () => assert.ok(L.validateWeight({ petId: 1, date: '2026-10-14', weightKg: 0 }, ASOF).some(e => e.field === 'weightKg')));

// dashboard
check('dashboardStats exact', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'A', species: 'dog', sex: 'male' }).pet;
  L.addFeeding(s, { petId: p.id, date: '2026-10-14', time: '08:00', food: 'dry', amount: 10, unit: 'g' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'overdue', dueDate: '2026-10-01' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'soon', dueDate: '2026-10-20' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'later', dueDate: '2027-01-01' }, ASOF);
  L.addVisit(s, { petId: p.id, date: '2026-10-01', reason: 'X', costPaisa: 50000 }, ASOF);
  const d = L.dashboardStats(s, ASOF);
  assert.deepStrictEqual(d, { petCount: 1, feedingsToday: 1, overdueVaccines: 1, dueSoonVaccines: 1, totalVetSpend: 50000, visitCount: 1 });
});

// export / import
check('export->import round-trip preserves all', () => {
  const s = L.emptyState();
  const p = L.addPet(s, { name: 'Mimi', species: 'cat', sex: 'female', dob: '2021-03-05', weightKg: 3.5, notes: 'Shy' }).pet;
  L.addFeeding(s, { petId: p.id, date: '2026-10-14', time: '08:00', food: 'wet', amount: 80, unit: 'g', note: 'ate well' }, ASOF);
  L.addVaccine(s, { petId: p.id, name: 'rabies', givenDate: '2026-01-05', dueDate: '2027-01-05' }, ASOF);
  L.addVisit(s, { petId: p.id, date: '2026-10-01', reason: 'Checkup', clinic: 'Vet Care', costPaisa: 150000, note: 'OK' }, ASOF);
  L.addWeight(s, { petId: p.id, date: '2026-10-01', weightKg: 3.6 }, ASOF);
  const res = L.validateImport(JSON.parse(JSON.stringify(L.exportData(s))));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.pets[0].name, 'Mimi');
  assert.strictEqual(res.data.feedings.length, 1);
  assert.strictEqual(res.data.vaccines.length, 1);
  assert.strictEqual(res.data.visits[0].costPaisa, 150000);
  assert.strictEqual(res.data.weights[0].weightKg, 3.6);
  assert.strictEqual(res.data.nextId, s.nextId);
});
check('import rejects non-object', () => assert.strictEqual(L.validateImport('nope').ok, false));
check('import rejects missing array', () => assert.strictEqual(L.validateImport({ data: { pets: [] } }).ok, false));
check('import rejects dup pet id', () => {
  const bad = { data: { pets: [{ id: 1, name: 'A', species: 'dog', sex: 'male' }, { id: 1, name: 'B', species: 'cat', sex: 'female' }], feedings: [], vaccines: [], visits: [], weights: [] } };
  assert.strictEqual(L.validateImport(bad).ok, false);
});
check('import rejects unknown pet ref', () => {
  const bad = { data: { pets: [{ id: 1, name: 'A', species: 'dog', sex: 'male' }], feedings: [{ id: 2, petId: 99, date: '2026-10-14', time: '08:00', food: 'dry', amount: 10, unit: 'g' }], vaccines: [], visits: [], weights: [] } };
  assert.strictEqual(L.validateImport(bad).ok, false);
});
check('import rejects invalid pet species', () => {
  const bad = { data: { pets: [{ id: 1, name: 'A', species: 'dragon', sex: 'male' }], feedings: [], vaccines: [], visits: [], weights: [] } };
  assert.strictEqual(L.validateImport(bad).ok, false);
});
check('import rejects bad visit cost type', () => {
  const bad = { data: { pets: [{ id: 1, name: 'A', species: 'dog', sex: 'male' }], feedings: [], vaccines: [], visits: [{ id: 2, petId: 1, date: '2026-10-14', reason: 'X', costPaisa: 10.5 }], weights: [] } };
  assert.strictEqual(L.validateImport(bad).ok, false);
});
check('import accepts bare data object', () => {
  const res = L.validateImport({ pets: [], feedings: [], vaccines: [], visits: [], weights: [] });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.nextId, 1);
});
check('deleteFeeding/deleteVaccine/deleteVisit/deleteWeight unknown id false', () => {
  const s = L.emptyState();
  assert.strictEqual(L.deleteFeeding(s, 1), false);
  assert.strictEqual(L.deleteVaccine(s, 1), false);
  assert.strictEqual(L.deleteVisit(s, 1), false);
  assert.strictEqual(L.deleteWeight(s, 1), false);
  assert.strictEqual(L.deletePet(s, 1), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
