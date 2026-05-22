GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_crm_user(
  _user_id uuid,
  _email text,
  _full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    _user_id,
    lower(_email),
    COALESCE(NULLIF(trim(_full_name), ''), split_part(_email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

  IF lower(_email) = 'admin@company.com' THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> 'admin';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'activity_head')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_crm_user(uuid, text, text) TO authenticated;