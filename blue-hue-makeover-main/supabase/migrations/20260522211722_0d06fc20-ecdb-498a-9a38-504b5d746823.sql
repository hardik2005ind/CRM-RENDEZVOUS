CREATE TABLE public.lead_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX idx_lead_comments_lead_id ON public.lead_comments(lead_id);

ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;

-- Lead owner or admin can read
CREATE POLICY "lead_comments read scoped"
ON public.lead_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_comments.lead_id
      AND (l.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Only admins can insert comments
CREATE POLICY "lead_comments insert admin"
ON public.lead_comments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());

-- Lead owner can update (to mark read); admins can update too
CREATE POLICY "lead_comments update owner or admin"
ON public.lead_comments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_comments.lead_id
      AND (l.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Admin can delete
CREATE POLICY "lead_comments delete admin"
ON public.lead_comments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));