import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';

export default function NovaLideranca() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    // Carregar dados do usuário
    const dados = localStorage.getItem('auth');
    if (dados) {
      setUsuario(JSON.parse(dados));
    }
  }, []);

  if (!usuario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-2xl font-bold">Carregando...</p>
          <p className="text-gray-500 mt-2">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  return (
    <Layout titulo="Cadastro de Nova Liderança">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Nova Liderança</h2>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          alert('Formulário de cadastro simplificado');
        }}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Liderança
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Digite o nome"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CPF
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Digite o CPF"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
            >
              Voltar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
