const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SCRIPTS = path.join(ROOT, 'scripts');
const ALLOWED_SUPABASE_FROM_DIRS = [
  path.join(SRC, 'pages', 'api'),
  path.join(SRC, 'lib')
];

const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && JS_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isInside(file, dir) {
  const relative = path.relative(dir, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

const violations = [];

for (const file of walk(SRC)) {
  const content = fs.readFileSync(file, 'utf8');

  if (/import\s+supabase\s+from\s+['"]@\/lib\/supabaseClient['"]/.test(content)) {
    violations.push({
      file,
      reason: 'Import default de supabaseClient reabre acesso direto a tabelas no navegador.'
    });
  }

  const allowSupabaseFrom = ALLOWED_SUPABASE_FROM_DIRS.some((dir) => isInside(file, dir));
  if (!allowSupabaseFrom && /\bsupabase\s*\.\s*from\s*\(/.test(content)) {
    violations.push({
      file,
      reason: 'Uso de supabase.from fora de API/lib server-side. Use uma rota /api autenticada.'
    });
  }
}

if (fs.existsSync(SCRIPTS)) {
  for (const file of walk(SCRIPTS)) {
    if (path.basename(file) === 'check-client-supabase-access.js') {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    if (/Teste123!|senha123/i.test(content)) {
      violations.push({
        file,
        reason: 'Senha padrao fraca/hardcoded em script executavel.'
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Acesso direto ao Supabase detectado fora do padrao seguro:\n');
  for (const violation of violations) {
    console.error(`- ${rel(violation.file)}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log('OK: nenhum acesso direto indevido ao Supabase no cliente.');
