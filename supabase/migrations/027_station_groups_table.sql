-- Station groups table for organizing stations
CREATE TABLE IF NOT EXISTS public.station_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

-- RLS
ALTER TABLE public.station_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own groups"
  ON public.station_groups
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
