import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Utilitário para geração de PDFs do MandatoPro

class PDFGenerator {
  constructor() {
    this.doc = null;
    this.pageWidth = 210; // A4 width in mm
    this.pageHeight = 297; // A4 height in mm
    this.margin = 20;
  }

  // Inicializar novo documento
  initDoc() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
  }

  // Adicionar cabeçalho padrão
  addHeader(titulo, subtitulo = '') {
    const centerX = this.pageWidth / 2;
    
    // Logo/Título do Sistema
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83); // Cor teal do sistema
    this.doc.text('MandatoPro', centerX, 20, { align: 'center' });
    
    // Subtítulo do sistema
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Sistema de Gestão Política', centerX, 26, { align: 'center' });
    
    // Linha separadora
    this.doc.setDrawColor(20, 184, 166);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, 30, this.pageWidth - this.margin, 30);
    
    // Título do documento
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(titulo, centerX, 40, { align: 'center' });
    
    if (subtitulo) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(80, 80, 80);
      this.doc.text(subtitulo, centerX, 47, { align: 'center' });
    }
  }

  // Adicionar rodapé
  addFooter() {
    const pageCount = this.doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Linha separadora
      this.doc.setDrawColor(200, 200, 200);
      this.doc.setLineWidth(0.3);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);
      
      // Data de geração
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      this.doc.text(`Gerado em: ${dataGeracao}`, this.margin, this.pageHeight - 10);
      
      // Número da página
      this.doc.text(`Página ${i} de ${pageCount}`, this.pageWidth - this.margin, this.pageHeight - 10, { align: 'right' });
    }
  }

  // NOTA DE ATENDIMENTO MÉDICO
  gerarNotaAtendimentoMedico(dados) {
    this.initDoc();
    this.addHeader('NOTA DE ATENDIMENTO MÉDICO', 'Ação Social');
    
    let yPos = 55;
    
    // Dados do Eleitor
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS DO ELEITOR', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Nome', dados.eleitorNome || '-'],
        ['CPF', dados.eleitorCpf || '-'],
        ['Celular', dados.eleitorCelular || '-'],
        ['Email', dados.eleitorEmail || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados do Atendimento
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS DO ATENDIMENTO', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Tipo', 'Atendimento Médico'],
        ['Data', dados.dataAtendimento ? new Date(dados.dataAtendimento).toLocaleDateString('pt-BR') : '-'],
        ['Localidade', dados.localidadeAtendida || '-'],
        ['Liderança Responsável', dados.liderancaResponsavel || '-'],
        ['Status', dados.statusAtendimento || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Serviços Oferecidos
    if (dados.servicosOferecidos) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('SERVIÇOS OFERECIDOS', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhasServicos = this.doc.splitTextToSize(dados.servicosOferecidos, this.pageWidth - (this.margin * 2));
      this.doc.text(linhasServicos, this.margin, yPos);
      yPos += linhasServicos.length * 5 + 10;
    }
    
    // Descrição
    if (dados.descricao) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('DESCRIÇÃO', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhasDesc = this.doc.splitTextToSize(dados.descricao, this.pageWidth - (this.margin * 2));
      this.doc.text(linhasDesc, this.margin, yPos);
      yPos += linhasDesc.length * 5 + 10;
    }
    
    // Observações
    if (dados.observacoes) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('OBSERVAÇÕES', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhasObs = this.doc.splitTextToSize(dados.observacoes, this.pageWidth - (this.margin * 2));
      this.doc.text(linhasObs, this.margin, yPos);
    }
    
    this.addFooter();
    return this.doc;
  }

  // NOTA DE ATENDIMENTO OFTALMOLÓGICO
  gerarNotaAtendimentoOftamologista(dados) {
    this.initDoc();
    this.addHeader('NOTA DE ATENDIMENTO OFTALMOLÓGICO', 'Ação Social');
    
    let yPos = 55;
    
    // Dados do Eleitor
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS DO ELEITOR', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Nome', dados.eleitorNome || '-'],
        ['CPF', dados.eleitorCpf || '-'],
        ['Celular', dados.eleitorCelular || '-'],
        ['Email', dados.eleitorEmail || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados do Atendimento
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS DO ATENDIMENTO', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Tipo', 'Atendimento Oftalmológico'],
        ['Data', dados.dataAtendimento ? new Date(dados.dataAtendimento).toLocaleDateString('pt-BR') : '-'],
        ['Localidade', dados.localidadeAtendida || '-'],
        ['Liderança Responsável', dados.liderancaResponsavel || '-'],
        ['Status', dados.statusAtendimento || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Adicionar informações específicas
    if (dados.servicosOferecidos) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('SERVIÇOS OFERECIDOS', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhas = this.doc.splitTextToSize(dados.servicosOferecidos, this.pageWidth - (this.margin * 2));
      this.doc.text(linhas, this.margin, yPos);
    }
    
    this.addFooter();
    return this.doc;
  }

  // NOTA DE PROCEDIMENTO HOSPITALAR
  gerarNotaAtendimentoHospitalar(dados) {
    this.initDoc();
    this.addHeader('NOTA DE PROCEDIMENTO HOSPITALAR', 'Ação Social');
    
    let yPos = 55;
    
    // Dados do Eleitor
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS DO ELEITOR', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Nome', dados.eleitorNome || '-'],
        ['CPF', dados.eleitorCpf || '-'],
        ['Celular', dados.eleitorCelular || '-'],
        ['Email', dados.eleitorEmail || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados do Procedimento
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS DO PROCEDIMENTO', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Tipo', 'Procedimento Hospitalar'],
        ['Data', dados.dataAtendimento ? new Date(dados.dataAtendimento).toLocaleDateString('pt-BR') : '-'],
        ['Localidade', dados.localidadeAtendida || '-'],
        ['Liderança Responsável', dados.liderancaResponsavel || '-'],
        ['Status', dados.statusAtendimento || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Descrição do procedimento
    if (dados.descricao) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('DESCRIÇÃO DO PROCEDIMENTO', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhas = this.doc.splitTextToSize(dados.descricao, this.pageWidth - (this.margin * 2));
      this.doc.text(linhas, this.margin, yPos);
    }
    
    this.addFooter();
    return this.doc;
  }

  // RELATÓRIO GERAL DE ATENDIMENTO
  gerarRelatorioAtendimento(dados) {
    this.initDoc();
    this.addHeader('RELATÓRIO DE ATENDIMENTO', '');
    
    let yPos = 55;
    
    // Informações do Atendimento
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('INFORMAÇÕES DO ATENDIMENTO', this.margin, yPos);
    yPos += 8;
    
    const tipoAtendimentoMap = {
      'ACAO_SOCIAL': 'Ação Social',
      'EMISSAO_DOCUMENTOS': 'Emissão de Documentos',
      'ATENDIMENTO_JURIDICO': 'Atendimento Jurídico',
      'OUTROS': 'Outros'
    };
    
    const statusMap = {
      'NAO_REALIZADO': 'Não Realizado',
      'EM_PROCESSO': 'Em Processo',
      'REALIZADO': 'Realizado'
    };
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Tipo de Atendimento', tipoAtendimentoMap[dados.tipoAtendimento] || '-'],
        ['Status', statusMap[dados.statusAtendimento] || '-'],
        ['Data do Atendimento', dados.dataAtendimento ? new Date(dados.dataAtendimento).toLocaleDateString('pt-BR') : '-'],
        ['Data de Conclusão', dados.dataConclusao ? new Date(dados.dataConclusao).toLocaleDateString('pt-BR') : '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados do Eleitor
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DADOS DO ELEITOR', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Nome', dados.eleitorNome || '-'],
        ['CPF', dados.eleitorCpf || '-'],
        ['Celular', dados.eleitorCelular || '-'],
        ['Email', dados.eleitorEmail || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados específicos por tipo
    if (dados.tipoAtendimento === 'ACAO_SOCIAL') {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('DETALHES DA AÇÃO SOCIAL', this.margin, yPos);
      yPos += 8;
      
      this.doc.autoTable({
        startY: yPos,
        head: [['Campo', 'Informação']],
        body: [
          ['Liderança Responsável', dados.liderancaResponsavel || '-'],
          ['Localidade Atendida', dados.localidadeAtendida || '-'],
          ['Tipo Específico', dados.tipoEspecifico || '-']
        ],
        theme: 'grid',
        headStyles: { fillColor: [10, 76, 83] },
        margin: { left: this.margin, right: this.margin }
      });
      
      yPos = this.doc.lastAutoTable.finalY + 10;
    }
    
    // Descrição
    if (dados.descricao) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('DESCRIÇÃO', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhas = this.doc.splitTextToSize(dados.descricao, this.pageWidth - (this.margin * 2));
      this.doc.text(linhas, this.margin, yPos);
      yPos += linhas.length * 5 + 10;
    }
    
    // Observações
    if (dados.observacoes) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('OBSERVAÇÕES', this.margin, yPos);
      yPos += 7;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const linhas = this.doc.splitTextToSize(dados.observacoes, this.pageWidth - (this.margin * 2));
      this.doc.text(linhas, this.margin, yPos);
    }
    
    this.addFooter();
    this.doc.save(`ficha-atendimento-${dados.eleitor ? dados.eleitor.replace(/\s+/g, '-').toLowerCase() : 'sem-nome'}.pdf`);
    return this.doc;
  }

  // RELATÓRIO DE LIDERANÇA
  gerarRelatorioLideranca(dados) {
    this.initDoc();
    this.addHeader('RELATÓRIO DE LIDERANÇA', dados.tipo || '');
    
    let yPos = 55;
    
    // Dados Pessoais
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(10, 76, 83);
    this.doc.text('DADOS PESSOAIS', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Nome', dados.nome || '-'],
        ['CPF', dados.cpf || '-'],
        ['RG', dados.rg || '-'],
        ['Data de Nascimento', dados.dataNascimento || '-'],
        ['Sexo', dados.sexo || '-'],
        ['Estado Civil', dados.estadoCivil || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados de Contato
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CONTATO', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Email', dados.email || '-'],
        ['Telefone', dados.telefone || '-'],
        ['Celular', dados.celular || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Endereço
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('ENDEREÇO', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['CEP', dados.cep || '-'],
        ['Logradouro', dados.logradouro || '-'],
        ['Número', dados.numero || '-'],
        ['Bairro', dados.bairro || '-'],
        ['Cidade', dados.cidade || '-'],
        ['UF', dados.uf || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    this.addFooter();
    this.doc.save(`ficha-lideranca-${dados.nome ? dados.nome.replace(/\s+/g, '-').toLowerCase() : 'sem-nome'}.pdf`);
    return this.doc;
  }

  // RELATÓRIO DE ELEITOR
  gerarRelatorioEleitor(dados) {
    this.initDoc();
    this.addHeader('RELATÓRIO DE ELEITOR', '');
    
    let yPos = 55;
    
    // Situação TSE
    const situacaoColor = dados.situacaoTSE === 'ATIVO' ? [34, 197, 94] : [239, 68, 68];
    this.doc.setFillColor(...situacaoColor);
    this.doc.rect(this.margin, yPos - 5, this.pageWidth - (this.margin * 2), 10, 'F');
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(`Situação TSE: ${dados.situacaoTSE || 'N/A'}`, this.pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 15;
    
    // Dados Pessoais
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DADOS PESSOAIS', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Nome', dados.nome || '-'],
        ['CPF', dados.cpf || '-'],
        ['Data de Nascimento', dados.dataNascimento || '-'],
        ['Sexo', dados.sexo || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Dados Eleitorais
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DADOS ELEITORAIS', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Título Eleitoral', dados.tituloEleitoral || '-'],
        ['Seção', dados.secao || '-'],
        ['Zona', dados.zona || '-'],
        ['Município', dados.municipio || '-'],
        ['Local de Votação', dados.localVotacao || '-'],
        ['Biometria', dados.biometria || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    yPos = this.doc.lastAutoTable.finalY + 10;
    
    // Contato
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CONTATO', this.margin, yPos);
    yPos += 8;
    
    this.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informação']],
      body: [
        ['Email', dados.email || '-'],
        ['Celular/WhatsApp', dados.celular || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 76, 83] },
      margin: { left: this.margin, right: this.margin }
    });
    
    this.addFooter();
    this.doc.save(`relatorio-eleitor-${dados.nome ? dados.nome.replace(/\s+/g, '-').toLowerCase() : 'sem-nome'}.pdf`);
    return this.doc;
  }

  // Gerar Crachá de Funcionário
  gerarCrachaFuncionario(dados) {
    // Criar documento com orientação vertical e tamanho personalizado para crachá
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [55, 85] // Tamanho padrão cartão PVC (5,5cm x 8,5cm)
    });

    const width = 55;
    const height = 85;

    // Fundo com gradiente (simulado com retângulos)
    this.doc.setFillColor(10, 76, 83); // Teal escuro
    this.doc.rect(0, 0, width, 15, 'F');

    // Logo e título do sistema
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('🏛️ MandatoPro', width / 2, 7, { align: 'center' });
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Sistema de Gestão Política', width / 2, 11, { align: 'center' });

    // Foto (se disponível)
    if (dados.foto) {
      try {
        this.doc.addImage(dados.foto, 'JPEG', 7, 20, 40, 50, undefined, 'FAST');
        // Borda da foto
        this.doc.setDrawColor(10, 76, 83);
        this.doc.setLineWidth(0.5);
        this.doc.rect(7, 20, 40, 50);
      } catch (error) {
        console.error('Erro ao adicionar foto:', error);
      }
    } else {
      // Placeholder se não houver foto
      this.doc.setFillColor(200, 200, 200);
      this.doc.rect(7, 20, 40, 50, 'F');
      this.doc.setTextColor(100, 100, 100);
      this.doc.setFontSize(10);
      this.doc.text('SEM', width / 2, 40, { align: 'center' });
      this.doc.text('FOTO', width / 2, 48, { align: 'center' });
    }

    // Dados do funcionário
    this.doc.setTextColor(0, 0, 0);
    
    // Nome
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    const nome = dados.nome || 'NÃO INFORMADO';
    const nomeLines = this.doc.splitTextToSize(nome, 48);
    let yPos = 73;
    this.doc.text(nomeLines, width / 2, yPos, { align: 'center' });
    yPos += nomeLines.length * 4;

    // Cargo
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    const cargo = dados.cargo || 'Não informado';
    const cargoLines = this.doc.splitTextToSize(cargo, 48);
    this.doc.text(cargoLines, width / 2, yPos, { align: 'center' });

    // Rodapé
    this.doc.setFillColor(10, 76, 83);
    this.doc.rect(0, height - 5, width, 5, 'F');
    this.doc.setFontSize(6);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('SISTEMA DE GESTÃO POLÍTICA', width / 2, height - 2, { align: 'center' });

    this.doc.save(`cracha-funcionario-${dados.nome ? dados.nome.replace(/\s+/g, '-').toLowerCase() : 'sem-nome'}.pdf`);
    return this.doc;
  }

  // Gerar Crachá de Liderança
  gerarCrachaLideranca(dados) {
    // Criar documento com orientação vertical e tamanho personalizado para crachá
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [55, 85] // Tamanho padrão cartão PVC (5,5cm x 8,5cm)
    });

    const width = 55;
    const height = 85;

    // Fundo degradê azul (simulando com retângulos)
    this.doc.setFillColor(0, 119, 182); // Azul claro superior
    this.doc.rect(0, 0, width, height / 2, 'F');
    this.doc.setFillColor(0, 82, 147); // Azul escuro inferior
    this.doc.rect(0, height / 2, width, height / 2, 'F');

    // Ondas decorativas (simuladas com círculos brancos semi-transparentes)
    this.doc.setFillColor(255, 255, 255);
    this.doc.setGState(new this.doc.GState({ opacity: 0.1 }));
    this.doc.circle(-10, 10, 30, 'F');
    this.doc.circle(width + 10, 15, 25, 'F');
    this.doc.circle(-5, height - 20, 35, 'F');
    this.doc.setGState(new this.doc.GState({ opacity: 1 }));

    // Cabeçalho branco
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(0, 0, width, 12, 'F');

    // Título
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 82, 147);
    this.doc.text('MANDATO PRO', width / 2, 5, { align: 'center' });
    
    // Subtítulo
    this.doc.setFontSize(6);
    this.doc.setTextColor(0, 119, 182);
    const tipoLideranca = dados.tipo === 'REGIONAL' ? 'LIDERANÇA REGIONAL' : 'LIDERANÇA LOCAL';
    this.doc.text(tipoLideranca, width / 2, 9, { align: 'center' });

    // Foto circular
    const fotoSize = 30;
    const fotoX = (width - fotoSize) / 2;
    const fotoY = 15;

    if (dados.foto) {
      try {
        // Círculo de fundo branco
        this.doc.setFillColor(255, 255, 255);
        this.doc.circle(width / 2, fotoY + fotoSize / 2, (fotoSize / 2) + 1, 'F');
        
        // Foto
        this.doc.addImage(dados.foto, 'JPEG', fotoX, fotoY, fotoSize, fotoSize, undefined, 'FAST');
        
        // Borda azul ao redor da foto
        this.doc.setDrawColor(0, 82, 147);
        this.doc.setLineWidth(1);
        this.doc.circle(width / 2, fotoY + fotoSize / 2, (fotoSize / 2) + 1);
      } catch (error) {
        console.error('Erro ao adicionar foto:', error);
        // Placeholder
        this.doc.setFillColor(255, 255, 255);
        this.doc.circle(width / 2, fotoY + fotoSize / 2, fotoSize / 2, 'F');
        this.doc.setDrawColor(0, 82, 147);
        this.doc.setLineWidth(1);
        this.doc.circle(width / 2, fotoY + fotoSize / 2, fotoSize / 2);
        this.doc.setTextColor(150, 150, 150);
        this.doc.setFontSize(7);
        this.doc.text('SEM', width / 2, fotoY + fotoSize / 2 - 1, { align: 'center' });
        this.doc.text('FOTO', width / 2, fotoY + fotoSize / 2 + 2, { align: 'center' });
      }
    } else {
      // Placeholder se não houver foto
      this.doc.setFillColor(255, 255, 255);
      this.doc.circle(width / 2, fotoY + fotoSize / 2, fotoSize / 2, 'F');
      this.doc.setDrawColor(0, 82, 147);
      this.doc.setLineWidth(1);
      this.doc.circle(width / 2, fotoY + fotoSize / 2, fotoSize / 2);
      this.doc.setTextColor(150, 150, 150);
      this.doc.setFontSize(7);
      this.doc.text('SEM', width / 2, fotoY + fotoSize / 2 - 1, { align: 'center' });
      this.doc.text('FOTO', width / 2, fotoY + fotoSize / 2 + 2, { align: 'center' });
    }

    // Nome
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(255, 255, 255);
    const nome = dados.nomeSocial || dados.nome || 'NÃO INFORMADO';
    const nomeLines = this.doc.splitTextToSize(nome.toUpperCase(), 50);
    let yPos = 52;
    this.doc.text(nomeLines, width / 2, yPos, { align: 'center' });
    yPos += nomeLines.length * 4;

    // Função/Equipe
    this.doc.setFontSize(6);
    this.doc.setFont('helvetica', 'normal');
    const funcao = dados.tipo === 'REGIONAL' ? 'EQUIPE REGIONAL' : 'EQUIPE LOCAL';
    this.doc.text(funcao, width / 2, yPos + 2, { align: 'center' });

    // QR Code (placeholder - retângulo branco)
    const qrSize = 12;
    const qrX = (width - qrSize) / 2;
    const qrY = height - 18;
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(qrX, qrY, qrSize, qrSize, 'F');
    this.doc.setDrawColor(0, 82, 147);
    this.doc.setLineWidth(0.3);
    this.doc.rect(qrX, qrY, qrSize, qrSize);
    
    // Texto ID abaixo do QR Code
    this.doc.setFontSize(4.5);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('ID: ' + (dados.cpf ? dados.cpf.substring(0, 6) : '******'), width / 2, height - 3, { align: 'center' });

    this.doc.save(`cracha-lideranca-${nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    return this.doc;
  }

  // Gerar Pedido de Lentes Oftalmológicas
  gerarPedidoLentes(dados) {
    this.initDoc();
    this.addHeader('PEDIDO DE LENTES OFTALMOLÓGICAS', 'Receita e Especificações');

    let yPos = 55;

    // Informações do Paciente
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('DADOS DO PACIENTE', this.margin, yPos);
    
    yPos += 7;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Nome: ${dados.eleitorNome || 'NÃO INFORMADO'}`, this.margin, yPos);
    yPos += 6;
    this.doc.text(`CPF: ${dados.eleitorCpf || 'NÃO INFORMADO'}`, this.margin, yPos);
    yPos += 6;
    this.doc.text(`Data do Atendimento: ${dados.dataAtendimento ? new Date(dados.dataAtendimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'NÃO INFORMADO'}`, this.margin, yPos);
    
    yPos += 12;

    // Receita Oftalmológica
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RECEITA OFTALMOLÓGICA', this.margin, yPos);
    
    yPos += 7;

    // Tabela de Receita
    const receitaData = [
      [
        'OD',
        dados.oftalmologista?.odEsferico || '-',
        dados.oftalmologista?.odCilindrico || '-',
        dados.oftalmologista?.odEixo || '-',
        dados.oftalmologista?.odAdicao || '-',
        dados.oftalmologista?.odDNP || '-'
      ],
      [
        'OE',
        dados.oftalmologista?.oeEsferico || '-',
        dados.oftalmologista?.oeCilindrico || '-',
        dados.oftalmologista?.oeEixo || '-',
        dados.oftalmologista?.oeAdicao || '-',
        dados.oftalmologista?.oeDNP || '-'
      ]
    ];

    this.doc.autoTable({
      startY: yPos,
      head: [['Olho', 'Esférico', 'Cilíndrico', 'Eixo', 'Adição', 'DNP']],
      body: receitaData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 119, 182],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [240, 240, 240] }
      },
      margin: { left: this.margin, right: this.margin }
    });

    yPos = this.doc.lastAutoTable.finalY + 12;

    // Especificações do Pedido
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 119, 182);
    this.doc.text('ESPECIFICAÇÕES DO PEDIDO', this.margin, yPos);
    
    yPos += 7;

    // Tipo de Lente
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Tipo de Lente:', this.margin, yPos);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(dados.oftalmologista?.tipoLente || 'NÃO ESPECIFICADO', this.margin + 35, yPos);
    
    yPos += 10;

    // Lista de Itens para Pedido
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 119, 182);
    this.doc.text('LISTA DE PEDIDO', this.margin, yPos);
    
    yPos += 7;

    // Montar descrição detalhada das lentes
    const descricaoOD = this.montarDescricaoLente('OD', dados.oftalmologista);
    const descricaoOE = this.montarDescricaoLente('OE', dados.oftalmologista);

    const pedidoData = [
      ['1', 'Lente Oftalmológica - Olho Direito (OD)', descricaoOD, '1'],
      ['2', 'Lente Oftalmológica - Olho Esquerdo (OE)', descricaoOE, '1']
    ];

    // Adicionar armação se necessário
    if (dados.oftalmologista?.tipoLente) {
      pedidoData.push(['3', 'Armação para Óculos', dados.oftalmologista.tipoLente, '1']);
    }

    this.doc.autoTable({
      startY: yPos,
      head: [['Item', 'Descrição', 'Especificações', 'Qtd']],
      body: pedidoData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 119, 182],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 95 },
        3: { cellWidth: 15, halign: 'center' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    yPos = this.doc.lastAutoTable.finalY + 12;

    // Observações
    if (dados.oftalmologista?.observacoesReceita) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('Observações:', this.margin, yPos);
      
      yPos += 6;
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      const obsLines = this.doc.splitTextToSize(dados.oftalmologista.observacoesReceita, this.pageWidth - (this.margin * 2));
      this.doc.text(obsLines, this.margin, yPos);
      yPos += obsLines.length * 5 + 8;
    }

    // Rodapé
    yPos = Math.max(yPos, this.pageHeight - 50);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, yPos, this.pageWidth - this.margin, yPos);
    
    yPos += 8;
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Assinatura do Responsável: _______________________________________', this.margin, yPos);
    
    yPos += 10;
    this.doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, this.margin, yPos);
    this.doc.text('Carimbo/Selo:', this.pageWidth - this.margin - 50, yPos);

    const nomeArquivo = `pedido-lentes-${dados.eleitorNome?.replace(/\s+/g, '-').toLowerCase() || 'paciente'}.pdf`;
    this.doc.save(nomeArquivo);
    return this.doc;
  }

  // Gerar Pedido de Lentes Oftalmológicas Consolidado (múltiplos atendimentos)
  gerarPedidoLentesConsolidado(atendimentos, numeroPedido, isSegundaVia = false) {
    this.initDoc();
    
    const titulo = isSegundaVia ? 'PEDIDO DE LENTES - SEGUNDA VIA' : 'PEDIDO DE LENTES OFTALMOLÓGICAS';
    this.addHeader(titulo, 'Consolidado para Fornecedor');

    let yPos = 55;

    // Informações do Pedido
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 119, 182);
    this.doc.text('INFORMAÇÕES DO PEDIDO', this.margin, yPos);
    
    yPos += 7;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(`Número do Pedido: ${numeroPedido}`, this.margin, yPos);
    yPos += 6;
    this.doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, this.margin, yPos);
    yPos += 6;
    this.doc.text(`Quantidade de Atendimentos: ${atendimentos.length}`, this.margin, yPos);
    yPos += 6;
    
    if (isSegundaVia) {
      this.doc.setTextColor(255, 0, 0);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('*** SEGUNDA VIA - NÃO DUPLICAR PEDIDO ***', this.margin, yPos);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont('helvetica', 'normal');
      yPos += 6;
    }

    yPos += 8;

    // Tabela consolidada de lentes
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 119, 182);
    this.doc.text('ESPECIFICAÇÕES TÉCNICAS DAS LENTES', this.margin, yPos);
    
    yPos += 7;

    // Preparar dados da tabela
    const lentesData = [];
    let itemCounter = 1;

    atendimentos.forEach(atendimento => {
      if (!atendimento.oftalmologista) return;

      const oft = atendimento.oftalmologista;
      const paciente = atendimento.eleitor || 'Não informado';
      const cpf = atendimento.eleitorCpf || 'Não informado';
      const cpfFinal = cpf.replace(/\D/g, '').slice(-4) || '****';

      // Lente OD
      lentesData.push([
        itemCounter++,
        paciente,
        cpfFinal,
        'OD',
        oft.odEsferico || '-',
        oft.odCilindrico || '-',
        oft.odEixo || '-',
        oft.odAdicao || '-',
        oft.odDNP || '-',
        oft.tipoLente || 'UNIFOCAL',
        '1'
      ]);

      // Lente OE
      lentesData.push([
        itemCounter++,
        paciente,
        cpfFinal,
        'OE',
        oft.oeEsferico || '-',
        oft.oeCilindrico || '-',
        oft.oeEixo || '-',
        oft.oeAdicao || '-',
        oft.oeDNP || '-',
        oft.tipoLente || 'UNIFOCAL',
        '1'
      ]);
    });

    this.doc.autoTable({
      startY: yPos,
      head: [['#', 'Paciente', 'CPF', 'Olho', 'ESF', 'CIL', 'Eixo', 'ADD', 'DNP', 'Tipo', 'Qtd']],
      body: lentesData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 119, 182],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 45, halign: 'left' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 12, halign: 'center' },
        8: { cellWidth: 12, halign: 'center' },
        9: { cellWidth: 30, halign: 'center' },
        10: { cellWidth: 10, halign: 'center' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    yPos = this.doc.lastAutoTable.finalY + 10;

    // Resumo por tipo de lente
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 119, 182);
    this.doc.text('RESUMO DO PEDIDO', this.margin, yPos);
    
    yPos += 7;

    // Contar tipos de lente
    const resumoLentes = {};
    atendimentos.forEach(atendimento => {
      if (!atendimento.oftalmologista) return;
      const tipo = atendimento.oftalmologista.tipoLente || 'UNIFOCAL';
      resumoLentes[tipo] = (resumoLentes[tipo] || 0) + 2; // 2 lentes por atendimento (OD + OE)
    });

    const resumoData = Object.entries(resumoLentes).map(([tipo, qtd]) => [
      tipo,
      qtd
    ]);

    this.doc.autoTable({
      startY: yPos,
      head: [['Tipo de Lente', 'Quantidade Total']],
      body: resumoData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 119, 182],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 10,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left' },
        1: { cellWidth: 50, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: this.margin, right: this.margin }
    });

    yPos = this.doc.lastAutoTable.finalY + 10;

    // Total geral
    const totalLentes = lentesData.length;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 119, 182);
    this.doc.text(`TOTAL DE LENTES NO PEDIDO: ${totalLentes}`, this.margin, yPos);

    // Observações importantes
    yPos += 10;
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(255, 0, 0);
    this.doc.text('OBSERVAÇÕES IMPORTANTES:', this.margin, yPos);
    yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(8);
    this.doc.text('• Todas as lentes devem seguir exatamente as especificações técnicas descritas', this.margin + 5, yPos);
    yPos += 4;
    this.doc.text('• Identificar cada par de lentes com os últimos 4 dígitos do CPF do paciente', this.margin + 5, yPos);
    yPos += 4;
    this.doc.text('• Prazo de entrega: conforme acordo comercial', this.margin + 5, yPos);
    yPos += 4;
    this.doc.text('• Em caso de dúvidas, entrar em contato antes de iniciar produção', this.margin + 5, yPos);

    // Rodapé
    yPos = Math.max(yPos + 15, this.pageHeight - 50);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, yPos, this.pageWidth - this.margin, yPos);
    
    yPos += 8;
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Assinatura do Responsável pelo Pedido: ___________________________________', this.margin, yPos);
    
    yPos += 10;
    this.doc.text(`Data de Recebimento pelo Fornecedor: ____/____/________`, this.margin, yPos);
    this.doc.text('Carimbo/Assinatura:', this.pageWidth - this.margin - 50, yPos);

    const nomeArquivo = isSegundaVia 
      ? `pedido-lentes-${numeroPedido}-2via.pdf`
      : `pedido-lentes-${numeroPedido}.pdf`;
    this.doc.save(nomeArquivo);
    return this.doc;
  }

  // Método auxiliar para montar descrição da lente
  montarDescricaoLente(olho, oftalmologista) {
    if (!oftalmologista) return 'Não especificado';

    const prefix = olho === 'OD' ? 'od' : 'oe';
    const esferico = oftalmologista[`${prefix}Esferico`] || '-';
    const cilindrico = oftalmologista[`${prefix}Cilindrico`] || '-';
    const eixo = oftalmologista[`${prefix}Eixo`] || '-';
    const adicao = oftalmologista[`${prefix}Adicao`] || '-';
    const dnp = oftalmologista[`${prefix}DNP`] || '-';

    const descricao = [
      `ESF: ${esferico}`,
      `CIL: ${cilindrico}`,
      `EIXO: ${eixo}°`,
      `ADD: ${adicao}`,
      `DNP: ${dnp}mm`
    ].join(' | ');

    return descricao;
  }
}

export default PDFGenerator;
