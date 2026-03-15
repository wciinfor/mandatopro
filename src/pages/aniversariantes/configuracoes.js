import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCog, faSave, faTimes, faToggleOn, faToggleOff, faClock, faEnvelope,
  faSms, faEdit, faEye
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function ConfiguracoesAniversariantes() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError } = useModal();

  const [config, setConfig] = useState({
    envioAutomaticoAtivo: true,
    horarioEnvio: '08:00',
    enviarWhatsApp: true,
    enviarSMS: false,
    enviarEmail: true,
    nomeParlamentar: 'Deputado João Silva',
    mensagemPadrao: `Parabéns pelo seu aniversário! 🎉🎂

Que este dia seja repleto de alegrias, saúde e realizações.

Conte sempre comigo!

Um forte abraço,
[NOME_PARLAMENTAR]`,
    assinarMensagem: true,
    incluirEmoji: true
  });

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [visualizacao, setVisualizacao] = useState('');

  useEffect(() => {
    let ativo = true;

    const carregarConfiguracoes = async () => {
      try {
        setCarregando(true);
        setErroCarregamento('');

        const resposta = await fetch('/api/aniversariantes/configuracoes');
        const payload = await resposta.json();

        if (!resposta.ok || !payload?.success) {
          throw new Error(payload?.detalhes || payload?.error || `Erro HTTP: ${resposta.status}`);
        }

        if (!ativo) {
          return;
        }

        const dados = payload?.data && typeof payload.data === 'object' ? payload.data : {};
        setConfig((anterior) => ({
          ...anterior,
          ...dados
        }));
      } catch (error) {
        console.error('Erro ao carregar configuracoes de aniversariantes:', error);
        if (ativo) {
          setErroCarregamento(error.message || 'erro desconhecido');
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    };

    carregarConfiguracoes();

    return () => {
      ativo = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVisualizarMensagem = () => {
    let mensagem = config.mensagemPadrao;
    
    // Substituir variáveis
    mensagem = mensagem.replace(/\[NOME_PARLAMENTAR\]/g, config.nomeParlamentar);
    mensagem = mensagem.replace(/\[NOME\]/g, 'Maria Silva'); // Exemplo
    mensagem = mensagem.replace(/\[IDADE\]/g, '35'); // Exemplo
    
    if (!config.assinarMensagem) {
      // Remover assinatura
      const linhas = mensagem.split('\n');
      const ultimasLinhas = linhas.slice(-3);
      if (ultimasLinhas.some(l => l.includes(config.nomeParlamentar))) {
        mensagem = linhas.slice(0, -3).join('\n');
      }
    }

    if (!config.incluirEmoji) {
      mensagem = mensagem.replace(/[🎉🎂🎈🎁👏💐🌟✨]/g, '');
    }

    setVisualizacao(mensagem);
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);

      const resposta = await fetch('/api/aniversariantes/configuracoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dados: config })
      });

      const payload = await resposta.json();
      if (!resposta.ok || !payload?.success) {
        throw new Error(payload?.detalhes || payload?.error || `Erro HTTP: ${resposta.status}`);
      }

      showSuccess('Configuracoes salvas com sucesso!');
      setTimeout(() => {
        router.push('/aniversariantes');
      }, 1500);
    } catch (error) {
      console.error('Erro ao salvar configuracoes de aniversariantes:', error);
      showError(`Nao foi possivel salvar: ${error.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelar = () => {
    router.push('/aniversariantes');
  };

  const variaveis = [
    { tag: '[NOME]', descricao: 'Nome do aniversariante' },
    { tag: '[IDADE]', descricao: 'Idade do aniversariante' },
    { tag: '[NOME_PARLAMENTAR]', descricao: 'Nome do parlamentar' }
  ];

  return (
    <Layout titulo="Configurações de Aniversariantes">
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />

      {carregando && (
        <div className="max-w-5xl mx-auto mb-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3">
            Carregando configuracoes...
          </div>
        </div>
      )}

      {!carregando && erroCarregamento && (
        <div className="max-w-5xl mx-auto mb-4">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
            Nao foi possivel carregar configuracoes: {erroCarregamento}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Envio Automático */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faCog} className="text-teal-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Envio Automático</h2>
              <p className="text-sm text-gray-600">Configure o envio automático de mensagens</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Toggle Ativar/Desativar */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-semibold text-gray-900">Ativar Envio Automático</h3>
                <p className="text-sm text-gray-600">Mensagens serão enviadas automaticamente no dia do aniversário</p>
              </div>
              <button
                onClick={() => handleChange('envioAutomaticoAtivo', !config.envioAutomaticoAtivo)}
                className="focus:outline-none"
              >
                <FontAwesomeIcon 
                  icon={config.envioAutomaticoAtivo ? faToggleOn : faToggleOff}
                  className={`text-5xl ${config.envioAutomaticoAtivo ? 'text-green-500' : 'text-gray-400'}`}
                />
              </button>
            </div>

            {/* Horário de Envio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FontAwesomeIcon icon={faClock} className="mr-2 text-teal-600" />
                HORÁRIO DO ENVIO
              </label>
              <input
                type="time"
                value={config.horarioEnvio}
                onChange={(e) => handleChange('horarioEnvio', e.target.value)}
                disabled={!config.envioAutomaticoAtivo}
                className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Mensagens serão enviadas automaticamente neste horário
              </p>
            </div>

            {/* Canais de Envio */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Canais de Envio</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: config.enviarWhatsApp ? '#14b8a6' : '#e5e7eb' }}>
                  <input
                    type="checkbox"
                    checked={config.enviarWhatsApp}
                    onChange={(e) => handleChange('enviarWhatsApp', e.target.checked)}
                    disabled={!config.envioAutomaticoAtivo}
                    className="w-5 h-5"
                  />
                  <FontAwesomeIcon icon={faWhatsapp} className="text-xl text-green-600" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">WhatsApp</div>
                    <div className="text-sm text-gray-600">Enviar via WhatsApp Business API</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: config.enviarSMS ? '#14b8a6' : '#e5e7eb' }}>
                  <input
                    type="checkbox"
                    checked={config.enviarSMS}
                    onChange={(e) => handleChange('enviarSMS', e.target.checked)}
                    disabled={!config.envioAutomaticoAtivo}
                    className="w-5 h-5"
                  />
                  <FontAwesomeIcon icon={faSms} className="text-xl text-blue-600" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">SMS</div>
                    <div className="text-sm text-gray-600">Enviar mensagem de texto (SMS)</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: config.enviarEmail ? '#14b8a6' : '#e5e7eb' }}>
                  <input
                    type="checkbox"
                    checked={config.enviarEmail}
                    onChange={(e) => handleChange('enviarEmail', e.target.checked)}
                    disabled={!config.envioAutomaticoAtivo}
                    className="w-5 h-5"
                  />
                  <FontAwesomeIcon icon={faEnvelope} className="text-xl text-red-600" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">E-mail</div>
                    <div className="text-sm text-gray-600">Enviar por e-mail</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Mensagem Padrão */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faEdit} className="text-purple-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Mensagem Padrão</h2>
              <p className="text-sm text-gray-600">Personalize a mensagem de aniversário</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Nome do Parlamentar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NOME DO PARLAMENTAR
              </label>
              <input
                type="text"
                value={config.nomeParlamentar}
                onChange={(e) => handleChange('nomeParlamentar', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Ex: Deputado João Silva"
              />
            </div>

            {/* Texto da Mensagem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TEXTO DA MENSAGEM
              </label>
              <textarea
                value={config.mensagemPadrao}
                onChange={(e) => handleChange('mensagemPadrao', e.target.value)}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                placeholder="Digite a mensagem de aniversário..."
              />
            </div>

            {/* Variáveis Disponíveis */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Variáveis Disponíveis:</h4>
              <div className="space-y-1">
                {variaveis.map(v => (
                  <div key={v.tag} className="flex items-center gap-2 text-sm">
                    <code className="px-2 py-1 bg-white rounded border border-blue-300 font-mono text-blue-800">
                      {v.tag}
                    </code>
                    <span className="text-blue-700">- {v.descricao}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Opções Adicionais */}
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.assinarMensagem}
                  onChange={(e) => handleChange('assinarMensagem', e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-sm text-gray-700">Incluir assinatura do parlamentar</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.incluirEmoji}
                  onChange={(e) => handleChange('incluirEmoji', e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-sm text-gray-700">Incluir emojis na mensagem</span>
              </label>
            </div>

            {/* Botão Visualizar */}
            <div>
              <button
                onClick={handleVisualizarMensagem}
                disabled={carregando}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faEye} />
                Visualizar Prévia
              </button>

              {visualizacao && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Prévia da Mensagem:</h4>
                  <div className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-white p-3 rounded border">
                    {visualizacao}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancelar}
            disabled={salvando}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faTimes} />
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={carregando || salvando}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-teal-300 flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faSave} />
            {salvando ? 'Salvando...' : 'Salvar Configuracoes'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
