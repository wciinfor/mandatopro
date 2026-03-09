path = 'src/pages/solicitacoes/index.js'

with open(path, 'rb') as f:
    raw = f.read()

# Check line endings
cr_count = raw.count(b'\r')
lf_count = raw.count(b'\n')
print('CR count:', cr_count, 'LF count:', lf_count)

text = raw.decode('utf-8')

# Do simple string replacements - single-line only
replacements = [
    # Fix MMÉDIA -> MÉDIA (remaining)
    ("'MMÉDIA'", "'MÉDIA'"),
    ('value="MMÉDIA"', 'value="MÉDIA"'),
    # Fix em-dash corruption (â€" is corrupted em dash)
    # These are the Unicode sequences that appear as â€" in the file
    ('\u00e2\u20ac\u201d', '\u2014'),  # â€" -> —
    ('\u00e2\u20ac\u201c', '\u2014'),  # â€œ -> —
    # Fix SOLICITAÇÃO in comments
    ('SOLICITA\u00c7AO', 'SOLICITA\u00c7\u00c3O'),
    ('SOLICITA\u00c3\u2021\u00c3\u0192O', 'SOLICITA\u00c7\u00c3O'),
]

fixed = text
for bad, good in replacements:
    n = fixed.count(bad)
    if n:
        print('Fixing: ' + repr(bad) + ' -> ' + repr(good) + ' (' + str(n) + 'x)')
    fixed = fixed.replace(bad, good)

# Check remaining issues
issues = ['MMÉDIA', '\u00e2\u20ac']
for issue in issues:
    if issue in fixed:
        lns = [(i+1, l) for i, l in enumerate(fixed.split('\n')) if issue in l]
        print('Still has ' + repr(issue) + ' on lines: ' + str([n for n,_ in lns]))

# Write back preserving original line endings
with open(path, 'wb') as f:
    f.write(fixed.encode('utf-8'))

print('Done')
