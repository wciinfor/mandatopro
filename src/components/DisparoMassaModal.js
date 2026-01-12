import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, 
  faTimes, 
  faEnvelope, 
  faPhone, 
  faWhatsapp,
  faSpinner,
  faCheckCircle,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/Modal';

export default function DisparoBotao({ onDisparo }) {
  const [abrirModal, setAbrirModal] = useState(false);
  const [tipo, setTipo] = useState('todos');
  const [canais, setCanais] = useState(['whatsapp']);
  const [mensagem, setMensagem] = useState('');
  const [assunto, setAssunto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarResultado, setMostrarResultado] = useState(false);

  const handleToggleCanal = (canal) => {
    setCanais(prev => 
      prev.includes(canal) 
        ? prev.filter(c => c !== canal)
        : [...prev, canal]
    );
  };

  const handleDisparo = async () => {
    if (!mensagem.trim()) {
      alert('Digite uma mensagem');
      return;
    }

    if (canais.length === 0) {
      alert('Selecione pelo menos um canal');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/comunicacao/enviar-massa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          mensagem,
          assunto,
          canais
        })
      });

      const data = await response.json();
      
      setResultado(data);
      setMostrarResultado(true);

      if (onDisparo) {
        onDisparo(data);
      }

      if (data.success) {
        // Resetar formulário após sucesso
        setTimeout(() => {
          setMensagem('');
          setAssunto('');
          setCanais(['whatsapp']);
          setTipo('todos');
          setAbrirModal(false);
        }, 2000);
      }
    } catch (error) {
      alert('Erro ao enviar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão de Disparo */}
      <button
        onClick={() => setAbrirModal(true)}
        className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
      >
        <FontAwesomeIcon icon={faPaperPlane} />
        Enviar em Massa
      </button>

      {/* Modal de Disparo */}
      {abrirModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {!mostrarResultado ? (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 flex justify-between items-center">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <FontAwesomeIcon icon={faPaperPlane} />
                    Enviar Mensagens em Massa
                  </h2>
                  <button
                    onClick={() => setAbrirModal(false)}
                    className="hover:bg-teal-700 p-2 rounded transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6 space-y-6">
                  {/* 1. Tipo de Destinatário */}
                  <div>
                    <h3 className="font-bold text-gray-800 mb-4">1. Selecione os Destinatários</h3>
                    <div className="space-y-3">
                      {[
                        { id: 'todos', label: 'Todos os Usuários', desc: 'Lideranças + Operadores' },
                        { id: 'liderancas', label: 'Apenas Lideranças', desc: 'Apenas líderes' },
                        { id: 'operadores', label: 'Apenas Operadores', desc: 'Apenas operadores' }
                      ].map(opcao => (
                        <label key={opcao.id} className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-teal-400 transition"
                          style={{ borderColor: tipo === opcao.id ? '#14b8a6' : '#e5e7eb' }}>
                          <input
                            type="radio"
                            name="tipo"
                            value={opcao.id}
                            checked={tipo === opcao.id}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-4 h-4"
                          />
                          <div className="ml-3">
                            <p className="font-semibold text-gray-800">{opcao.label}</p>
                            <p className="text-sm text-gray-500">{opcao.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 2. Selecionar Canais */}
                  <div>
                    <h3 className="font-bold text-gray-800 mb-4">2. Selecione os Canais de Envio</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'whatsapp', label: 'WhatsApp', icon: faWhatsapp, cor: 'bg-green-100 border-green-300' },
                        { id: 'email', label: 'Email', icon: faEnvelope, cor: 'bg-blue-100 border-blue-300' },
                        { id: 'sms', label: 'SMS', icon: faPhone, cor: 'bg-purple-100 border-purple-300' }
                      ].map(canal => (
                        <button
                          key={canal.id}
                          onClick={() => handleToggleCanal(canal.id)}
                          className={`p-4 rounded-lg border-2 transition font-semibold flex flex-col items-center gap-2 ${
                            canais.includes(canal.id)
                              ? `${canal.cor} border-opacity-100`
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          <FontAwesomeIcon icon={canal.icon} size="lg" />
                          {canal.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Assunto (opcional, para email) */}
                  {canais.includes('email') && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Assunto do Email (opcional)
                      </label>
                      <input
                        type="text"
                        value={assunto}
                        onChange={(e) => setAssunto(e.target.value)}
                        placeholder="Ex: Comunicado Importante"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  )}

                  {/* 4. Mensagem */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mensagem *
                    </label>
                    <textarea
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Digite a mensagem que será enviada..."
                      rows="6"
                      maxLength="1000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {mensagem.length}/1000 caracteres
                    </p>
                  </div>

                  {/* Aviso */}
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Aviso:</strong> Esta ação enviará a mensagem para todos os destinatários selecionados. Verifique bem antes de confirmar.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
                  <button
                    onClick={() => setAbrirModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition font-semibold text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDisparo}
                    disabled={loading}
                    className="px-6 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} />
                        Enviar
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Tela de Resultado */}
                <div className="p-8 text-center">
                  {resultado.success ? (
                    <>
                      <div className="flex justify-center mb-4">
                        <FontAwesomeIcon 
                          icon={faCheckCircle} 
                          className="text-green-500" 
                          size="3x" 
                        />
                      </div>
                      <h3 className="text-2xl font-bold text-green-600 mb-2">
                        Mensagens Enviadas!
                      </h3>
                      <p className="text-gray-600 mb-6">
                        {resultado.resumo.sucessos} de {resultado.resumo.total} mensagens enviadas com sucesso
                      </p>

                      {/* Resumo */}
                      <div className="bg-green-50 rounded-lg p-4 mb-6 text-left space-y-2">
                        <p><strong>Destinatários:</strong> {resultado.resumo.destinatarios}</p>
                        <p><strong>Canais:</strong> {resultado.resumo.canais.join(', ')}</p>
                        <p><strong>Sucessos:</strong> <span className="text-green-600 font-bold">{resultado.resumo.sucessos}</span></p>
                        {resultado.resumo.erros > 0 && (
                          <p><strong>Erros:</strong> <span className="text-red-600 font-bold">{resultado.resumo.erros}</span></p>
                        )}
                      </div>

                      {/* Detalhes */}
                      {resultado.resultados.length < 20 && (
                        <div className="text-left bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto mb-6">
                          {resultado.resultados.map((r, idx) => (
                            <div key={idx} className="text-xs py-1 border-b border-gray-200">
                              <span className="font-semibold">{r.destinatario}</span>
                              <span className="text-gray-500"> ({r.canal})</span>
                              {r.status === 'enviado' ? (
                                <span className="text-green-600 ml-2">✓ Enviado</span>
                              ) : (
                                <span className="text-red-600 ml-2">✗ {r.erro}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center mb-4">
                        <FontAwesomeIcon 
                          icon={faExclamationCircle} 
                          className="text-red-500" 
                          size="3x" 
                        />
                      </div>
                      <h3 className="text-2xl font-bold text-red-600 mb-2">
                        Erro no Envio
                      </h3>
                      <p className="text-gray-600 mb-6">
                        {resultado.message || 'Ocorreu um erro ao tentar enviar as mensagens'}
                      </p>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setMostrarResultado(false);
                      setAbrirModal(false);
                    }}
                    className="px-6 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition"
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
