-- Optional sample project after you have invited yourself as admin.
-- Replace YOUR_USER_UUID with auth.users.id from Authentication → Users.

-- insert into public.projects (
--   job_number, name, client, description, job_type, status,
--   scheduled_date, start_time, address, city, state, zip, lat, lng
-- ) values (
--   'GBC-26001',
--   'Harbor View Kitchen',
--   'Nguyen Residence',
--   'Full kitchen remodel',
--   'Kitchen Renovation',
--   'in_progress',
--   current_date,
--   '07:30',
--   '412 Harbor View Dr',
--   'San Pedro',
--   'CA',
--   '90731',
--   33.736,
--   -118.292
-- );

-- Then assign yourself:
-- insert into public.project_assignments (project_id, user_id, assignment_role)
-- values ('PROJECT_UUID', 'YOUR_USER_UUID', 'project_manager');

-- Set your role (if needed):
-- update public.profiles set app_role = 'admin', title = 'Owner' where id = 'YOUR_USER_UUID';
