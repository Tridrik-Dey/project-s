export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  email: string;
  password: string;
}

export interface SupplierProfileRequest {
  companyName: string;
  preferredLanguage?: "IT" | "EN";
  tradingName?: string;
  companyType?: string;
  registrationNumber?: string;
  vatNumber?: string;
  taxId?: string;
  countryOfIncorporation?: string;
  incorporationDate?: string;
  website?: string;
  description?: string;
  employeeCountRange?: string;
  annualRevenueRange?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country: string;
}

export interface SupplierContactRequest {
  fullName: string;
  email?: string;
  contactType: string;
  jobTitle?: string;
  phone?: string;
  isPrimary: boolean;
}
