export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  role: "SUPPLIER" | "ADMIN";
  adminGovernanceRole?: string;
  emailVerified: boolean;
}

export interface AdminUserInviteResponse {
  userId: string;
  email: string;
  adminRole: "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER";
  inviteExpiresAt: string;
  mailSent?: boolean;
  activationUrl?: string;
}

export interface OtpChallengeDispatchResponse {
  challengeId: string;
  expiresAt: string;
  status: string;
  deliveryMode: string;
  targetEmailMasked?: string;
  debugCode?: string;
}

export interface OtpChallengeVerifyResponse {
  challengeId: string;
  verified: boolean;
  status: string;
  attempts?: number;
  maxAttempts?: number;
  verifiedAt?: string;
}

export interface InviteTokenLookupResponse {
  id: string;
  status: "CREATED" | "SENT" | "OPENED" | "CONSUMED" | "EXPIRED" | "RENEWED" | "CANCELLED";
  registryType: "ALBO_A" | "ALBO_B";
  invitedName?: string;
  invitedEmail: string;
  expiresAt: string;
}

export interface AdminInviteResponse {
  id: string;
  token: string;
  status: "CREATED" | "SENT" | "OPENED" | "CONSUMED" | "EXPIRED" | "RENEWED" | "CANCELLED";
    registryType: "ALBO_A" | "ALBO_B";
    invitedEmail: string;
    invitedName?: string;
    expiresAt: string;
  mailSent?: boolean;
  inviteUrl?: string;
  mailFailureReason?: string;
}

export type AdminInviteUiStatus =
  | "COMPLETATO"
  | "IN_ATTESA"
  | "IN_COMPILAZIONE"
  | "SCADUTO"
  | "RIFIUTATO";

export interface AdminInviteMonitorRow {
  id: string;
  invitedName: string | null;
  invitedEmail: string;
  registryType: "ALBO_A" | "ALBO_B";
  inviteStatus: "CREATED" | "SENT" | "OPENED" | "CONSUMED" | "EXPIRED" | "RENEWED" | "CANCELLED";
  uiStatus: AdminInviteUiStatus;
  progressPercent: number;
  createdAt: string;
    expiresAt: string;
    invitedByName: string | null;
    note?: string | null;
    applicationId: string | null;
  profilePath: string | null;
  canRenew: boolean;
  canOpenProfile: boolean;
}

export interface AdminInviteMonitorResponse {
  totalInvites: number;
  completedInvites: number;
  pendingInvites: number;
  expiredInvites: number;
  rows: AdminInviteMonitorRow[];
}

export interface CategoryResponse {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  children?: CategoryResponse[];
}

export interface SupplierContactResponse {
  id: string;
  fullName: string;
  email?: string;
  contactType: string;
  jobTitle?: string;
  phone?: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface SupplierProfileResponse {
  id: string;
  userId: string;
  preferredLanguage?: "IT" | "EN";
  companyName?: string;
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
  country?: string;
  status: string;
  rejectionReason?: string;
  revisionNotes?: string;
  isCriticalEditPending?: boolean;
  reviewerName?: string;
  lastReviewedAt?: string;
  submittedAt?: string;
  isNew?: boolean;
  createdAt: string;
  updatedAt: string;
  contacts: SupplierContactResponse[];
  categories: Array<{ id: string; code: string; name: string }>;
}

export interface ReviewResponse {
  id: string;
  action: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  comment?: string;
  previousStatus: string;
  newStatus: string;
  reviewerName?: string;
  createdAt: string;
}

export interface DocumentResponse {
  id: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  isCurrent: boolean;
  expiryDate?: string;
  notes?: string;
  uploadedAt: string;
  uploadedByName?: string;
}

export interface SearchFieldOptionResponse {
  fieldKey: string;
  label: string;
  tableName: string;
  columnName: string;
  dataType: string;
  matchMode: string;
  exportable: boolean;
}

export interface SearchFieldGroupResponse {
  tableName: string;
  fields: SearchFieldOptionResponse[];
}

export interface SearchResultRowResponse {
  supplierId: string;
  status?: string;
  values: Record<string, string | null>;
}

export interface AdvancedSearchCriterion {
  fieldKey: string;
  value: string;
}
