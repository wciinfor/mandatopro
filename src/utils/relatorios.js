import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const gerarPDFOrgaos = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const doc = new jsPDF();
  
  // Título
  doc.setFontSize(18);
  doc.text('Relatório de Órgãos', 14, 22);
  
  // Data de geração
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  
  // Tabela
  const tableData = listaParaExportar.map(org => [
    org.codigo,
    org.nome,
    org.tipo,
    org.cnpj,
    `${org.municipio}/${org.uf}`,
    org.responsavel,
    org.status
  ]);
  
  doc.autoTable({
    startY: 35,
    head: [['Cód', 'Nome', 'Tipo', 'CNPJ', 'Município/UF', 'Responsável', 'Status']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 76, 83] }
  });
  
  doc.save('relatorio-orgaos.pdf');
};

export const gerarExcelOrgaos = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const dadosExcel = listaParaExportar.map(org => ({
    'Código': org.codigo,
    'Nome': org.nome,
    'Tipo': org.tipo,
    'CNPJ': org.cnpj,
    'Endereço': org.endereco,
    'Município': org.municipio,
    'UF': org.uf,
    'Telefone': org.telefone,
    'Email': org.email,
    'Responsável': org.responsavel,
    'Contato': org.contato,
    'Status': org.status,
    'Observações': org.observacoes
  }));
  
  const ws = XLSX.utils.json_to_sheet(dadosExcel);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Órgãos');
  
  XLSX.writeFile(wb, 'relatorio-orgaos.xlsx');
};

export const gerarPDFResponsaveis = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Relatório de Responsáveis', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  
  const tableData = listaParaExportar.map(resp => [
    resp.codigo,
    resp.nome,
    resp.cargo,
    resp.orgao,
    resp.telefone,
    resp.email
  ]);
  
  doc.autoTable({
    startY: 35,
    head: [['Cód', 'Nome', 'Cargo', 'Órgão', 'Telefone', 'Email']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 76, 83] }
  });
  
  doc.save('relatorio-responsaveis.pdf');
};

export const gerarExcelResponsaveis = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const dadosExcel = listaParaExportar.map(resp => ({
    'Código': resp.codigo,
    'Nome': resp.nome,
    'Cargo': resp.cargo,
    'Órgão': resp.orgao,
    'CPF': resp.cpf,
    'Telefone': resp.telefone,
    'Email': resp.email,
    'WhatsApp': resp.whatsapp,
    'Status': resp.status,
    'Observações': resp.observacoes
  }));
  
  const ws = XLSX.utils.json_to_sheet(dadosExcel);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Responsáveis');
  
  XLSX.writeFile(wb, 'relatorio-responsaveis.xlsx');
};

export const gerarPDFEmendas = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text('Relatório de Emendas', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  
  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };
  
  const tableData = listaParaExportar.map(emenda => [
    emenda.numero,
    emenda.tipo,
    emenda.autor,
    emenda.finalidade.substring(0, 30) + '...',
    formatarValor(emenda.valorEmpenhado),
    formatarValor(emenda.valorExecutado),
    emenda.status
  ]);
  
  doc.autoTable({
    startY: 35,
    head: [['Número', 'Tipo', 'Autor', 'Finalidade', 'Empenhado', 'Executado', 'Status']],
    body: tableData,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [20, 76, 83] }
  });
  
  doc.save('relatorio-emendas.pdf');
};

export const gerarExcelEmendas = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const dadosExcel = listaParaExportar.map(emenda => ({
    'Código': emenda.codigo,
    'Número': emenda.numero,
    'Tipo': emenda.tipo,
    'Autor': emenda.autor,
    'Órgão': emenda.orgao,
    'Responsável': emenda.responsavel,
    'Finalidade': emenda.finalidade,
    'Valor Empenhado': emenda.valorEmpenhado,
    'Valor Executado': emenda.valorExecutado,
    'Data Empenho': emenda.dataEmpenho,
    'Data Vencimento': emenda.dataVencimento,
    'Status': emenda.status,
    'Observações': emenda.observacoes
  }));
  
  const ws = XLSX.utils.json_to_sheet(dadosExcel);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Emendas');
  
  XLSX.writeFile(wb, 'relatorio-emendas.xlsx');
};

export const gerarPDFRepasses = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text('Relatório de Repasses', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  
  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };
  
  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };
  
  const tableData = listaParaExportar.map(repasse => [
    repasse.codigo,
    repasse.emenda,
    `${repasse.parcela}/${repasse.totalParcelas}`,
    formatarValor(repasse.valor),
    formatarData(repasse.dataPrevista),
    formatarData(repasse.dataEfetivada),
    repasse.status
  ]);
  
  doc.autoTable({
    startY: 35,
    head: [['Código', 'Emenda', 'Parcela', 'Valor', 'Data Prevista', 'Data Efetivada', 'Status']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 76, 83] }
  });
  
  doc.save('relatorio-repasses.pdf');
};

export const gerarExcelRepasses = (dados, filtrados = null) => {
  const listaParaExportar = filtrados || dados;
  
  const dadosExcel = listaParaExportar.map(repasse => ({
    'Código': repasse.codigo,
    'Emenda': repasse.emenda,
    'Parcela': repasse.parcela,
    'Total Parcelas': repasse.totalParcelas,
    'Valor': repasse.valor,
    'Data Prevista': repasse.dataPrevista,
    'Data Efetivada': repasse.dataEfetivada || '',
    'Órgão': repasse.orgao,
    'Responsável': repasse.responsavel,
    'Status': repasse.status,
    'Observações': repasse.observacoes
  }));
  
  const ws = XLSX.utils.json_to_sheet(dadosExcel);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Repasses');
  
  XLSX.writeFile(wb, 'relatorio-repasses.xlsx');
};
