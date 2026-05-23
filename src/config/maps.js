// Configuração do Google Maps
export const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  libraries: ['places'],
  language: 'pt-BR',
  region: 'BR'
};

// Centro padrão (Belém, PA)
export const DEFAULT_CENTER = {
  lat: -1.4558,
  lng: -48.4902
};

export const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
};
