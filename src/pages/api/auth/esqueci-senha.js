import { createServerClient } from '@/lib/supabase-server';
import { gerarTraceId } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

const JANELA_RECUPERACAO_MS = 15 * 60 * 1000;
const MAX_PEDIDOS_POR_IP = 5;
const tentativasRecuperacao = new Map();

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
  for (const [chave, tentativa] of tentativasRecuperacao.entries()) {
    if (tentativa.expiraEm <= agora) {
      tentativasRecuperacao.delete(chave);
    }
  }
}

function obterTentativa(chave, agora = Date.now()) {
  limparTentativasExpiradas(agora);
  const tentativa = tentativasRecuperacao.get(chave);
  if (!tentativa || tentativa.expiraEm <= agora) {
    return { total: 0, expiraEm: agora + JANELA_RECUPERACAO_MS };
  }
  return tentativa;
}

function atingiuLimiteTentativas(chave) {
  return obterTentativa(chave).total >= MAX_PEDIDOS_POR_IP;
}

function registrarTentativa(chave) {
  const agora = Date.now();
  const tentativa = obterTentativa(chave, agora);
  tentativasRecuperacao.set(chave, {
    total: tentativa.total + 1,
    expiraEm: tentativa.expiraEm || agora + JANELA_RECUPERACAO_MS
  });
}

function resolveRedirectUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  
  // Se estiver em app.mandatopro.com ou local
  if (host) {
    return `${protocol}://${host}/auth/redefinir-senha`;
  }
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://app.mandatopro.com';
  return `${siteUrl.replace(/\/$/, '')}/auth/redefinir-senha`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const traceId = gerarTraceId();
  const email = normalizarEmail(req.body?.email);
  const chave = chaveTentativa(req, email);

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Informe um e-mail valido.', traceId });
  }

  if (atingiuLimiteTentativas(chave)) {
    return res.status(429).json({
      error: 'Muitas solicitacoes recentes. Por favor, aguarde alguns minutos e tente novamente.',
      traceId
    });
  }

  registrarTentativa(chave);

  try {
    const supabase = createServerClient();

    // 1. Verifica se o usuario existe e esta ativo na tabela usuarios
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id, email, status, ativo')
      .eq('email', email)
      .single();

    // Por seguranca (anti-enumeracao), se o usuario nao existir ou estiver inativo,
    // retornamos sucesso generico para nao expor a existencia ou nao do e-mail.
    if (userError || !usuario || !usuario.ativo || usuario.status !== 'ATIVO') {
      return res.status(200).json({
        message: 'Se o e-mail estiver cadastrado, as instrucoes de recuperacao serao enviadas.',
        traceId
      });
    }

    const redirectTo = resolveRedirectUrl(req);

    // 2. Dispara o e-mail de recuperacao oficial do Supabase Auth
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (resetError) {
      console.warn('Erro ao disparar resetPasswordForEmail:', { traceId, error: resetError.message });
      // Se der erro especifico de rate limit do provedor Supabase
      if (resetError.status === 429) {
        return res.status(429).json({
          error: 'Limite de envios do servidor atingido. Aguarde alguns minutos antes de tentar novamente.',
          traceId
        });
      }
      return res.status(500).json({
        error: 'Nao foi possivel enviar o e-mail de recuperacao no momento. Tente novamente mais tarde.',
        traceId
      });
    }

    return res.status(200).json({
      message: 'Se o e-mail estiver cadastrado, as instrucoes de recuperacao serao enviadas.',
      traceId
    });
  } catch (error) {
    console.error('Erro inesperado em esqueci-senha:', { traceId, error: error?.message });
    return res.status(500).json({
      error: 'Ocorreu um erro interno ao processar a solicitacao.',
      traceId
    });
  }
}
