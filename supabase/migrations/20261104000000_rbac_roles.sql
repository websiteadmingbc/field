-- Expand app roles to match Construction Roles & Permissions guide.
-- Existing values kept: admin, project_manager, site_supervisor, crew
-- Note: new enum values must commit before they can be referenced in policies/functions.

alter type public.app_role add value if not exists 'general_manager';
alter type public.app_role add value if not exists 'operations_manager';
alter type public.app_role add value if not exists 'estimator';
alter type public.app_role add value if not exists 'office_manager';
alter type public.app_role add value if not exists 'bookkeeper';
alter type public.app_role add value if not exists 'project_coordinator';
alter type public.app_role add value if not exists 'project_engineer';
alter type public.app_role add value if not exists 'safety_officer';
alter type public.app_role add value if not exists 'crew_lead';
alter type public.app_role add value if not exists 'tradesperson';
alter type public.app_role add value if not exists 'equipment_operator';
alter type public.app_role add value if not exists 'laborer';
alter type public.app_role add value if not exists 'apprentice';
alter type public.app_role add value if not exists 'subcontractor';
alter type public.app_role add value if not exists 'client';
