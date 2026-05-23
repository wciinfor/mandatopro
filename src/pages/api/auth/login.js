import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

const JANELA_TENTATIVAS_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 8;
const tentativasLogin = new Map();

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function obterIp(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  return String(ip?.split(',')[0] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'desconhecido').trim();
}

function chaveTentativa(req, email) {
  return `${obterIp(req)}:${email || 'sem-email'}`;
}

function limparTentativasExpiradas(agora = Date.now()) {
  for (const [chave, tentativa] of tentativasLogin.entries()) {
    if (tentativa.expiraEm <= agora) {
      tentativasLogin.delete(chave);
    }
  }
}

function obterTentativa(chave, agora = Date.now()) {
  limparTentativasExpiradas(agora);

  const tentativa = tentativasLogin.get(chave);
  if (!tentativa || tentativa.expiraEm <= agora) {
    return { total: 0, expiraEm: agora + JANELA_TENTATIVAS_MS };
  }

  return tentativa;
}

function atingiuLimiteTentativas(chave) {
  return obterTentativa(chave).total >= MAX_TENTATIVAS;
}

function registrarFalhaLogin(chave) {
  const agora = Date.now();
  const tentativa = obterTentativa(chave, agora);

  tentativasLogin.set(chave, {
    total: tentativa.total + 1,
    expiraEm: tentativa.expiraEm || agora + JANELA_TENTATIVAS_MS
  });
}

function limparFalhasLogin(chave) {
  tentativasLogin.delete(chave);
}

function mapearUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    nivel: usuario.nivel,
    status: usuario.status,
    lideranca_id: usuario.lideranca_id,
    ativo: usuario.ativo
  };
}

async function atualizarUltimoAcesso(supabase, usuarioId, traceId) {
  const { error } = await supabase
    .from('usuarios')
    .update({ ultimo_acesso: new Date().toISOString() })
    .eq('id', usuarioId);

  if (error) {
    console.warn('Falha ao atualizar ultimo acesso', { traceId, code: error.code });
  }
}

function respostaCredenciaisInvalidas(res, traceId) {
  return res.status(401).json({
    error: 'Credenciais invalidas',
    traceId
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const traceId = gerarTraceId();
  const email = normalizarEmail(req.body?.email);
  const senha = req.body?.senha;
  const chave = chaveTentativa(req, email);

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha sao obrigatorios', traceId });
  }

  if (atingiuLimiteTentativas(chave)) {
    return res.status(429).json({
      error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      traceId
    });
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error || !data?.user || !data?.session) {
      registrarFalhaLogin(chave);
      console.warn('Falha de autenticacao no login', { traceId, code: error?.code });
      return respostaCredenciaisInvalidas(res, traceId);
    }

    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id,nome,email,nivel,status,lideranca_id,ativo')
      .eq('email', email)
      .eq('ativo', true)
      .single();

    if (userError || !usuario || usuario.status !== 'ATIVO') {
      registrarFalhaLogin(chave);
      console.warn('Usuario local ausente ou inativo no login', { traceId, code: userError?.code });
      return respostaCredenciaisInvalidas(res, traceId);
    }

    limparFalhasLogin(chave);
    await atualizarUltimoAcesso(supabase, usuario.id, traceId);

    return res.status(200).json({
      user: mapearUsuario(usuario),
      session: data.session,
      traceId
    });
  } catch (err) {
    console.error('Erro interno no login', { traceId, message: err?.message });
    return res.status(500).json({
      error: 'Erro ao fazer login',
      traceId
    });
  }
}
