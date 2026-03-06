-- Link subscriptions to stations (one subscription per station)
-- Any user can be a station manager (no admin role needed)

-- 1. Add org_id to subscriptions (which station this subscription is for)
ALTER TABLE public.subscriptions
  ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_subscriptions_org_id ON public.subscriptions(org_id);

-- 2. Users can read subscriptions for stations they own
CREATE POLICY "manager_select_station_subs" ON public.subscriptions
  FOR SELECT USING (
    org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

-- 3. Users can insert subscriptions for stations they own
CREATE POLICY "manager_insert_station_subs" ON public.subscriptions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );
