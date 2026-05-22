
CREATE TYPE public.app_role AS ENUM ('admin', 'activity_head', 'team_head');
CREATE TYPE public.pipeline_stage AS ENUM ('cold_call', 'brochure_sent', 'proposal_sent', 'costing_shared', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE public.deal_type AS ENUM ('barter', 'monetary', 'mix');
CREATE TYPE public.deal_size AS ENUM ('small', 'medium', 'large');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  activity_head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry_sector TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_name_unique_ci ON public.companies (lower(name));

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  poc_company_name TEXT,
  poc_company_contact TEXT,
  poc_team_name TEXT,
  what_sent TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  deal_type public.deal_type NOT NULL DEFAULT 'monetary',
  deal_size_estimate public.deal_size NOT NULL DEFAULT 'medium',
  industry_sector TEXT,
  lead_source TEXT,
  pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'cold_call',
  lost_reason TEXT,
  follow_up_count INT NOT NULL DEFAULT 0,
  latest_description TEXT,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_owner_idx ON public.leads (owner_id);
CREATE INDEX leads_ah_idx ON public.leads (activity_head_id);
CREATE INDEX leads_company_idx ON public.leads (company_id);

CREATE TABLE public.lead_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  update_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  what_sent_this_time TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lead_updates_lead_idx ON public.lead_updates (lead_id);

CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_datetime TIMESTAMPTZ NOT NULL,
  reminder_note TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reminders_owner_idx ON public.reminders (owner_id);

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (key, value) VALUES ('cold_lead_threshold_days', '7'::jsonb);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'activity_head') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles read all authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "companies read all authed" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies insert by authed" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin manages companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "leads read all authed" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads insert by self" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "leads update by scope" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid() OR activity_head_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid() OR activity_head_id = auth.uid());
-- Only the lead owner can delete their lead. Admin cannot delete leads of activity-head accounts.
CREATE POLICY "leads delete by owner only" ON public.leads FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "lead_updates read scoped" ON public.lead_updates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR updated_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_updates.lead_id
               AND (l.owner_id = auth.uid() OR l.activity_head_id = auth.uid()))
  );
CREATE POLICY "lead_updates insert by scope" ON public.lead_updates FOR INSERT TO authenticated
  WITH CHECK (
    updated_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_updates.lead_id
                 AND (l.owner_id = auth.uid() OR l.activity_head_id = auth.uid()))
    )
  );

CREATE POLICY "reminders read own or admin" ON public.reminders FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reminders insert own" ON public.reminders FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "reminders update own" ON public.reminders FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "reminders delete own" ON public.reminders FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "settings read all" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
