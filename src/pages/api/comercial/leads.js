import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// Limite em memória contra abusos e spam automatizado
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 5; // no máximo 5 solicitações por minuto por IP
const ipRequestsMap = new Map();

function obterIp(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return String(ip?.split(',')[0] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'desconhecido').trim();
}

function validarRateLimit(ip) {
  const agora = Date.now();
  const registro = ipRequestsMap.get(ip) || { count: 0, resetAt: agora + RATE_LIMIT_WINDOW_MS };

  if (agora > registro.resetAt) {
    registro.count = 1;
    registro.resetAt = agora + RATE_LIMIT_WINDOW_MS;
  } else {
    registro.count += 1;
  }

  ipRequestsMap.set(ip, registro);
  return registro.count <= MAX_REQUESTS_PER_WINDOW;
}

function limparMemoriaRateLimit() {
  const agora = Date.now();
  for (const [ip, reg] of ipRequestsMap.entries()) {
    if (agora > reg.resetAt) {
      ipRequestsMap.delete(ip);
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  const clientIp = obterIp(req);
  limparMemoriaRateLimit();

  // 1. Verificação de Rate Limit
  if (!validarRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Muitas tentativas em curto período. Por favor, aguarde um momento antes de tentar novamente.'
    });
  }

  try {
    const {
      nome,
      cargo,
      instituicao,
      municipio,
      uf,
      email,
      whatsapp,
      mensagem,
      consentimento,
      // Honeypot field para capturar bots automatizados silenciosamente
      website
    } = req.body || {};

    // 2. Proteção Anti-Spam: Honeypot trap
    if (website && String(website).trim().length > 0) {
      // Fingir sucesso para bots sem salvar nada
      return res.status(200).json({
        success: true,
        message: 'Solicitação recebida com sucesso!'
      });
    }

    // 3. Validação Server-Side dos dados obrigatórios
    const nomeLimpo = String(nome || '').trim();
    const cargoLimpo = String(cargo || '').trim();
    const instituicaoLimpa = String(instituicao || '').trim();
    const municipioLimpo = String(municipio || '').trim();
    const ufLimpa = String(uf || '').trim().toUpperCase();
    const emailLimpo = String(email || '').trim().toLowerCase();
    const whatsappDigitos = String(whatsapp || '').replace(/\D/g, '');
    const mensagemLimpa = String(mensagem || '').trim();
    const consentimentoValido = consentimento === true || consentimento === 'true';

    if (!nomeLimpo || nomeLimpo.length < 3) {
      return res.status(400).json({ success: false, message: 'Por favor, informe seu nome completo.' });
    }

    if (!cargoLimpo) {
      return res.status(400).json({ success: false, message: 'Por favor, selecione seu cargo ou função.' });
    }

    if (!instituicaoLimpa) {
      return res.status(400).json({ success: false, message: 'Por favor, informe sua instituição ou gabinete.' });
    }

    if (!ufLimpa || ufLimpa.length !== 2) {
      return res.status(400).json({ success: false, message: 'Por favor, informe uma UF válida (ex: DF, SP, PA).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpo)) {
      return res.status(400).json({ success: false, message: 'Por favor, informe um endereço de e-mail válido.' });
    }

    if (!whatsappDigitos || whatsappDigitos.length < 10 || whatsappDigitos.length > 13) {
      return res.status(400).json({ success: false, message: 'Por favor, informe um número de WhatsApp válido com DDD.' });
    }

    if (!consentimentoValido) {
      return res.status(400).json({ success: false, message: 'É necessário concordar com os termos de privacidade para envio.' });
    }

    // 4. Persistência Segura via Supabase Server Client (Admin / Service Role)
    // Isolamento completo: NUNCA associa com eleitores ou tenants
    const supabase = createServerClient();

    const payload = {
      nome: nomeLimpo,
      cargo: cargoLimpo,
      instituicao: instituicaoLimpa,
      municipio: municipioLimpo || null,
      uf: ufLimpa,
      email: emailLimpo,
      whatsapp: whatsappDigitos,
      mensagem: mensagemLimpa || null,
      consentimento_lgpd: true,
      origem: 'landing_page',
      status: 'NOVO',
      ip_origem: clientIp,
      user_agent: req.headers['user-agent'] || null
    };

    const { data, error } = await supabase
      .from('leads_comerciais')
      .insert([payload])
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[API Leads Comerciais] Erro ao salvar lead:', error);
      return res.status(500).json({
        success: false,
        message: 'Não foi possível registrar sua solicitação no momento. Por favor, tente novamente em alguns instantes.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sua solicitação de demonstração foi registrada com sucesso!',
      leadId: data.id
    });
  } catch (error) {
    console.error('[API Leads Comerciais] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      message: 'Ocorreu uma falha interna ao processar seu pedido. Tente novamente mais tarde.'
    });
  }
}
