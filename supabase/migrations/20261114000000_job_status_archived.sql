-- Soft-archive jobs from Operations (All Jobs)
alter type public.job_status add value if not exists 'archived';
