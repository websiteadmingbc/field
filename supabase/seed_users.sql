-- Run AFTER users exist in Authentication → Users
-- AND after rbac_roles migrations have been applied.

update public.profiles p
set
  full_name = 'Paul Alcantar',
  title = 'General Manager',
  phone = '408-876-9483',
  app_role = 'general_manager',
  active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = 'paulalcantar@greatbrittongc.com';

update public.profiles p
set
  full_name = 'Eli Mohammadi',
  title = 'Operations Manager',
  phone = '510-432-8461',
  app_role = 'operations_manager',
  active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = 'eli@greatbrittongc.com';

update public.profiles p
set
  full_name = 'Dylan Simpson',
  title = 'Director of Growth',
  phone = '408-455-3800',
  app_role = 'admin',
  active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = 'dylansimpson@greatbrittongc.com';

select u.email, p.full_name, p.title, p.phone, p.app_role
from public.profiles p
join auth.users u on u.id = p.id
order by p.full_name;
