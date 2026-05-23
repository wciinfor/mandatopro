import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

function RuntimeAbortErrorGuard() {
  useEffect(() => {
    const handler = (event) => {
      const reason = event?.reason;
      const name = String(reason?.name || '');
      const message = String(reason?.message || '').toLowerCase();

      const isKnownAbort =
        name === 'AbortError' &&
        message.includes('signal is aborted without reason');

      if (isKnownAbort) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return null;
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RuntimeAbortErrorGuard />
        <Component {...pageProps} />
      </NotificationProvider>
    </AuthProvider>
  );
}
