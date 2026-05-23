import '../styles/globals.css';
import { useJsApiLoader } from '@react-google-maps/api';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

const libraries = ['places'];

export default function App({ Component, pageProps }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyBc30k7GJW3UvC2RGKx4RY8XyxJDJStcWg',
    libraries: libraries,
    language: 'pt-BR',
    region: 'BR'
  });

  return (
    <AuthProvider>
      <NotificationProvider>
        <Component {...pageProps} />
      </NotificationProvider>
    </AuthProvider>
  );
}
