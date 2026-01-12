import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt, faChartBar, faDownload, faFilter, faCalendarAlt, faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import { MODULES } from '@/utils/permissions';
import PDFGenerator from '@/utils/pdfGenerator';

export default function RelatoriosSolicitacoes() {
  const [periodo, setPeriodo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);

  // Mock de estatísticas
  const stats = {
    total: 45,
    novas: 12,
    emAndamento: 18,
    atendidas: 10,
    recusadas: 5,
    porCategoria: {
      'Educação': 15,
      'Saúde': 12,
      'Infraestrutura': 8,
      'Meio Ambiente': 5,
      'Esporte e Lazer': 3,
      'Outros': 2
    },
    porPrioridade: {
      'URGENTE': 8,
      'ALTA': 12,
      'MÉDIA': 18,
      'BAIXA': 7
    },
    porMunicipio: {
      'Belém': 25,
      'Ananindeua': 10,
      'Marituba': 5,
      'Outros': 5
    },
    tempoMedioAtendimento: '7 dias'
  };

  const handleGerarRelatorio = () => {
    try {
      const pdfGenerator = new PDFGenerator();
      pdfGenerator.initDoc();
      
      // Adicionar cabeçalho
      pdfGenerator.addHeader('RELATÓRIO DE SOLICITAÇÕES', `Período: ${getPeriodoTexto()}`);
      
      let yPos = 55;
      
      // Estatísticas Gerais
      pdfGenerator.doc.setFontSize(12);
      pdfGenerator.doc.setFont('helvetica', 'bold');
      pdfGenerator.doc.setTextColor(10, 76, 83);
      pdfGenerator.doc.text('ESTATÍSTICAS GERAIS', pdfGenerator.margin, yPos);
      yPos += 8;
      
      pdfGenerator.doc.autoTable({
        startY: yPos,
        head: [['Categoria', 'Quantidade']],
        body: [
          ['Total de Solicitações', stats.total],
          ['Novas', stats.novas],
          ['Em Andamento', stats.emAndamento],
          ['Atendidas', stats.atendidas],
          ['Recusadas', stats.recusadas],
          ['Tempo Médio de Atendimento', stats.tempoMedioAtendimento]
        ],
        theme: 'grid',
        headStyles: { fillColor: [10, 76, 83] },
        margin: { left: pdfGenerator.margin, right: pdfGenerator.margin }
      });
      
      yPos = pdfGenerator.doc.lastAutoTable.finalY + 10;
      
      // Por Categoria
      pdfGenerator.doc.setFontSize(12);
      pdfGenerator.doc.setFont('helvetica', 'bold');
      pdfGenerator.doc.text('SOLICITAÇÕES POR CATEGORIA', pdfGenerator.margin, yPos);
      yPos += 8;
      
      const categoriaData = Object.entries(stats.porCategoria).map(([cat, qtd]) => [
        cat,
        qtd,
        `${((qtd / stats.total) * 100).toFixed(1)}%`
      ]);
      
      pdfGenerator.doc.autoTable({
        startY: yPos,
        head: [['Categoria', 'Quantidade', 'Percentual']],
        body: categoriaData,
        theme: 'striped',
        headStyles: { fillColor: [10, 76, 83] },
        margin: { left: pdfGenerator.margin, right: pdfGenerator.margin }
      });
      
      yPos = pdfGenerator.doc.lastAutoTable.finalY + 10;
      
      // Por Prioridade
      pdfGenerator.doc.setFontSize(12);
      pdfGenerator.doc.setFont('helvetica', 'bold');
      pdfGenerator.doc.text('SOLICITAÇÕES POR PRIORIDADE', pdfGenerator.margin, yPos);
      yPos += 8;
      
      const prioridadeData = Object.entries(stats.porPrioridade).map(([pri, qtd]) => [
        pri,
        qtd,
        `${((qtd / stats.total) * 100).toFixed(1)}%`
      ]);
      
      pdfGenerator.doc.autoTable({
        startY: yPos,
        head: [['Prioridade', 'Quantidade', 'Percentual']],
        body: prioridadeData,
        theme: 'striped',
        headStyles: { fillColor: [10, 76, 83] },
        margin: { left: pdfGenerator.margin, right: pdfGenerator.margin }
      });
      
      yPos = pdfGenerator.doc.lastAutoTable.finalY + 10;
      
      // Por Município
      pdfGenerator.doc.setFontSize(12);
      pdfGenerator.doc.setFont('helvetica', 'bold');
      pdfGenerator.doc.text('SOLICITAÇÕES POR MUNICÍPIO', pdfGenerator.margin, yPos);
      yPos += 8;
      
      const municipioData = Object.entries(stats.porMunicipio).map(([mun, qtd]) => [
        mun,
        qtd,
        `${((qtd / stats.total) * 100).toFixed(1)}%`
      ]);
      
      pdfGenerator.doc.autoTable({
        startY: yPos,
        head: [['Município', 'Quantidade', 'Percentual']],
        body: municipioData,
        theme: 'striped',
        headStyles: { fillColor: [10, 76, 83] },
        margin: { left: pdfGenerator.margin, right: pdfGenerator.margin }
      });
      
      // Adicionar rodapé
      pdfGenerator.addFooter();
      
      // Salvar PDF
      pdfGenerator.doc.save(`relatorio-solicitacoes-${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Mostrar modal de sucesso
      setMostrarModal(true);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar relatório PDF');
    }
  };

  const getPeriodoTexto = () => {
    const periodos = {
      'semana': 'Última Semana',
      'mes': 'Último Mês',
      'trimestre': 'Último Trimestre',
      'semestre': 'Último Semestre',
      'ano': 'Último Ano',
      'personalizado': `${dataInicio} a ${dataFim}`
    };
    return periodos[periodo] || 'Não especificado';
  };

  const handleExportarExcel = () => {
    try {
      // Preparar dados para CSV (compatível com Excel)
      let csv = 'RELATÓRIO DE SOLICITAÇÕES\n';
      csv += `Período: ${getPeriodoTexto()}\n`;
      csv += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
      
      // Estatísticas Gerais
      csv += 'ESTATÍSTICAS GERAIS\n';
      csv += 'Categoria,Quantidade\n';
      csv += `Total de Solicitações,${stats.total}\n`;
      csv += `Novas,${stats.novas}\n`;
      csv += `Em Andamento,${stats.emAndamento}\n`;
      csv += `Atendidas,${stats.atendidas}\n`;
      csv += `Recusadas,${stats.recusadas}\n`;
      csv += `Tempo Médio de Atendimento,${stats.tempoMedioAtendimento}\n\n`;
      
      // Por Categoria
      csv += 'SOLICITAÇÕES POR CATEGORIA\n';
      csv += 'Categoria,Quantidade,Percentual\n';
      Object.entries(stats.porCategoria).forEach(([cat, qtd]) => {
        csv += `${cat},${qtd},${((qtd / stats.total) * 100).toFixed(1)}%\n`;
      });
      csv += '\n';
      
      // Por Prioridade
      csv += 'SOLICITAÇÕES POR PRIORIDADE\n';
      csv += 'Prioridade,Quantidade,Percentual\n';
      Object.entries(stats.porPrioridade).forEach(([pri, qtd]) => {
        csv += `${pri},${qtd},${((qtd / stats.total) * 100).toFixed(1)}%\n`;
      });
      csv += '\n';
      
      // Por Município
      csv += 'SOLICITAÇÕES POR MUNICÍPIO\n';
      csv += 'Município,Quantidade,Percentual\n';
      Object.entries(stats.porMunicipio).forEach(([mun, qtd]) => {
        csv += `${mun},${qtd},${((qtd / stats.total) * 100).toFixed(1)}%\n`;
      });
      
      // Criar blob e fazer download
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-solicitacoes-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Mostrar modal de sucesso
      setMostrarModal(true);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      alert('Erro ao exportar para Excel');
    }
  };

  return (
    <ProtectedRoute module={MODULES.SOLICITACOES}>
      <Layout titulo="Relatórios de Solicitações">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faFilter} className="text-teal-600 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Filtros de Período</h2>
              <p className="text-sm text-gray-600">Selecione o período para análise</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PERÍODO</label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="semana">Última Semana</option>
                <option value="mes">Último Mês</option>
                <option value="trimestre">Último Trimestre</option>
                <option value="semestre">Último Semestre</option>
                <option value="ano">Último Ano</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            {periodo === 'personalizado' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DATA INÍCIO</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DATA FIM</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </>
            )}

            <div className="flex items-end gap-2">
              <button
                onClick={handleGerarRelatorio}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faFileAlt} />
                Gerar PDF
              </button>
              <button
                onClick={handleExportarExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faDownload} />
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-400">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-sm text-gray-600">Total de Solicitações</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-400">
            <div className="text-2xl font-bold text-gray-800">{stats.novas}</div>
            <div className="text-sm text-gray-600">Novas</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-400">
            <div className="text-2xl font-bold text-gray-800">{stats.emAndamento}</div>
            <div className="text-sm text-gray-600">Em Andamento</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-400">
            <div className="text-2xl font-bold text-gray-800">{stats.atendidas}</div>
            <div className="text-sm text-gray-600">Atendidas</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-400">
            <div className="text-2xl font-bold text-gray-800">{stats.recusadas}</div>
            <div className="text-sm text-gray-600">Recusadas</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Por Categoria */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faChartBar} className="text-teal-600" />
              Solicitações por Categoria
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.porCategoria).map(([categoria, qtd]) => (
                <div key={categoria}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{categoria}</span>
                    <span className="font-bold text-gray-900">{qtd}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full"
                      style={{ width: `${(qtd / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por Prioridade */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faChartBar} className="text-orange-600" />
              Solicitações por Prioridade
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.porPrioridade).map(([prioridade, qtd]) => {
                const cores = {
                  'URGENTE': 'bg-red-600',
                  'ALTA': 'bg-orange-600',
                  'MÉDIA': 'bg-yellow-600',
                  'BAIXA': 'bg-green-600'
                };
                return (
                  <div key={prioridade}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{prioridade}</span>
                      <span className="font-bold text-gray-900">{qtd}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${cores[prioridade]} h-2 rounded-full`}
                        style={{ width: `${(qtd / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Por Município */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartBar} className="text-purple-600" />
            Solicitações por Município
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.porMunicipio).map(([municipio, qtd]) => (
              <div key={municipio} className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-teal-600 mb-1">{qtd}</div>
                <div className="text-sm font-medium text-gray-700">{municipio}</div>
                <div className="text-xs text-gray-500">
                  {((qtd / stats.total) * 100).toFixed(1)}% do total
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indicadores */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Indicadores de Desempenho</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stats.tempoMedioAtendimento}</div>
              <div className="text-sm text-gray-700 font-medium">Tempo Médio de Atendimento</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {((stats.atendidas / stats.total) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-700 font-medium">Taxa de Atendimento</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600 mb-2">{stats.emAndamento}</div>
              <div className="text-sm text-gray-700 font-medium">Solicitações em Andamento</div>
            </div>
          </div>
        </div>

        {/* Modal de Sucesso */}
        <Modal 
          isOpen={mostrarModal} 
          onClose={() => setMostrarModal(false)}
          title="Sucesso!"
          message="Arquivo gerado com sucesso e download iniciado."
          type="success"
          confirmText="Fechar"
        />
      </Layout>
    </ProtectedRoute>
  );
}
