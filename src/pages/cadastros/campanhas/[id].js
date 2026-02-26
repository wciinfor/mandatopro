import { useRouter } from 'next/router';
import NovaCampanha from './novo';

export default function EditarCampanha() {
  const router = useRouter();
  
  // Se a rota ainda não está pronta, retorna vazio
  if (!router.isReady) {
    return null;
  }

  // Reutiliza o mesmo componente
  return <NovaCampanha />;
}
