with open('c:/BACKUP/DESENVOLVIMENTO/mandato-pro/src/pages/solicitacoes/index.js', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

fixes = [
    ('\u00c3\u2021', '\u00c7'),
    ('\u00c3\u0192', '\u00c3'),
    ('\u00e2\u20ac\u201d', '\u2014'),
    ('\u00e2\u20ac\u201c', '\u2014'),
]
fixed = text
for bad, good in fixes:
    n = fixed.count(bad)
    if n:
        print('Fixed ' + repr(bad) + ' -> ' + repr(good) + ' ' + str(n) + ' times')
    fixed = fixed.replace(bad, good)

with open('c:/BACKUP/DESENVOLVIMENTO/mandato-pro/src/pages/solicitacoes/index.js', 'w', encoding='utf-8') as f:
    f.write(fixed)

remaining = [(i+1, l) for i, l in enumerate(fixed.split('\n')) if '\u00c3' in l]
print('Remaining: ' + str(len(remaining)))
for num, line in remaining:
    print('  L' + str(num) + ': ' + line.strip()[:80])
print('ALL DONE')
