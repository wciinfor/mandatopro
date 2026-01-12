import { useEffect, useRef } from 'react';
import { registrarAcesso } from '@/services/logService';

/**
 * Hook que registra acesso ao módulo/página
 * @param {object} usuario - Usuário logado
 * @param {string} modulo - Nome do módulo
 * @param {string} pagina - Nome da página
 */
export const useRegistrarAcesso = (usuario, modulo, pagina) => {
  const acessoRegistrado = useRef(false);

  useEffect(() => {
    if (usuario && !acessoRegistrado.current && modulo && pagina) {
      acessoRegistrado.current = true;
      registrarAcesso(usuario, modulo, pagina);
    }
  }, [usuario, modulo, pagina]);
};
