import EleitoresWidget from './widgets/EleitoresWidget';
import AtendimentosWidget from './widgets/AtendimentosWidget';
import CampanhasWidget from './widgets/CampanhasWidget';
import MapaWidget from './widgets/MapaWidget';
import MetasWidget from './widgets/MetasWidget';
import LiderancasPerformanceWidget from './widgets/LiderancasPerformanceWidget';

/**
 * Registro Central de Widgets do MandatoPRO Live
 * Permite adicionar, remover ou reordenar os widgets dinamicamente sem alterar o layout principal.
 */
export const LiveWidgetRegistry = {
  eleitores: {
    id: 'eleitores',
    component: EleitoresWidget,
    gridClass: 'col-span-4 row-span-4'
  },
  atendimentos: {
    id: 'atendimentos',
    component: AtendimentosWidget,
    gridClass: 'col-span-4 row-span-4'
  },
  campanhas: {
    id: 'campanhas',
    component: CampanhasWidget,
    gridClass: 'col-span-4 row-span-4'
  },
  mapa: {
    id: 'mapa',
    component: MapaWidget,
    gridClass: 'col-span-6 row-span-8'
  },
  liderancasPerformance: {
    id: 'liderancasPerformance',
    component: LiderancasPerformanceWidget,
    gridClass: 'col-span-6 row-span-8'
  }
};

/**
 * Retorna os widgets na ordem de layout padrão
 */
export const getActiveWidgets = () => {
  return [
    LiveWidgetRegistry.eleitores,
    LiveWidgetRegistry.atendimentos,
    LiveWidgetRegistry.campanhas,
    LiveWidgetRegistry.mapa,
    LiveWidgetRegistry.liderancasPerformance
  ];
};
