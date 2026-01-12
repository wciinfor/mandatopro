import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan, faSearch, faEye
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

export default function SolicitacoesRecusadas() {
  const router = useRouter();
  const [busca, setBusca] = useState('');

  // Mock de solicitações recusadas
  const solicitacoes = [
    {
      id: 5,
      protocolo: 'SOL-2024-005',
      titulo: 'Coleta de lixo irregular',
      solicitante: 'Francisca Lima',
      categoria: 'Meio Ambiente',
      municipio: 'Belém',
      dataAbertura: '2024-11-05',
      dataRecusa: '2024-11-12',
      motivo: 'Competência municipal - encaminhado para prefeitura',
      atendente: 'Pedro Alves'
    }
  ];

  const solicitacoesFiltradas = solicitacoes.filter(sol =>
    sol.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    sol.solicitante.toLowerCase().includes(busca.toLowerCase()) ||
    sol.protocolo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <ProtectedRoute module={MODULES.SOLICITACOES}>
      <Layout titulo="Solicitações Recusadas">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faBan} className="text-red-600 text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Solicitações Recusadas</h2>
              <p className="text-sm text-gray-600">
                {solicitacoes.length} {solicitacoes.length === 1 ? 'solicitação recusada' : 'solicitações recusadas'}
              </p>
            </div>
          </div>

          <div className="relative">
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar solicitação recusada..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocolo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solicitante</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Recusa</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {solicitacoesFiltradas.map((sol) => (
                <tr key={sol.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{sol.protocolo}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sol.titulo}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sol.solicitante}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">{sol.motivo}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(sol.dataRecusa).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => router.push(`/solicitacoes/${sol.id}`)}
                      className="text-teal-600 hover:text-teal-900"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
