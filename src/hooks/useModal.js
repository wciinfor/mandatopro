import { useState } from 'react';

export default function useModal() {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: 'MandatoPro',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancelar',
    showCancel: false,
    onConfirm: null
  });

  const showModal = ({ 
    title = 'MandatoPro',
    message, 
    type = 'info', 
    confirmText = 'OK',
    cancelText = 'Cancelar',
    showCancel = false,
    onConfirm = null 
  }) => {
    setModalState({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      showCancel,
      onConfirm
    });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Atalhos para tipos específicos
  const showSuccess = (message, onConfirm = null) => {
    showModal({ 
      message, 
      type: 'success', 
      confirmText: 'Entendi',
      onConfirm 
    });
  };

  const showError = (message, onConfirm = null) => {
    showModal({ 
      message, 
      type: 'error', 
      confirmText: 'Entendi',
      onConfirm 
    });
  };

  const showWarning = (message, onConfirm = null) => {
    showModal({ 
      message, 
      type: 'warning', 
      confirmText: 'Entendi',
      onConfirm 
    });
  };

  const showInfo = (message, onConfirm = null) => {
    showModal({ 
      message, 
      type: 'info', 
      confirmText: 'OK',
      onConfirm 
    });
  };

  const showConfirm = (titleOrMessage, messageOrCallback, onConfirm = null) => {
    // Se receber 3 parâmetros: title, message, callback
    // Se receber 2 parâmetros: message, callback (compatibilidade)
    let title = 'MandatoPro';
    let message = '';
    let callback = null;

    if (typeof messageOrCallback === 'function') {
      // Formato: showConfirm(message, callback)
      message = titleOrMessage;
      callback = messageOrCallback;
    } else {
      // Formato: showConfirm(title, message, callback)
      title = titleOrMessage;
      message = messageOrCallback;
      callback = onConfirm;
    }

    showModal({ 
      title,
      message, 
      type: 'confirm', 
      confirmText: 'Sim',
      cancelText: 'Não',
      showCancel: true,
      onConfirm: callback
    });
  };

  return {
    modalState,
    showModal,
    closeModal,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm
  };
}
