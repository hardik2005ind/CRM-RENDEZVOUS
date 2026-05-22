REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_crm_user(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_crm_user(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;