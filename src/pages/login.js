import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { registrarLogin, registrarErro } from '@/services/logService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // Fazer login via API (que tem acesso às variáveis de ambiente)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao fazer login');
      }

      const { user } = await response.json();
      
      // Fazer login no contexto
      login(user);
      
      // Registra o login bem-sucedido
      await registrarLogin(user);
      
      router.push('/dashboard');
    } catch (error) {
      setErro(error.message);
      
      // Registra tentativa de login com erro
      await registrarErro(
        { email, nome: email.split('@')[0], nivel: 'DESCONHECIDO' },
        'AUTENTICACAO',
        'Tentativa de login falhou',
        error
      );
      
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx>{`
        .container {
          /* Centralização robusta: posiciona o container exatamente no centro da viewport */
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding: 20px;
          width: 100%;
        }
        .card {
          background: white;
          padding: 30px; /* reduzido ~25% (40px -> 30px) */
          border-radius: 16px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 420px; /* reduzido 25% em relação a 560px */
        }
        .title {
          font-size: 2.5rem;
          font-weight: 700;
          color: #0f766e;
          text-align: center;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6b7280;
          text-align: center;
          margin-bottom: 32px;
          font-size: 0.95rem;
        }
        .form-group {
          margin-bottom: 24px;
        }
        .label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }
        .input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
          outline: none;
        }
        .input:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
        }
        .input:disabled {
          background-color: #f9fafb;
          cursor: not-allowed;
        }
        .error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          font-size: 0.875rem;
          margin-bottom: 20px;
        }
        .button {
          width: 100%;
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          font-weight: 600;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(20, 184, 166, 0.3);
        }
        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .link-container {
          margin-top: 24px;
          text-align: center;
        }
        .link {
          color: #14b8a6;
          font-size: 0.875rem;
          text-decoration: none;
          transition: color 0.2s;
        }
        .link:hover {
          color: #0d9488;
          text-decoration: underline;
        }
      `}</style>
      
      <div className="container">
        <div className="card">
          <h1 className="title">MandatoPro</h1>
          <p className="subtitle">Sistema de Gestão Política</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="Digite seu e-mail"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="label">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="input"
                placeholder="Digite sua senha"
                disabled={loading}
              />
            </div>

            {erro && (
              <div className="error">{erro}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="button"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="link-container">
            <a href="#" className="link">
              Esqueceu sua senha?
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

