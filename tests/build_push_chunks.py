#!/usr/bin/env python3
"""Build ASCII-safe push_files JSON chunks for pet-care-tracker-bd.
Writes /tmp/push_a.json and /tmp/push_b.json (ensure_ascii=True).
Each chunk's JSON stays well under the ~90KB argv guideline."""
import json, os

BASE = os.path.expanduser('~/workspace/muse-project-factory/builds/pet-care-tracker-bd')

def read(rel):
    with open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return f.read()

chunks = [
    ('/tmp/push_a.json', 'Pet Care Tracker BD: initial commit (1/2) — app + docs', [
        'index.html', 'js/logic.js', 'js/i18n.js', 'README.md', 'TEST_RESULTS.md', '.gitignore',
    ]),
    ('/tmp/push_b.json', 'Pet Care Tracker BD: initial commit (2/2) — app controller + tests', [
        'js/app.js', 'tests/run-node-tests.js', 'tests/smoke.mjs', 'tests/ascii_hygiene.py',
    ]),
]

for out, msg, files in chunks:
    payload = {
        'owner': 'fahad3235',
        'repo': 'pet-care-tracker-bd',
        'branch': 'main',
        'message': msg,
        'files': [{'path': rel, 'content': read(rel)} for rel in files],
    }
    text = json.dumps(payload, ensure_ascii=True)
    with open(out, 'w', encoding='ascii') as f:
        f.write(text)
    print(out, len(text.encode('ascii')), 'bytes, files:', len(files))
    assert all(ord(c) < 128 for c in text), 'non-ASCII leaked into ' + out
    assert len(text.encode('ascii')) < 90000, 'chunk too big: ' + out
print('OK — both chunks ASCII-safe and under 90KB')
