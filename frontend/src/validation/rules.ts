const ITALIAN_REGISTRATION_PATTERN = /^(?:[A-Z]{2}[0-9]{6,8}|[0-9]{6,10})$/;
const ITALIAN_VAT_PATTERN = /^[0-9]{11}$/;
const ITALIAN_TAX_ID_PATTERN = /^(?:[A-Z0-9]{16}|[0-9]{11})$/;
const EMAIL_WITH_DOMAIN_SUFFIX_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$/;

function normalize(value?: string): string {
  return (value ?? "").trim().toUpperCase();
}

function isItaly(value?: string): boolean {
  const normalized = normalize(value);
  return normalized === "ITALY" || normalized === "ITALIA";
}

export function isItalianBusiness(country?: string, countryOfIncorporation?: string): boolean {
  return isItaly(country) || isItaly(countryOfIncorporation);
}

export function isItalianRegistrationNumberValid(value?: string): boolean {
  const normalized = normalize(value).replace(/-/g, "");
  return !!normalized && ITALIAN_REGISTRATION_PATTERN.test(normalized);
}

export function isItalianTaxIdValid(value?: string): boolean {
  const normalized = normalize(value).replace(/\s/g, "");
  return !!normalized && ITALIAN_TAX_ID_PATTERN.test(normalized);
}

export function isItalianVatNumberValid(value?: string): boolean {
  const normalized = normalize(value);
  return !!normalized && ITALIAN_VAT_PATTERN.test(normalized);
}

export function hasValidEmailDomainSuffix(value?: string): boolean {
  return EMAIL_WITH_DOMAIN_SUFFIX_PATTERN.test((value ?? "").trim());
}
