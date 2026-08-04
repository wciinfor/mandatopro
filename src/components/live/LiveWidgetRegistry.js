import EleitoresWidget from './widgets/EleitoresWidget';
import AtendimentosWidget from './widgets/AtendimentosWidget';
import CampanhasWidget from './widgets/CampanhasWidget';
import MapaWidget from './widgets/MapaWidget';
import MetasWidget from './widgets/MetasWidget';
import LiderancasPerformanceWidget from './widgets/LiderancasPerformanceWidget';
import AtividadeTempoRealWidget from './widgets/AtividadeTempoRealWidget';
import InteligenciaWidget from './widgets/InteligenciaWidget';
import StatusWidget from './widgets/StatusWidget';
import StatusCompactoWidget from './widgets/StatusCompactoWidget';
import RadarWidget from './widgets/RadarWidget';
import SalaDeSituacaoWidget from './widgets/SalaDeSituacaoWidget';

/**
 * Registro Central de Widgets do MandatoPRO Live
 * Permite adicionar, remover ou reordenar os widgets dinamicamente sem alterar o layout principal.
 */
export const LiveWidgetRegistry = {
  statusGeral: {
    id: 'statusGeral',
    component: StatusWidget,
    gridClass: 'col-span-12 row-span-4'
  },
  statusCompacto: {
    id: 'statusCompacto',
    component: StatusCompactoWidget,
    gridClass: 'col-span-12 row-span-2'
  },
  salaDeSituacao: {
    id: 'salaDeSituacao',
    component: SalaDeSituacaoWidget,
    gridClass: 'col-span-12 row-span-6'
  },
  eleitores: {
    id: 'eleitores',
    component: EleitoresWidget,
    gridClass: 'col-span-4 row-span-4'
  },
  atividadeTempoReal: {
    id: 'atividadeTempoReal',
    component: AtividadeTempoRealWidget,
    gridClass: 'col-span-4 row-span-4'
  },
  inteligencia: {
    id: 'inteligencia',
    component: InteligenciaWidget,
    gridClass: 'col-span-4 row-span-4'
  },
  radarEstrategico: {
    id: 'radarEstrategico',
    component: RadarWidget,
    gridClass: 'col-span-6 row-span-4'
  },
  mapa: {
    id: 'mapa',
    component: MapaWidget,
    gridClass: 'col-span-6 row-span-4'
  },
  liderancasPerformance: {
    id: 'liderancasPerformance',
    component: LiderancasPerformanceWidget,
    gridClass: 'col-span-6 row-span-4'
  }
};

/**
 * Retorna os widgets na ordem de layout padrão
 */
export const getActiveWidgets = () => {
  return [
    LiveWidgetRegistry.statusGeral,
    LiveWidgetRegistry.salaDeSituacao,
    LiveWidgetRegistry.eleitores,
    LiveWidgetRegistry.atividadeTempoReal,
    LiveWidgetRegistry.mapa,
    LiveWidgetRegistry.liderancasPerformance
  ];
};
