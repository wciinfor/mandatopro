import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRouter } from 'next/router';

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const handleClick = () => {
    router.push('/comunicacao');
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      title="Mensagens"
    >
      <FontAwesomeIcon icon={faBell} className="text-gray-600 text-xl" />
      {unreadCount > 0 && (
        <>
          {/* Badge com número */}
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
          {/* Pulso animado */}
          <span className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[20px] h-5 animate-ping opacity-75"></span>
        </>
      )}
    </button>
  );
}
