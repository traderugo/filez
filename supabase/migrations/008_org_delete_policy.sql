-- Allow org owners to delete their own organizations
CREATE POLICY "org_owner_delete" ON public.organizations
  FOR DELETE USING (owner_id = auth.uid());
