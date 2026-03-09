path = 'src/pages/solicitacoes/index.js'
# v2 - uses triple CRLF separators

with open(path, 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8')

# 1. Add podeCriar constant after getUsuario definition
old1 = '  const getUsuario = () => {\r\n    if (typeof window === \'undefined\') return null;\r\n    try { return JSON.parse(localStorage.getItem(\'usuario\') || \'null\'); } catch { return null; }\r\n  };\r\n'
new1 = '  const getUsuario = () => {\r\n    if (typeof window === \'undefined\') return null;\r\n    try { return JSON.parse(localStorage.getItem(\'usuario\') || \'null\'); } catch { return null; }\r\n  };\r\n\r\n  const podeCriar = [\'ADMINISTRADOR\', \'LIDERANCA\'].includes(getUsuario()?.nivel);\r\n'

if old1 in text:
    text = text.replace(old1, new1, 1)
    print('Added podeCriar constant')
else:
    print('WARN: Could not find getUsuario function for podeCriar insertion')
    # Try to find it
    idx = text.find('const getUsuario')
    if idx >= 0:
        print('getUsuario found at index', idx)
        print(repr(text[idx:idx+200]))

# 2. Wrap the Nova Solicitacao button with podeCriar check
old2 = '            <button onClick={() => setShowNova(true)}\r\n              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2 font-semibold">\r\n              <FontAwesomeIcon icon={faPlus} /> Nova Solicita\u00e7\u00e3o\r\n            </button>'
new2 = '            {podeCriar && (\r\n            <button onClick={() => setShowNova(true)}\r\n              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2 font-semibold">\r\n              <FontAwesomeIcon icon={faPlus} /> Nova Solicita\u00e7\u00e3o\r\n            </button>\r\n            )}'

if old2 in text:
    text = text.replace(old2, new2, 1)
    print('Wrapped button with podeCriar')
else:
    print('WARN: Could not find button to wrap')
    idx = text.find('Nova Solicita')
    if idx >= 0:
        print('Button found at index', idx)
        print(repr(text[max(0,idx-200):idx+200]))

with open(path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done')
