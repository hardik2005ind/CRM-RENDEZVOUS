ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS secondary_contact_number text,
  ADD COLUMN IF NOT EXISTS email text;