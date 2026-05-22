DROP POLICY IF EXISTS "leads read admin or owner" ON public.leads;
CREATE POLICY "leads read admin or owner"
ON public.leads
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

DROP POLICY IF EXISTS "lead_updates read scoped" ON public.lead_updates;
CREATE POLICY "lead_updates read scoped"
ON public.lead_updates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_updates.lead_id
      AND (
        l.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
      )
  )
);

DROP POLICY IF EXISTS "admin manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP FUNCTION IF EXISTS public.ensure_crm_user(uuid, text, text);
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;