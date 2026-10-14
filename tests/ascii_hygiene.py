#!/usr/bin/env python3
"""Convert non-ASCII chars in JS sources to \\uXXXX escapes (factory ASCII hygiene).
Only escapes chars outside printable ASCII; leaves everything else byte-identical.
Usage: python3 ascii_hygiene.py <file.js> [...]"""
import sys

for path in sys.argv[1:]:
    with open(path, encoding='utf-8') as f:
        text = f.read()
    out = []
    for ch in text:
        o = ord(ch)
        if o > 126:
            if o <= 0xFFFF:
                out.append('\\u%04x' % o)
            else:
                o -= 0x10000
                out.append('\\u%04x\\u%04x' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
        else:
            out.append(ch)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(''.join(out))
    print('converted', path)
