import { NextResponse } from 'next/server';

/**
 * Middleware de Roteamento Multi-Domínio (FASE 1)
 * 
 * - mandatopro.com / www.mandatopro.com:
 *   - '/' -> Exibe página institucional (futura landing page)
 *   - '/politica-privacidade', '/termos', '/exclusao-de-dados', '/privacidade' -> Mantidas no site institucional
 *   - Demais rotas administrativas ('/dashboard', '/login', '/cadastros/*', etc.) -> Redireciona para app.mandatopro.com
 *   - '/api/*' -> Preservada sem redirecionamento (webhooks e integrações intactos)
 *
 * - app.mandatopro.com:
 *   - '/' -> Redireciona para '/dashboard' (onde ProtectedRoute/AuthContext gerencia login)
 *   - Demais rotas -> Executadas normalmente no sistema administrativo
 */
export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // 1. Não interceptar chamadas internas do Next.js, arquivos estáticos ou favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // ex: favicon.ico, imagens, geojson, .svg
  ) {
    return NextResponse.next();
  }

  // 2. Não redirecionar APIs e Webhooks em nenhum domínio (preserva POST, body, headers e assinaturas)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 3. Resolução segura de Hostname:
  // No Next.js em produção, request.nextUrl.hostname reflete a URL pública canônica resolvida.
  // Em ambientes de proxy, checamos headers x-forwarded-host e host como fallback defensivo.
  const rawForwarded = request.headers.get('x-forwarded-host');
  // Se houver múltiplos proxies, o cliente/primeiro proxy está na primeira posição
  const forwardedHost = rawForwarded ? rawForwarded.split(',')[0].trim() : '';
  const hostHeader = request.headers.get('host') || '';
  const canonicalHostname = (request.nextUrl.hostname || forwardedHost || hostHeader || '').split(':')[0].toLowerCase();

  const isAppDomain =
    canonicalHostname === 'app.mandatopro.com' ||
    canonicalHostname.startsWith('app.');

  const isInstitutionalDomain =
    canonicalHostname === 'mandatopro.com' ||
    canonicalHostname === 'www.mandatopro.com';

  // 4. Regras para app.mandatopro.com (Sistema Administrativo)
  if (isAppDomain) {
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 5. Regras para mandatopro.com / www.mandatopro.com (Site Institucional / Landing Page)
  if (isInstitutionalDomain) {
    // Páginas públicas que pertencem ao site institucional
    const rotasInstitucionais = [
      '/',
      '/politica-privacidade',
      '/termos',
      '/exclusao-de-dados',
      '/privacidade'
    ];

    if (rotasInstitucionais.includes(pathname)) {
      return NextResponse.next();
    }

    // Qualquer rota administrativa acessada no domínio institucional é redirecionada para app.mandatopro.com
    const targetUrl = new URL(
      `${pathname}${search}`,
      'https://app.mandatopro.com'
    );
    return NextResponse.redirect(targetUrl, 307);
  }

  // 6. Ambientes locais / preview Vercel (.vercel.app, localhost, 127.0.0.1)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware a todas as rotas de requisição,
     * ignorando explicitamente arquivos estáticos comuns.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
