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
      className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-[#536987] hover:text-[#087CFA] hover:bg-blue-50/70 border border-[#CBDCEC] transition-colors cursor-pointer bg-white shadow-xs"
      title={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
      aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
    >
      <FontAwesomeIcon icon={faBell} className="text-sm" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs ring-2 ring-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
