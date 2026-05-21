import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/lib/supabaseClient';

function isAbortError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError' || message.includes('aborted');
}

function getErrorMessageFromHash(hashParams) {
  const code = hashParams.get('error_code');
  const description = hashParams.get('error_description');

  if (code === 'otp_expired') {
    return 'O link de recuperacao expirou ou ja foi utilizado. Gere um novo link.';
  }

  if (description) {
    return decodeURIComponent(description.replace(/\+/g, ' '));
  }

  return 'Nao foi possivel validar o link de recuperacao.';
}

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const initStartedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const canSubmit = useMemo(() => {
    return !salvando && ready && senha.length >= 6 && senha === confirmarSenha;
  }, [salvando, ready, senha, confirmarSenha]);

  useEffect(() => {
    if (!router.isReady || initStartedRef.current) return undefined;
    initStartedRef.current = true;

    let active = true;

    async function initRecovery() {
      try {
        const supabase = createClient();
        if (!supabase?.auth) {
          throw new Error('Supabase nao esta configurado.');
        }

        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hasError = !!hashParams.get('error');

        if (hasError) {
          throw new Error(getErrorMessageFromHash(hashParams));
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            throw sessionError;
          }

          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, '/auth/redefinir-senha');
          }

          if (active) {
            setReady(true);
            setErro('');
          }
          return;
        }

        const code = router.query.code;
        if (typeof code === 'string' && code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }

          if (active) {
            setReady(true);
            setErro('');
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (active) {
            setReady(true);
            setErro('');
          }
          return;
        }

        throw new Error('Link de recuperacao invalido. Solicite um novo link.');
      } catch (initError) {
        if (isAbortError(initError)) {
          try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              if (active) {
                setReady(true);
                setErro('');
              }
              return;
            }
          } catch {
            // Ignora falha adicional no fallback de sessão
          }

          if (active) {
            setErro('A validacao do link foi interrompida. Recarregue a pagina e tente novamente.');
            setReady(false);
          }
          return;
        }

        if (active) {
          setErro(initError.message || 'Erro ao validar link de recuperacao.');
          setReady(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initRecovery();

    return () => {
      active = false;
    };
  }, [router.isReady]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas nao conferem.');
      return;
    }

    setSalvando(true);

    try {
      const supabase = createClient();
      if (!supabase?.auth) {
        throw new Error('Supabase nao esta configurado.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: senha });
      if (updateError) throw updateError;

      setMensagem('Senha atualizada com sucesso. Voce sera redirecionado para o login.');

      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn('Falha ao encerrar sessao apos redefinir senha:', signOutError);
        }
        router.replace('/login');
      }, 1200);
    } catch (submitError) {
      setErro(submitError.message || 'Nao foi possivel atualizar a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-teal-100">
        <h1 className="text-2xl font-bold text-teal-700 mb-2">Redefinir senha</h1>
        <p className="text-sm text-gray-600 mb-6">Defina uma nova senha para acessar o sistema.</p>

        {loading ? (
          <div className="text-sm text-gray-600">Validando link de recuperacao...</div>
        ) : (
          <>
            {erro && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
                {erro}
              </div>
            )}

            {mensagem && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 text-green-700 p-3 text-sm">
                {mensagem}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={!ready || salvando}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                  placeholder="Minimo de 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  disabled={!ready || salvando}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                  placeholder="Repita a nova senha"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold py-2.5 rounded-lg transition"
              >
                {salvando ? 'Salvando...' : 'Atualizar senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
