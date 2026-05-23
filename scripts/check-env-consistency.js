const fs = require('fs');
const path = require('path');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return env;
}

function extractSupabaseRef(url) {
  const match = String(url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return match?.[1] || '';
}

function maskRef(ref) {
  if (!ref) return '(vazio)';
  if (ref.length <= 8) return `${ref.slice(0, 2)}...`;
  return `${ref.slice(0, 6)}...${ref.slice(-4)}`;
}

function loadLinkedProjectRef(rootDir) {
  const projectRefPath = path.join(rootDir, 'supabase', '.temp', 'project-ref');
  if (!fs.existsSync(projectRefPath)) {
    return '';
  }

  return fs.readFileSync(projectRefPath, 'utf8').trim();
}

function main() {
  const rootDir = process.cwd();
  const envLocal = readEnvFile(path.join(rootDir, '.env.local'));
  const envProduction = readEnvFile(path.join(rootDir, '.env.production.local'));
  const linkedRef = loadLinkedProjectRef(rootDir);

  const localRef = extractSupabaseRef(envLocal.NEXT_PUBLIC_SUPABASE_URL);
  const productionRef = extractSupabaseRef(envProduction.NEXT_PUBLIC_SUPABASE_URL);
  const failures = [];

  if (envLocal.NEXT_PUBLIC_SUPABASE_URL && !localRef) {
    failures.push('.env.local tem NEXT_PUBLIC_SUPABASE_URL invalida.');
  }

  if (envProduction.NEXT_PUBLIC_SUPABASE_URL && !productionRef) {
    failures.push('.env.production.local tem NEXT_PUBLIC_SUPABASE_URL invalida.');
  }

  if (linkedRef && localRef && linkedRef !== localRef) {
    failures.push(`.env.local aponta para ${maskRef(localRef)}, mas o Supabase CLI esta linkado em ${maskRef(linkedRef)}.`);
  }

  if (linkedRef && productionRef && linkedRef !== productionRef) {
    failures.push(`.env.production.local aponta para ${maskRef(productionRef)}, mas o Supabase CLI esta linkado em ${maskRef(linkedRef)}.`);
  }

  if (localRef && productionRef && localRef !== productionRef) {
    failures.push(`.env.local (${maskRef(localRef)}) e .env.production.local (${maskRef(productionRef)}) apontam para projetos Supabase diferentes.`);
  }

  if (failures.length > 0) {
    console.error('Falha na consistencia de ambiente:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('OK: ambientes Supabase consistentes com o projeto linkado.');
}

main();
