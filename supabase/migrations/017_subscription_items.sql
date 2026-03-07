-- Subscription items table (which services a user selected)
-- Run in Supabase SQL Editor after 015 + 016

CREATE TABLE IF NOT EXISTS public.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_items_sub ON public.subscription_items(subscription_id);

ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription items
CREATE POLICY "sub_items_select_own" ON public.subscription_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_items.subscription_id AND s.user_id = auth.uid()
    )
  );

-- Service role handles inserts/deletes (bypasses RLS)
