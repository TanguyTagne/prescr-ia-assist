-- 1. Add new role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'group_manager';

-- 2. Groupements table
CREATE TABLE IF NOT EXISTS public.groupements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  headquarters_city TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groupements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage groupements"
ON public.groupements
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read groupements"
ON public.groupements
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service can manage groupements"
ON public.groupements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Add groupement_id on pharmacies
ALTER TABLE public.pharmacies
ADD COLUMN IF NOT EXISTS groupement_id UUID REFERENCES public.groupements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacies_groupement_id ON public.pharmacies(groupement_id);

-- 4. Add managed_groupement_id on profiles (for group manager users)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS managed_groupement_id UUID REFERENCES public.groupements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_managed_groupement_id ON public.profiles(managed_groupement_id);

-- 5. Helper function: get user's managed groupement
CREATE OR REPLACE FUNCTION public.get_user_managed_groupement(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT managed_groupement_id FROM public.profiles WHERE id = _user_id;
$$;

-- 6. Group product mapping (centralized by HQ)
CREATE TABLE IF NOT EXISTS public.group_product_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  groupement_id UUID NOT NULL REFERENCES public.groupements(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL,
  produit_prioritaire TEXT NOT NULL,
  cip_code TEXT,
  laboratoire_partenaire TEXT,
  niveau_priorite INTEGER NOT NULL DEFAULT 90,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (groupement_id, categorie, produit_prioritaire)
);

ALTER TABLE public.group_product_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage group_product_mapping"
ON public.group_product_mapping
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Group managers can manage own mapping"
ON public.group_product_mapping
FOR ALL
TO authenticated
USING (groupement_id = get_user_managed_groupement(auth.uid()))
WITH CHECK (groupement_id = get_user_managed_groupement(auth.uid()));

CREATE POLICY "Pharmacies can read their groupement mapping"
ON public.group_product_mapping
FOR SELECT
TO authenticated
USING (
  groupement_id IN (
    SELECT p.groupement_id FROM public.pharmacies p
    JOIN public.profiles pr ON pr.pharmacy_id = p.id
    WHERE pr.id = auth.uid() AND p.groupement_id IS NOT NULL
  )
);

CREATE POLICY "Service can manage group_product_mapping"
ON public.group_product_mapping
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Group alerts
CREATE TABLE IF NOT EXISTS public.group_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  groupement_id UUID NOT NULL REFERENCES public.groupements(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_alerts_groupement ON public.group_alerts(groupement_id, created_at DESC);

ALTER TABLE public.group_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage group_alerts"
ON public.group_alerts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Group managers can read and update own alerts"
ON public.group_alerts
FOR SELECT
TO authenticated
USING (groupement_id = get_user_managed_groupement(auth.uid()));

CREATE POLICY "Group managers can update own alerts"
ON public.group_alerts
FOR UPDATE
TO authenticated
USING (groupement_id = get_user_managed_groupement(auth.uid()));

CREATE POLICY "Service can manage group_alerts"
ON public.group_alerts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_groupements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_groupements_updated_at ON public.groupements;
CREATE TRIGGER trg_groupements_updated_at
BEFORE UPDATE ON public.groupements
FOR EACH ROW EXECUTE FUNCTION public.set_groupements_updated_at();

DROP TRIGGER IF EXISTS trg_group_product_mapping_updated_at ON public.group_product_mapping;
CREATE TRIGGER trg_group_product_mapping_updated_at
BEFORE UPDATE ON public.group_product_mapping
FOR EACH ROW EXECUTE FUNCTION public.set_groupements_updated_at();