import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  canEditSensitive, 
  isSensitiveField, 
  canDeleteRecord,
  MODULES 
} from '@/utils/permissions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

/**
 * EXEMPLO DE FORMULÁRIO COM CONTROLE DE CAMPOS SENSÍVEIS
 * 
 * Este exemplo mostra como:
 * 1. Desabilitar campos sensíveis para não-admin
 * 2. Mostrar avisos visuais sobre campos bloqueados
 * 3. Ocultar botão de exclusão para não-admin
 */

export default function ExemploFormularioEleitor() {
  const { user } = useAuth();
  
  // Verificar permissões
  const podeEditarSensivel = canEditSensitive(user.nivel, MODULES.CADASTROS);
  const podeDeletar = canDeleteRecord(user.nivel);

  const [formData, setFormData] = useState({
    nome: 'João Silva',
    cpf: '123.456.789-00',
    rg: '1234567',
    tituloEleitor: '1234567890',
    dataNascimento: '1990-01-01',
    telefone: '(91) 99999-9999',
    email: 'joao@email.com',
    endereco: 'Rua das Flores, 123',
    bairro: 'Centro',
    cidade: 'Belém'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Verificar se um campo é sensível
  const isFieldSensitive = (fieldName) => {
    return isSensitiveField('eleitores', fieldName);
  };

  // Renderizar campo com controle de permissão
  const renderField = (label, name, type = 'text') => {
    const sensitive = isFieldSensitive(name);
    const disabled = sensitive && !podeEditarSensivel;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {sensitive && (
            <span className="ml-2 text-xs text-red-600">
              <FontAwesomeIcon icon={faLock} className="mr-1" />
              Sensível
            </span>
          )}
        </label>
        <input
          type={type}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 ${
            disabled 
              ? 'bg-gray-100 cursor-not-allowed opacity-60' 
              : 'border-gray-300'
          }`}
        />
        {disabled && (
          <p className="mt-1 text-xs text-gray-500">
            Apenas administradores podem editar este campo
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Editar Eleitor</h1>

      {/* Aviso sobre campos sensíveis */}
      {!podeEditarSensivel && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600 mt-1" />
            <div>
              <h4 className="font-semibold text-yellow-900 mb-1">Campos Sensíveis Bloqueados</h4>
              <p className="text-sm text-yellow-800">
                Você não tem permissão para editar campos sensíveis como CPF, RG, Título de Eleitor 
                e Data de Nascimento. Apenas administradores podem modificar essas informações.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Campo comum - todos podem editar */}
          {renderField('Nome Completo', 'nome')}
          
          {/* Campos sensíveis - apenas admin */}
          {renderField('CPF', 'cpf')}
          {renderField('RG', 'rg')}
          {renderField('Título de Eleitor', 'tituloEleitor')}
          {renderField('Data de Nascimento', 'dataNascimento', 'date')}
          
          {/* Campos comuns - todos podem editar */}
          {renderField('Telefone', 'telefone')}
          {renderField('Email', 'email', 'email')}
          {renderField('Endereço', 'endereco')}
          {renderField('Bairro', 'bairro')}
          {renderField('Cidade', 'cidade')}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex justify-between">
        <div>
          {/* Botão de exclusão - apenas para admin */}
          {podeDeletar ? (
            <button
              type="button"
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Excluir Eleitor
            </button>
          ) : (
            <div className="text-sm text-gray-500 italic">
              Apenas administradores podem excluir registros
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* Legenda de permissões */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Suas Permissões</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Pode visualizar todos os dados</li>
          <li>✅ Pode editar dados comuns (nome, endereço, telefone, etc)</li>
          <li className={podeEditarSensivel ? 'text-green-700' : 'text-red-700'}>
            {podeEditarSensivel ? '✅' : '❌'} Pode editar dados sensíveis (CPF, RG, etc)
          </li>
          <li className={podeDeletar ? 'text-green-700' : 'text-red-700'}>
            {podeDeletar ? '✅' : '❌'} Pode excluir registros
          </li>
        </ul>
      </div>
    </div>
  );
}
