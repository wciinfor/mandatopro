with open('src/pages/solicitacoes/index.js', 'rb') as f:
    raw = f.read()
if raw.startswith(b'\xef\xbb\xbf'):
    raw = raw[3:]

text = raw.decode('utf-8')

subst_real = [
    ('\u00c3\u00a7\u00c3\u00a3o', '\u00e7\u00e3o'),
    ('\u00c3\u00b5es', '\u00f5es'),
    ('\u00c3\u2030DIA', 'M\u00c9DIA'),
    ('\u00c3\u00a9dia', '\u00e9dia'),
    ('\u00c3\u00aa', '\u00ea'),
    ('\u00c3\u00a1', '\u00e1'),
    ('\u00c3\u00a7\u00c3\u00a3', '\u00e7\u00e3'),
    ('\u00c3\u00a7', '\u00e7'),
    ('\u00c3\u00a3', '\u00e3'),
    ('\u00c3\u00b5', '\u00f5'),
    ('\u00c3\u00ba', '\u00fa'),
    ('\u00c3\u00ad', '\u00ed'),
    ('\u00c3\u00b3', '\u00f3'),
    ('\u00c3\u0081', '\u00c1'),
    ('\u00c3\u0089', '\u00c9'),
    ('\u00c3\u2021AO', '\u00c7\u00c3O'),
    ('\u00e2\u20ac\u201c', '\u2014'),
    ('\u00e2\u0094\u0080', '\u2500'),
]

fixed = text
for bad, good in subst_real:
    fixed = fixed.replace(bad, good)

fixed = fixed.replace('SOLICITA\u00c7AO', 'SOLICITA\u00c7\u00c3O')

with open('src/pages/solicitacoes/index.js', 'w', encoding='utf-8') as f:
    f.write(fixed)

print('DONE')
remaining = [(i+1, l) for i, l in enumerate(fixed.split('\n')) if '\u00c3' in l]
print('Remaining issues:', len(remaining))
for num, line in remaining:
    print('  L' + str(num) + ': ' + line.strip()[:80])
