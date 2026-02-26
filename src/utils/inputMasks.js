const onlyDigits = (value = '') => value.replace(/\D/g, '');

const maskCPF = (value = '') => {
  const digits = onlyDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  if (digits.length <= 3) return part1;
  if (digits.length <= 6) return `${part1}.${part2}`;
  if (digits.length <= 9) return `${part1}.${part2}.${part3}`;
  return `${part1}.${part2}.${part3}-${part4}`;
};

const maskRG = (value = '') => {
  const digits = onlyDigits(value).slice(0, 9);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 9);
  if (digits.length <= 2) return part1;
  if (digits.length <= 5) return `${part1}.${part2}`;
  if (digits.length <= 8) return `${part1}.${part2}.${part3}`;
  return `${part1}.${part2}.${part3}-${part4}`;
};

const maskPhone = (value = '') => {
  const digits = onlyDigits(value).slice(0, 11);
  const ddd = digits.slice(0, 2);
  const part1 = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
  const part2 = digits.length > 10 ? digits.slice(7, 11) : digits.slice(6, 10);
  if (digits.length <= 2) return ddd;
  if (digits.length <= 6) return `(${ddd}) ${part1}`;
  return `(${ddd}) ${part1}-${part2}`;
};

const maskCEP = (value = '') => {
  const digits = onlyDigits(value).slice(0, 8);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 8);
  if (digits.length <= 5) return part1;
  return `${part1}-${part2}`;
};

const formatCurrencyBRL = (value = '') => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const digits = onlyDigits(String(value));
  if (!digits) return '';
  const numberValue = Number(digits) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseCurrencyBRL = (value = '') => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  const digits = onlyDigits(String(value));
  if (!digits) return null;
  return Number(digits) / 100;
};

const applyMask = (name, value) => {
  switch (name) {
    case 'cpf':
      return maskCPF(value);
    case 'rg':
      return maskRG(value);
    case 'telefone':
    case 'celular':
    case 'whatsapp':
      return maskPhone(value);
    case 'cep':
      return maskCEP(value);
    case 'salario':
      return formatCurrencyBRL(value);
    default:
      return value;
  }
};

export {
  applyMask,
  onlyDigits,
  maskCPF,
  maskRG,
  maskPhone,
  maskCEP,
  formatCurrencyBRL,
  parseCurrencyBRL
};
