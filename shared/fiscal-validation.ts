import type {
  FiscalCertificateMetadata,
  FiscalCustomer,
  FiscalIssuer,
  FiscalService,
  FiscalValidationIssue,
  FiscalValidationResult,
  NfseRequest,
} from "./fiscal.js";

const digits = (value: string) => value.replace(/\D/g, "");

function hasValidCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (let position = 9; position <= 10; position += 1) {
    let sum = 0;
    for (let index = 0; index < position; index += 1) {
      sum += Number(cpf[index]) * (position + 1 - index);
    }
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(cpf[position])) return false;
  }
  return true;
}

function hasValidCnpj(value: string) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calculate = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
}

export function isValidFiscalDocument(value: string) {
  const valueDigits = digits(value);
  return valueDigits.length === 11 ? hasValidCpf(value) : hasValidCnpj(value);
}

const add = (
  issues: FiscalValidationIssue[],
  section: FiscalValidationIssue["section"],
  field: string,
  code: string,
  message: string,
) => issues.push({ section, field, code, message });

export function validateIssuer(issuer: FiscalIssuer) {
  const issues: FiscalValidationIssue[] = [];
  if (!issuer.legalName.trim()) add(issues, "issuer", "issuer.legalName", "ISSUER_NAME_REQUIRED", "Informe a razão social ou o nome do prestador.");
  if (!isValidFiscalDocument(issuer.document)) add(issues, "issuer", "issuer.document", "ISSUER_DOCUMENT_INVALID", "Informe um CPF ou CNPJ válido do prestador.");
  if (!issuer.address.city.trim()) add(issues, "issuer", "issuer.address.city", "ISSUER_CITY_REQUIRED", "Informe o município do prestador.");
  if (!/^[A-Za-z]{2}$/.test(issuer.address.state.trim())) add(issues, "issuer", "issuer.address.state", "ISSUER_STATE_REQUIRED", "Informe a UF do prestador.");
  if (!issuer.taxRegime) add(issues, "issuer", "issuer.taxRegime", "ISSUER_TAX_REGIME_REQUIRED", "Informe o regime tributário.");
  return issues;
}

export function validateCustomer(customer: FiscalCustomer) {
  const issues: FiscalValidationIssue[] = [];
  if (!customer.name.trim()) add(issues, "customer", "customer.name", "CUSTOMER_NAME_REQUIRED", "Informe o nome ou a razão social do cliente.");
  if (!isValidFiscalDocument(customer.document)) add(issues, "customer", "customer.document", "CUSTOMER_DOCUMENT_INVALID", "Informe um CPF ou CNPJ válido do cliente.");
  if (!customer.address.city.trim()) add(issues, "customer", "customer.address.city", "CUSTOMER_CITY_REQUIRED", "Informe o município do cliente.");
  if (!/^[A-Za-z]{2}$/.test(customer.address.state.trim())) add(issues, "customer", "customer.address.state", "CUSTOMER_STATE_REQUIRED", "Informe a UF do cliente.");
  return issues;
}

export function validateService(service: FiscalService) {
  const issues: FiscalValidationIssue[] = [];
  if (!service.fiscalDescription.trim()) add(issues, "service", "service.fiscalDescription", "SERVICE_DESCRIPTION_REQUIRED", "Informe a descrição fiscal do serviço.");
  if (!service.serviceCode.trim()) add(issues, "service", "service.serviceCode", "SERVICE_CODE_REQUIRED", "Informe o código do serviço.");
  if (!service.incidenceCity.trim()) add(issues, "service", "service.incidenceCity", "SERVICE_CITY_REQUIRED", "Informe o município de incidência.");
  if (!Number.isFinite(service.tax.issRate) || service.tax.issRate < 0 || service.tax.issRate > 100) add(issues, "service", "service.tax.issRate", "SERVICE_RATE_INVALID", "Informe uma alíquota entre 0% e 100%.");
  return issues;
}

export function validateNfseRequest(
  request: NfseRequest,
  options: {
    certificate?: FiscalCertificateMetadata | null;
    requireCertificate?: boolean;
  } = {},
): FiscalValidationResult {
  const issues = [
    ...validateIssuer(request.issuer),
    ...validateCustomer(request.customer),
    ...validateService(request.service),
  ];
  if (!request.competenceDate || Number.isNaN(Date.parse(`${request.competenceDate}T12:00:00`))) {
    add(issues, "note", "competenceDate", "COMPETENCE_REQUIRED", "Informe uma data de competência válida.");
  }
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    add(issues, "note", "amount", "AMOUNT_INVALID", "Informe um valor maior que zero.");
  }
  if (!request.description.trim()) {
    add(issues, "note", "description", "DESCRIPTION_REQUIRED", "Informe a descrição do serviço prestado.");
  }
  const certificateExpired = options.certificate
    ? !Number.isFinite(Date.parse(options.certificate.expiresAt)) || Date.parse(options.certificate.expiresAt) <= Date.now()
    : true;
  if (options.requireCertificate && (options.certificate?.status !== "active" || certificateExpired)) {
    add(issues, "certificate", "certificate", "CERTIFICATE_REQUIRED", "Configure um certificado digital válido em ambiente seguro.");
  }
  return { valid: issues.length === 0, issues };
}
