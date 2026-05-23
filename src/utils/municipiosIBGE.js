/**
 * Mapa de Códigos IBGE dos Municípios Brasileiros
 *
 * Este arquivo contém uma estrutura para buscar o código IBGE
 * de um município pelo nome. Para uma implementação completa,
 * você pode integrar com uma API ou banco de dados.
 *
 * Exemplo de uso:
 *   const idMunicipio = getMunicipioIBGEByName('Manaus');
 */

// Municípios principais com seus códigos IBGE
// Formato: { nome: 'Nome da Cidade', uf: 'UF', ibge: 'CÓDIGO IBGE' }
const MUNICIPIOS_IBGE = [
  // Amazonas (mais usados)
  { nome: 'Manaus', uf: 'AM', ibge: '1302603' },
  { nome: 'Parintins', uf: 'AM', ibge: '1303403' },
  { nome: 'Itacoatiara', uf: 'AM', ibge: '1301605' },
  { nome: 'Coari', uf: 'AM', ibge: '1301209' },
  { nome: 'Maués', uf: 'AM', ibge: '1302254' },
  { nome: 'Tabatinga', uf: 'AM', ibge: '1304302' },
  { nome: 'Benjamin Constant', uf: 'AM', ibge: '1300799' },
  { nome: 'Eirunepé', uf: 'AM', ibge: '1300987' },
  { nome: 'Humaitá', uf: 'AM', ibge: '1301902' },
  { nome: 'Apuí', uf: 'AM', ibge: '1300144' },
  { nome: 'Careiro', uf: 'AM', ibge: '1300921' },
  { nome: 'Careiro da Várzea', uf: 'AM', ibge: '1300938' },
  { nome: 'Autazes', uf: 'AM', ibge: '1300201' },
  { nome: 'Novo Airão', uf: 'AM', ibge: '1303253' },
  { nome: 'Silves', uf: 'AM', ibge: '1304054' },
  { nome: 'Manacapuru', uf: 'AM', ibge: '1302304' },
  { nome: 'Santa Isabel do Rio Negro', uf: 'AM', ibge: '1303908' },
  { nome: 'São Paulo de Olivença', uf: 'AM', ibge: '1304104' },
  { nome: 'Barcelos', uf: 'AM', ibge: '1300450' },
  { nome: 'Iranduba', uf: 'AM', ibge: '1301704' },

  // Mais estados (adicione conforme necessário)
  { nome: 'Brasília', uf: 'DF', ibge: '5300108' },
  { nome: 'Rio de Janeiro', uf: 'RJ', ibge: '3304557' },
  { nome: 'São Paulo', uf: 'SP', ibge: '3550308' },
  { nome: 'Belo Horizonte', uf: 'MG', ibge: '3106200' },
  { nome: 'Salvador', uf: 'BA', ibge: '2704302' },
  { nome: 'Recife', uf: 'PE', ibge: '2611606' },
  { nome: 'Fortaleza', uf: 'CE', ibge: '2304400' },
  { nome: 'Curitiba', uf: 'PR', ibge: '4106902' },
  { nome: 'Porto Alegre', uf: 'RS', ibge: '4314902' },
  { nome: 'Brasília', uf: 'DF', ibge: '5300108' },

  // Pará (mais usados)
  { nome: 'Abaetetuba', uf: 'PA', ibge: '1500107' },
];

/**
 * Busca o código IBGE de um município por nome
 * @param {string} nomeMunicipio - Nome do município
 * @param {string} uf - Sigla do estado (opcional para maior precisão)
 * @returns {string|null} Código IBGE ou null se não encontrado
 */
export function getMunicipioIBGEByName(nomeMunicipio, uf = null) {
  if (!nomeMunicipio) return null;

  const nomeNormalizado = nomeMunicipio
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

  const municipio = MUNICIPIOS_IBGE.find(m => {
    const nomeM = m.nome
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (uf) {
      return nomeM === nomeNormalizado && m.uf === uf.toUpperCase();
    }
    return nomeM === nomeNormalizado;
  });

  return municipio ? municipio.ibge : null;
}

/**
 * Busca o nome do município por código IBGE
 * @param {string} codigoIBGE - Código IBGE do município
 * @returns {string|null} Nome do município ou null se não encontrado
 */
export function getMunicipioNameByIBGE(codigoIBGE) {
  const municipio = MUNICIPIOS_IBGE.find(m => m.ibge === codigoIBGE.toString());
  return municipio ? municipio.nome : null;
}

/**
 * Lista todos os municípios de um estado
 * @param {string} uf - Sigla do estado
 * @returns {Array} Array de municípios
 */
export function getMunicipiosByUF(uf) {
  return MUNICIPIOS_IBGE.filter(m => m.uf === uf.toUpperCase());
}

/**
 * Busca municípios por filtro (busca aproximada)
 * @param {string} filtro - Texto para filtrar
 * @returns {Array} Array de municípios que correspondem
 */
export function searchMunicipios(filtro) {
  if (!filtro) return [];

  const filtroNormalizado = filtro
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return MUNICIPIOS_IBGE.filter(m =>
    m.nome
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes(filtroNormalizado)
  );
}

const municipiosIBGEUtils = {
  MUNICIPIOS_IBGE,
  getMunicipioIBGEByName,
  getMunicipioNameByIBGE,
  getMunicipiosByUF,
  searchMunicipios,
};

export default municipiosIBGEUtils;
