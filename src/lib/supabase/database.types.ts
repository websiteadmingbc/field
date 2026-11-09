import type { AppRole } from '../../types/auth'
import type { JobStatus, LogStatus, PhotoCategory } from '../../types'
import type {
  AssignmentStatus,
  CompanyRelationshipStatus,
  CompanyType,
  DocumentCategory,
  PersonnelClassification,
  PersonnelStatus,
  PreferredContactMethod,
  VerificationStatus,
} from '../../types/personnel'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          title: string | null
          phone: string | null
          email: string
          app_role: AppRole
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          title?: string | null
          phone?: string | null
          email: string
          app_role?: AppRole
          active?: boolean
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      projects: {
        Row: {
          id: string
          job_number: string
          name: string
          client: string
          description: string
          job_type: string
          status: JobStatus
          scheduled_date: string | null
          start_time: string
          address: string
          city: string
          state: string
          zip: string
          parking_instructions: string
          entrance_info: string
          access_instructions: string
          scope_of_work: string
          important_instructions: string
          required_materials: string
          safety_considerations: string
          site_notes: string
          lat: number | null
          lng: number | null
          checklist: Json
          materials: Json
          documents: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_number: string
          name: string
          client?: string
          description?: string
          job_type?: string
          status?: JobStatus
          scheduled_date?: string | null
          start_time?: string
          address?: string
          city?: string
          state?: string
          zip?: string
          parking_instructions?: string
          entrance_info?: string
          access_instructions?: string
          scope_of_work?: string
          important_instructions?: string
          required_materials?: string
          safety_considerations?: string
          site_notes?: string
          lat?: number | null
          lng?: number | null
          checklist?: Json
          materials?: Json
          documents?: Json
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      project_assignments: {
        Row: {
          project_id: string
          user_id: string
          assignment_role: string
          created_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          assignment_role?: string
        }
        Update: Partial<Database['public']['Tables']['project_assignments']['Insert']>
      }
      project_notices: {
        Row: {
          id: string
          project_id: string
          body: string
          author_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          body: string
          author_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['project_notices']['Insert']>
      }
      daily_logs: {
        Row: {
          id: string
          project_id: string
          author_id: string
          log_date: string
          work_completed: string
          materials_used: string
          issues: string
          notes_for_next: string
          status: LogStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          author_id: string
          log_date?: string
          work_completed?: string
          materials_used?: string
          issues?: string
          notes_for_next?: string
          status?: LogStatus
        }
        Update: Partial<Database['public']['Tables']['daily_logs']['Insert']>
      }
      photos: {
        Row: {
          id: string
          project_id: string
          author_id: string
          category: PhotoCategory
          caption: string
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          author_id: string
          category?: PhotoCategory
          caption?: string
          storage_path: string
        }
        Update: Partial<Database['public']['Tables']['photos']['Insert']>
      }
      activity: {
        Row: {
          id: string
          project_id: string
          author_id: string | null
          activity_type: string
          title: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          author_id?: string | null
          activity_type: string
          title: string
          body?: string
        }
        Update: Partial<Database['public']['Tables']['activity']['Insert']>
      }
      site_contacts: {
        Row: {
          id: string
          project_id: string
          full_name: string
          contact_role: string
          phone: string
          email: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          full_name: string
          contact_role?: string
          phone?: string
          email?: string | null
          is_primary?: boolean
        }
        Update: Partial<Database['public']['Tables']['site_contacts']['Insert']>
      }
      companies: {
        Row: {
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
        Insert: {
          id?: string
          name: string
          company_type?: CompanyType
          business_phone?: string
          business_email?: string
          trade_specialty?: string
          relationship_status?: CompanyRelationshipStatus
          archived_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      personnel: {
        Row: {
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
          website_category: 'leadership' | 'field' | 'office' | null
          website_published: boolean
          website_published_at: string | null
          website_published_by: string | null
          website_slug: string | null
          website_sort_order: number
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          personnel_code?: string
          first_name: string
          middle_name?: string
          last_name: string
          preferred_name?: string
          avatar_path?: string | null
          work_email?: string
          mobile_phone?: string
          work_phone?: string
          preferred_contact_method?: PreferredContactMethod | null
          business_address?: string
          city?: string
          state?: string
          zip?: string
          classification?: PersonnelClassification
          job_title?: string
          department?: string
          primary_role?: string
          additional_roles?: string[]
          reports_to?: string | null
          status?: PersonnelStatus
          start_date?: string | null
          end_date?: string | null
          work_arrangement?: string
          primary_work_location?: string
          service_territory?: string
          availability?: string
          linked_user_id?: string | null
          website_category?: 'leadership' | 'field' | 'office' | null
          website_published?: boolean
          website_published_at?: string | null
          website_published_by?: string | null
          website_slug?: string | null
          website_sort_order?: number
          archived_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['personnel']['Insert']>
      }
      personnel_company_affiliations: {
        Row: {
          id: string
          personnel_id: string
          company_id: string
          is_primary: boolean
          notes: string
          created_at: string
        }
        Insert: {
          id?: string
          personnel_id: string
          company_id: string
          is_primary?: boolean
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['personnel_company_affiliations']['Insert']>
      }
      personnel_sensitive: {
        Row: {
          personnel_id: string
          personal_email: string
          emergency_contact_name: string
          emergency_contact_relationship: string
          emergency_contact_phone: string
          internal_notes: string
          updated_at: string
        }
        Insert: {
          personnel_id: string
          personal_email?: string
          emergency_contact_name?: string
          emergency_contact_relationship?: string
          emergency_contact_phone?: string
          internal_notes?: string
        }
        Update: Partial<Database['public']['Tables']['personnel_sensitive']['Insert']>
      }
      personnel_skills: {
        Row: {
          id: string
          personnel_id: string
          primary_trade: string
          secondary_trades: string[]
          specialties: string[]
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          personnel_id: string
          primary_trade?: string
          secondary_trades?: string[]
          specialties?: string[]
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['personnel_skills']['Insert']>
      }
      personnel_certifications: {
        Row: {
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
        Insert: {
          id?: string
          personnel_id: string
          name: string
          issuer?: string
          certification_number?: string
          issue_date?: string | null
          expiration_date?: string | null
          verification_status?: VerificationStatus
          verification_date?: string | null
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['personnel_certifications']['Insert']>
      }
      personnel_project_assignments: {
        Row: {
          id: string
          personnel_id: string
          project_id: string
          assigned_role: string
          start_date: string | null
          end_date: string | null
          status: AssignmentStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          personnel_id: string
          project_id: string
          assigned_role?: string
          start_date?: string | null
          end_date?: string | null
          status?: AssignmentStatus
        }
        Update: Partial<Database['public']['Tables']['personnel_project_assignments']['Insert']>
      }
      licenses: {
        Row: {
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
        Insert: {
          id?: string
          personnel_id?: string | null
          company_id?: string | null
          license_type: string
          license_number?: string
          issuing_authority?: string
          license_classification?: string
          issue_date?: string | null
          expiration_date?: string | null
          verification_date?: string | null
          verification_status?: VerificationStatus
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['licenses']['Insert']>
      }
      insurance_policies: {
        Row: {
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
        Insert: {
          id?: string
          personnel_id?: string | null
          company_id?: string | null
          insurance_type: string
          provider?: string
          policy_reference?: string
          coverage_expiration?: string | null
          workers_comp_status?: string
          verification_status?: VerificationStatus
          verification_date?: string | null
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['insurance_policies']['Insert']>
      }
      personnel_documents: {
        Row: {
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
        Insert: {
          id?: string
          personnel_id?: string | null
          company_id?: string | null
          document_name: string
          category?: DocumentCategory
          storage_path: string
          uploaded_by?: string | null
          upload_date?: string
          issue_date?: string | null
          expiration_date?: string | null
          verification_status?: VerificationStatus
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['personnel_documents']['Insert']>
      }
      personnel_activity_log: {
        Row: {
          id: string
          personnel_id: string | null
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          personnel_id?: string | null
          actor_id?: string | null
          action: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['personnel_activity_log']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      app_role: AppRole
      job_status: JobStatus
      log_status: LogStatus
      photo_category: PhotoCategory
      personnel_classification: PersonnelClassification
      personnel_status: PersonnelStatus
      verification_status: VerificationStatus
      document_category: DocumentCategory
    }
  }
}

export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
