import { getSupabaseClient } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    // Criar cliente Supabase no servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Variáveis de ambiente não encontradas no servidor');
      return res.status(500).json({ 
        error: 'Supabase não está configurado no servidor' 
      });
    }

    // Importar e criar cliente direto aqui
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fazer login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Buscar dados do usuário
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .single();

    if (userError) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (usuario.status !== 'ATIVO') {
      return res.status(403).json({ error: 'Usuário inativo ou bloqueado' });
    }

    // Retorna dados do usuário e token
    return res.status(200).json({
      user: usuario,
      token: data.session?.access_token,
      session: data.session
    });

  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return res.status(500).json({ 
      error: 'Erro ao fazer login: ' + error.message 
    });
  }
}
