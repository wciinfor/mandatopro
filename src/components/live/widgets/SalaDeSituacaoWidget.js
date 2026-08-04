import React from 'react';
import LiveWidget from '../LiveWidget';
import InteligenciaWidget from './InteligenciaWidget';
import RadarWidget from './RadarWidget';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChess, faBrain, faSatellite } from '@fortawesome/free-solid-svg-icons';

/**
 * SalaDeSituacaoWidget
 * Módulo consolidado de Análise Estratégica do MandatoPRO Live.
 * Unifica o Centro de Inteligência e o Radar Preditivo (INSYSTENS Ready) em uma única visualização executiva.
 */
export default function SalaDeSituacaoWidget() {
  return (
    <LiveWidget
      titulo="Sala de Situação & Inteligência Estratégica"
      subtitulo="Consolidação executiva de diagnósticos, motor de regras e radar preditivo"
      icone={faChess}
      badgeTag="Sala de Situação"
      corBadge="purple"
      densityMode="commandCenter"
    >
      <div className="grid grid-cols-12 gap-3 h-full overflow-hidden">
        {/* Coluna Esquerda (6 Colunas): Centro de Inteligência */}
        <div className="col-span-6 h-full overflow-hidden flex flex-col">
          <InteligenciaWidget />
        </div>

        {/* Coluna Direita (6 Colunas): Radar Estratégico & Preditivo */}
        <div className="col-span-6 h-full overflow-hidden flex flex-col">
          <RadarWidget />
        </div>
      </div>
    </LiveWidget>
  );
}
