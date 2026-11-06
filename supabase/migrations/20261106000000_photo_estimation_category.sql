-- Add estimation as a first-class photo tag (alongside before/progress/after/issue)
alter type public.photo_category add value if not exists 'estimation';
