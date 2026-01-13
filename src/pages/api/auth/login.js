import { createServerClient } from '../../../lib/supabase-server';

// Força runtime Node.js (não Edge)
export const runtime = 'nodejs';

export default async function handler(req, res) {
  // Só POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    console.log('🔐 Login:', email);

    // Cria cliente Supabase do servidor (SERVICE_ROLE_KEY - admin)
    const supabase = createServerClient();

    // Autentica com Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      console.error('❌ Erro:', error.message);
      return res.status(401).json({
        error: error.message || 'Credenciais inválidas',
      });
    }

    if (!data?.user) {
      console.error('❌ Nenhum usuário');
      return res.status(401).json({
        error: 'Credenciais inválidas',
      });
    }

    console.log('✅ Auth sucesso:', data.user.email);

    // Busca dados do usuário na tabela
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .single();

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (usuario?.status !== 'ATIVO') {
      console.error('❌ Usuário inativo');
      return res.status(403).json({ error: 'Usuário inativo ou bloqueado' });
    }

    console.log('✅ Login sucesso:', email);

    // Retorna dados do usuário
    return res.status(200).json({
      user: usuario,
      token: data.session?.access_token,
      session: data.session,
    });
  } catch (err) {
    console.error('❌ Erro:', err.message);
    return res.status(500).json({
      error: err.message || 'Erro ao fazer login',
    });
  }
}
