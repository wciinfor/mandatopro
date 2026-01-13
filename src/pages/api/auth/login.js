import { createClient } from '@supabase/supabase-js';
import config from '@/config/runtime';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    // Tenta usar a config gerada em build time
    let supabaseUrl = config.supabase.url;
    let supabaseAnonKey = config.supabase.anonKey;

    // Se não estiver em config, tenta variáveis de ambiente (fallback)
    if (!supabaseUrl) {
      supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (!supabaseAnonKey) {
      supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }

    console.log('[API Login] Verificando configuração:');
    console.log('[API Login] URL de config:', config.supabase.url ? '✅' : '❌');
    console.log('[API Login] Key de config:', config.supabase.anonKey ? '✅' : '❌');
    console.log('[API Login] URL final:', supabaseUrl ? '✅' : '❌');
    console.log('[API Login] Key final:', supabaseAnonKey ? '✅' : '❌');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[API Login] ❌ Variáveis não encontradas');
      
      return res.status(500).json({ 
        error: 'Supabase não configurado',
        debug: {
          configUrl: !!config.supabase.url,
          configKey: !!config.supabase.anonKey,
          envUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          envKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        }
      });
    }

    console.log('[API Login] ✅ Criando cliente Supabase');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('[API Login] ✅ Cliente criado, tentando fazer login');

    // Fazer login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      console.error('[API Login] ❌ Erro de autenticação:', error);
      return res.status(401).json({ error: error.message });
    }

    console.log('[API Login] ✅ Login bem-sucedido, buscando usuário');

    // Buscar dados do usuário
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .single();

    if (userError) {
      console.error('[API Login] ❌ Erro ao buscar usuário:', userError);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (usuario.status !== 'ATIVO') {
      console.error('[API Login] ❌ Usuário inativo');
      return res.status(403).json({ error: 'Usuário inativo ou bloqueado' });
    }

    console.log('[API Login] ✅ Login completo para:', email);

    // Retorna dados do usuário e token
    return res.status(200).json({
      user: usuario,
      token: data.session?.access_token,
      session: data.session
    });

  } catch (error) {
    console.error('[API Login] ❌ Erro geral:', error);
    console.error('[API Login] Stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Erro ao fazer login: ' + error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
