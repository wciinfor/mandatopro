import { useState, useEffect, createContext, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faComment, faTimes } from '@fortawesome/free-solid-svg-icons';

// Context para notificações
const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Adicionar nova notificação
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      ...notification,
      createdAt: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Mostrar notificação do navegador se permitido
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: `msg-${newNotification.id}`
      });
    }

    // Tocar som de notificação
    playNotificationSound();

    // Auto-remover após 5 segundos
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  };

  // Remover notificação
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Marcar como lida
  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Marcar todas como lidas
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Limpar todas
  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // Tocar som de notificação
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3'); // Você precisará adicionar este arquivo
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Não foi possível reproduzir som:', e));
    } catch (e) {
      console.log('Som de notificação não disponível');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.log('Permissão de notificação não concedida');
      }
    }
  };

  const value = {
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    requestNotificationPermission
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// Hook para usar notificações
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Container de notificações flutuantes
function NotificationContainer() {
  const { notifications, removeNotification, markAsRead } = useNotifications();

  // Mostrar apenas notificações não lidas
  const visibleNotifications = notifications.filter(n => !n.read).slice(0, 3);

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2">
      {visibleNotifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
          onClick={() => {
            markAsRead(notification.id);
            if (notification.onClick) {
              notification.onClick();
            }
          }}
        />
      ))}
    </div>
  );
}

// Toast de notificação individual
function NotificationToast({ notification, onClose, onClick }) {
  return (
    <div
      className="bg-white rounded-lg shadow-2xl border-l-4 border-teal-500 p-4 min-w-[320px] max-w-[400px] cursor-pointer hover:shadow-xl transition-all transform hover:scale-105 animate-slide-in"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
          <FontAwesomeIcon icon={faComment} className="text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-gray-900 text-sm">
              {notification.title}
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} className="text-xs" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {getTimeAgo(notification.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper para formatar tempo decorrido
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Agora mesmo';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

// CSS para animação
const styles = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;

// Injetar CSS
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
