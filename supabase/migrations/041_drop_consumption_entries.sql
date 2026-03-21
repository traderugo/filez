DROP TABLE IF EXISTS public.consumption_entries;

UPDATE public.org_invites SET visible_pages = visible_pages - 'consumption' WHERE visible_pages ? 'consumption';
