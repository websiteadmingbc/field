import type { AppRole } from '../../types/auth'
import type { JobStatus, LogStatus, PhotoCategory } from '../../types'

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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      app_role: AppRole
      job_status: JobStatus
      log_status: LogStatus
      photo_category: PhotoCategory
    }
  }
}

export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
