import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/router';

export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    const lerUsuario = () => {
      try {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem('usuario');
        const u = raw ? JSON.parse(raw) : null;
        return u?.id ? { id: u.id, nome: u.nome, nivel: u.nivel } : null;
      } catch {
        return null;
      }
    };

    const atualizar = async () => {
      const usuario = lerUsuario();
      if (!usuario?.id) {
        if (!cancelled) setUnreadCount(0);
        return;
      }

      try {
        const resp = await fetch('/api/notificacoes/unread-count');
        const payload = await resp.json();
        if (!resp.ok) return;
        if (!cancelled) setUnreadCount(Number(payload?.unread || 0));
      } catch {
        // falha silenciosa
      }
    };

    atualizar();
    intervalId = setInterval(atualizar, 30000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleClick = () => {
    router.push('/comunicacao');
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      title={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
      aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
    >
      <FontAwesomeIcon icon={faBell} className="text-gray-600 text-xl" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
      )}
    </button>
  );
}
