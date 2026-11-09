export type PersonnelClassification =
  | 'employee'
  | 'independent_contractor'
  | 'subcontractor'
  | 'project_manager'
  | 'sales_representative'
  | 'administrator'
  | 'consultant'
  | 'vendor_contact'
  | 'other'

export type PersonnelStatus =
  | 'active'
  | 'inactive'
  | 'on_leave'
  | 'pending_onboarding'
  | 'suspended'
  | 'archived'

export type CompanyType =
  | 'internal'
  | 'subcontractor'
  | 'vendor'
  | 'client'
  | 'partner'
  | 'other'

export type CompanyRelationshipStatus = 'active' | 'inactive' | 'pending' | 'archived'

export type PreferredContactMethod =
  | 'mobile'
  | 'work_phone'
  | 'work_email'
  | 'personal_email'
  | 'text'

/** Public website crew filter — matches greatbrittongc.com data-dept values */
export type WebsitePersonnelCategory = 'leadership' | 'field' | 'office'

export type VerificationStatus =
  | 'verified'
  | 'pending_verification'
  | 'expiring_soon'
  | 'expired'
  | 'missing_information'
  | 'not_applicable'

export type AssignmentStatus = 'active' | 'completed' | 'planned' | 'removed'

export type DocumentCategory =
  | 'employment_agreement'
  | 'independent_contractor_agreement'
  | 'subcontractor_agreement'
  | 'w9'
  | 'license'
  | 'insurance_certificate'
  | 'certification'
  | 'safety_training'
  | 'onboarding_document'
  | 'other'

export const PERSONNEL_CLASSIFICATIONS: PersonnelClassification[] = [
  'employee',
  'independent_contractor',
  'subcontractor',
  'project_manager',
  'sales_representative',
  'administrator',
  'consultant',
  'vendor_contact',
  'other',
]

export const PERSONNEL_STATUSES: PersonnelStatus[] = [
  'active',
  'inactive',
  'on_leave',
  'pending_onboarding',
  'suspended',
  'archived',
]

export const COMPANY_TYPES: CompanyType[] = [
  'internal',
  'subcontractor',
  'vendor',
  'client',
  'partner',
  'other',
]

export const PREFERRED_CONTACT_METHODS: PreferredContactMethod[] = [
  'mobile',
  'work_phone',
  'work_email',
  'personal_email',
  'text',
]

export const WEBSITE_PERSONNEL_CATEGORIES: WebsitePersonnelCategory[] = [
  'leadership',
  'field',
  'office',
]

/** Display-only job titles — combobox (pick standard or type custom). */
export const JOB_TITLE_OPTIONS = [
  'Laborer',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Foreman',
  'Superintendent',
  'Project Manager',
  'Estimator',
  'Equipment Operator',
  'Apprentice',
  'Office/Admin',
] as const

/**
 * Primary role drives assignment / scheduling / filters — strict dropdown values.
 * Stored as these labels on personnel.primary_role.
 */
export const PRIMARY_ROLE_OPTIONS = [
  'Laborer',
  'Tradesperson',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Equipment Operator',
  'Apprentice',
  'Foreman / Crew Lead',
  'Superintendent / Site Supervisor',
  'Project Manager',
  'Project Coordinator',
  'Estimator',
  'Safety Officer',
  'Operations Manager',
  'Office / Admin',
  'General Manager',
] as const

/** Additional roles chip multi-select options (can also add custom via the control). */
export const ADDITIONAL_ROLE_OPTIONS = Array.from(
  new Set([
    ...PRIMARY_ROLE_OPTIONS,
    ...JOB_TITLE_OPTIONS,
    'Bookkeeper',
    'Sales Representative',
    'Subcontractor Contact',
  ]),
)

export const WORK_ARRANGEMENT_OPTIONS = [
  'Full-time',
  'Part-time',
  'Contract',
  'Seasonal',
  'Temporary',
] as const

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  'verified',
  'pending_verification',
  'expiring_soon',
  'expired',
  'missing_information',
  'not_applicable',
]

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'employment_agreement',
  'independent_contractor_agreement',
  'subcontractor_agreement',
  'w9',
  'license',
  'insurance_certificate',
  'certification',
  'safety_training',
  'onboarding_document',
  'other',
]

export const CLASSIFICATION_LABELS: Record<PersonnelClassification, string> = {
  employee: 'Employee (W-2)',
  independent_contractor: 'Independent Contractor (1099)',
  subcontractor: 'Subcontractor',
  project_manager: 'Project Manager',
  sales_representative: 'Sales Representative',
  administrator: 'Administrator',
  consultant: 'Consultant',
  vendor_contact: 'Vendor Contact',
  other: 'Other',
}

export const STATUS_LABELS: Record<PersonnelStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On Leave',
  pending_onboarding: 'Pending Onboarding',
  suspended: 'Suspended',
  archived: 'Archived',
}

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  internal: 'Internal',
  subcontractor: 'Subcontractor',
  vendor: 'Vendor',
  client: 'Client',
  partner: 'Partner',
  other: 'Other',
}

export const CONTACT_METHOD_LABELS: Record<PreferredContactMethod, string> = {
  mobile: 'Mobile',
  work_phone: 'Work phone',
  work_email: 'Work email',
  personal_email: 'Personal email',
  text: 'Text',
}

export const WEBSITE_CATEGORY_LABELS: Record<WebsitePersonnelCategory, string> = {
  leadership: 'Leadership',
  field: 'Field Crew',
  office: 'Office',
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified',
  pending_verification: 'Pending Verification',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  missing_information: 'Missing Information',
  not_applicable: 'Not Applicable',
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  employment_agreement: 'Employment Agreement',
  independent_contractor_agreement: 'Independent Contractor Agreement',
  subcontractor_agreement: 'Subcontractor Agreement',
  w9: 'W-9',
  license: 'License',
  insurance_certificate: 'Insurance Certificate',
  certification: 'Certification',
  safety_training: 'Safety Training',
  onboarding_document: 'Onboarding Document',
  other: 'Other',
}

export interface Company {
  id: string
  name: string
  company_type: CompanyType
  business_phone: string
  business_email: string
  trade_specialty: string
  relationship_status: CompanyRelationshipStatus
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface Personnel {
  id: string
  personnel_code: string
  first_name: string
  middle_name: string
  last_name: string
  preferred_name: string
  avatar_path: string | null
  work_email: string
  mobile_phone: string
  work_phone: string
  preferred_contact_method: PreferredContactMethod | null
  business_address: string
  city: string
  state: string
  zip: string
  classification: PersonnelClassification
  job_title: string
  department: string
  primary_role: string
  additional_roles: string[]
  reports_to: string | null
  status: PersonnelStatus
  start_date: string | null
  end_date: string | null
  work_arrangement: string
  primary_work_location: string
  service_territory: string
  availability: string
  linked_user_id: string | null
  website_category: WebsitePersonnelCategory | null
  website_published: boolean
  website_published_at: string | null
  website_published_by: string | null
  website_slug: string | null
  website_sort_order: number
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface PersonnelSensitive {
  personnel_id: string
  personal_email: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
  internal_notes: string
  updated_at: string
}

export interface PersonnelAffiliation {
  id: string
  personnel_id: string
  company_id: string
  is_primary: boolean
  notes: string
  created_at: string
  company?: Company
}

export interface PersonnelSkill {
  id: string
  personnel_id: string
  primary_trade: string
  secondary_trades: string[]
  specialties: string[]
  notes: string
  created_at: string
  updated_at: string
}

export interface PersonnelCertification {
  id: string
  personnel_id: string
  name: string
  issuer: string
  certification_number: string
  issue_date: string | null
  expiration_date: string | null
  verification_status: VerificationStatus
  verification_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface PersonnelProjectAssignment {
  id: string
  personnel_id: string
  project_id: string
  assigned_role: string
  start_date: string | null
  end_date: string | null
  status: AssignmentStatus
  created_at: string
  updated_at: string
  project?: {
    id: string
    name: string
    job_number: string
    address: string
    city: string
    state: string
  }
}

export interface License {
  id: string
  personnel_id: string | null
  company_id: string | null
  license_type: string
  license_number: string
  issuing_authority: string
  license_classification: string
  issue_date: string | null
  expiration_date: string | null
  verification_date: string | null
  verification_status: VerificationStatus
  notes: string
  created_at: string
  updated_at: string
}

export interface InsurancePolicy {
  id: string
  personnel_id: string | null
  company_id: string | null
  insurance_type: string
  provider: string
  policy_reference: string
  coverage_expiration: string | null
  workers_comp_status: string
  verification_status: VerificationStatus
  verification_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface PersonnelDocument {
  id: string
  personnel_id: string | null
  company_id: string | null
  document_name: string
  category: DocumentCategory
  storage_path: string
  uploaded_by: string | null
  upload_date: string
  issue_date: string | null
  expiration_date: string | null
  verification_status: VerificationStatus
  notes: string
  created_at: string
  updated_at: string
}

export interface PersonnelActivity {
  id: string
  personnel_id: string | null
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type PersonnelListItem = Personnel & {
  primary_company?: Company | null
  display_name: string
}

export function personnelDisplayName(p: Pick<Personnel, 'first_name' | 'last_name' | 'preferred_name' | 'middle_name'>): string {
  if (p.preferred_name.trim()) {
    return `${p.preferred_name.trim()} ${p.last_name}`.trim()
  }
  const middle = p.middle_name.trim() ? ` ${p.middle_name.trim()}` : ''
  return `${p.first_name}${middle} ${p.last_name}`.trim()
}

export function statusToneClass(status: PersonnelStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-soft text-emerald'
    case 'inactive':
    case 'archived':
      return 'bg-surface-raised text-ink-muted'
    case 'on_leave':
    case 'pending_onboarding':
      return 'bg-amber-soft text-amber'
    case 'suspended':
      return 'bg-rose-soft text-rose'
    default:
      return 'bg-surface-raised text-ink-muted'
  }
}

export type PersonnelInput = {
  first_name: string
  middle_name: string
  last_name: string
  preferred_name: string
  work_email: string
  mobile_phone: string
  work_phone: string
  preferred_contact_method: PreferredContactMethod | null
  business_address: string
  city: string
  state: string
  zip: string
  classification: PersonnelClassification
  job_title: string
  department: string
  primary_role: string
  additional_roles: string[]
  reports_to: string | null
  status: PersonnelStatus
  start_date: string | null
  end_date: string | null
  work_arrangement: string
  primary_work_location: string
  service_territory: string
  availability: string
  company_id: string | null
  website_category: WebsitePersonnelCategory | null
  website_slug: string
  website_sort_order: number
}

export type SensitiveInput = {
  personal_email: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
  internal_notes: string
}

export function emptyPersonnelInput(): PersonnelInput {
  return {
    first_name: '',
    middle_name: '',
    last_name: '',
    preferred_name: '',
    work_email: '',
    mobile_phone: '',
    work_phone: '',
    preferred_contact_method: 'mobile',
    business_address: '',
    city: '',
    state: 'CA',
    zip: '',
    classification: 'employee',
    job_title: '',
    department: '',
    primary_role: '',
    additional_roles: [],
    reports_to: null,
    status: 'active',
    start_date: null,
    end_date: null,
    work_arrangement: '',
    primary_work_location: '',
    service_territory: '',
    availability: '',
    company_id: null,
    website_category: null,
    website_slug: '',
    website_sort_order: 0,
  }
}

export function emptySensitiveInput(): SensitiveInput {
  return {
    personal_email: '',
    emergency_contact_name: '',
    emergency_contact_relationship: '',
    emergency_contact_phone: '',
    internal_notes: '',
  }
}

export function personnelToInput(
  p: Personnel,
  companyId: string | null = null,
): PersonnelInput {
  return {
    first_name: p.first_name,
    middle_name: p.middle_name,
    last_name: p.last_name,
    preferred_name: p.preferred_name,
    work_email: p.work_email,
    mobile_phone: p.mobile_phone,
    work_phone: p.work_phone,
    preferred_contact_method: p.preferred_contact_method,
    business_address: p.business_address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    classification: p.classification,
    job_title: p.job_title,
    department: p.department,
    primary_role: p.primary_role,
    additional_roles: p.additional_roles ?? [],
    reports_to: p.reports_to,
    status: p.status,
    start_date: p.start_date,
    end_date: p.end_date,
    work_arrangement: p.work_arrangement,
    primary_work_location: p.primary_work_location,
    service_territory: p.service_territory,
    availability: p.availability,
    company_id: companyId,
    website_category: p.website_category,
    website_slug: p.website_slug ?? '',
    website_sort_order: p.website_sort_order ?? 0,
  }
}
