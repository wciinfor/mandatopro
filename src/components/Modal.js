import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckCircle, 
  faExclamationTriangle, 
  faInfoCircle, 
  faTimesCircle,
  faTimes,
  faQuestionCircle
} from '@fortawesome/free-solid-svg-icons';

export default function Modal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = 'MandatoPro',
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info', 'confirm'
  confirmText = 'OK',
  cancelText = 'Cancelar',
  showCancel = false
}) {
  if (!isOpen) return null;

  const icons = {
    success: { icon: faCheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    error: { icon: faTimesCircle, color: 'text-red-500', bg: 'bg-red-50' },
    warning: { icon: faExclamationTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    info: { icon: faInfoCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
    confirm: { icon: faQuestionCircle, color: 'text-teal-500', bg: 'bg-teal-50' }
  };

  const currentIcon = icons[type] || icons.info;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={showCancel ? handleCancel : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all animate-modal-in">
        {/* Header com Logo */}
        <div className="bg-gradient-to-r from-[#0A4C53] to-[#032E35] rounded-t-2xl p-6 text-white relative overflow-hidden">
          {/* Padrão de fundo decorativo */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
          </div>
          
          <div className="relative flex items-center gap-3">
            {/* Logo */}
            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg">
              🏛️
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-xs text-teal-100">SISTEMA DE GESTÃO POLÍTICA</p>
            </div>
          </div>

          {/* Botão Fechar */}
          {!showCancel && (
            <button
              onClick={handleConfirm}
              className="absolute top-4 right-4 text-white hover:text-teal-200 transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} className="text-lg" />
            </button>
          )}
        </div>

        {/* Corpo do Modal */}
        <div className="p-6">
          {/* Ícone e Mensagem */}
          <div className="flex items-start gap-4">
            <div className={`${currentIcon.bg} w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <FontAwesomeIcon 
                icon={currentIcon.icon} 
                className={`${currentIcon.color} text-3xl`}
              />
            </div>
            <div className="flex-1 pt-2">
              {typeof message === 'string' ? (
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              ) : (
                <div className="text-gray-800 text-sm">
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer com Botões */}
        <div className={`p-6 pt-0 flex gap-3 ${showCancel ? 'justify-end' : 'justify-center'}`}>
          {showCancel && (
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors min-w-[120px]"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-6 py-3 rounded-xl font-semibold transition-colors min-w-[120px] ${
              type === 'error' 
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : type === 'success'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : type === 'warning'
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-[#0A4C53] hover:bg-[#032E35] text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
