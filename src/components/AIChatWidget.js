import { useEffect, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faTimes, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';

export default function AIChatWidget() {
  const { user } = useAuth();
  const initialMessages = [
    {
      role: 'assistant',
      content: 'Oi! Sou a Maia, atendente virtual. Posso consultar campanhas, agenda, liderancas, eleitores, atendimentos e solicitacoes. O que voce precisa?'
    }
  ];
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const scrollContainerRef = useRef(null);
  const scrollEndRef = useRef(null);
  const [messages, setMessages] = useState(initialMessages);
  const hasUserMessages = messages.some(msg => msg.role === 'user');

  useEffect(() => {
    const carregarStatus = async () => {
      try {
        const response = await fetch('/api/configuracoes');
        if (!response.ok) return;
        const { data } = await response.json();
        if (data?.openai?.enabled) {
          const provider = data.openai.provider || 'openai';
          const hasKey = provider === 'groq' ? data.openai.hasGroqKey : data.openai.hasKey;
          setEnabled(Boolean(hasKey));
        } else {
          setEnabled(false);
        }
      } catch (error) {
        console.error('Erro ao carregar configuracoes:', error);
      }
    };

    if (user?.nivel === 'ADMINISTRADOR') {
      carregarStatus();
    }
  }, [user?.nivel]);

  useEffect(() => {
    if (!open) return;
    const end = scrollEndRef.current;
    if (end) {
      end.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading, open]);

  if (user?.nivel !== 'ADMINISTRADOR' || !enabled) {
    return null;
  }

  const handleSend = async () => {
    const texto = input.trim();
    if (!texto || loading) return;

    const novaMensagem = { role: 'user', content: texto };
    const historico = [...messages, novaMensagem].slice(-8);
    setMessages(prev => [...prev, novaMensagem]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: texto,
          history: historico,
          user: {
            id: user?.id,
            nivel: user?.nivel,
            nome: user?.nome
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (data?.disabled) {
          setEnabled(false);
          setOpen(false);
        }
        throw new Error(data.message || 'Erro ao consultar IA');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data?.disabled) {
        setEnabled(false);
        setOpen(false);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages(initialMessages);
    setInput('');
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-20 h-20 rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.45)] flex items-center justify-center overflow-hidden"
          title="Maia"
        >
          <img
            src="/img/ag_ia.png"
            alt="Maia"
            className="w-full h-full object-cover animate-pulse-scale rounded-full border-2 border-teal-500 box-border"
          />
        </button>
      )}

      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-teal-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white">
            <div className="flex items-center gap-2">
              <img src="/img/ag_ia.png" alt="Maia" className="w-6 h-6" />
              <span className="font-semibold">Maia</span>
            </div>
            <div className="flex items-center gap-2">
              {hasUserMessages && (
                <button
                  onClick={handleReset}
                  className="text-white/80 hover:text-white"
                  title="Limpar chat"
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/90 hover:text-white">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          <div ref={scrollContainerRef} className="max-h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, idx) => (
              <div
                key={`msg-${idx}`}
                className={`text-sm whitespace-pre-line p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white ml-6'
                    : 'bg-white border border-gray-200 text-gray-800 mr-6'
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-gray-500">Consultando...</div>
            )}
            <div ref={scrollEndRef} />
          </div>

          <div className="p-3 border-t bg-white">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Pergunte algo..."
              className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="mt-2 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
