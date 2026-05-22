
ALTER TABLE public.leads
  ADD COLUMN poc_name text,
  ADD COLUMN contact_number text,
  ADD COLUMN status text NOT NULL DEFAULT 'new';
