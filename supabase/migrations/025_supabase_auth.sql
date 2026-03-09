-- Switch from PIN-based auth to proper Supabase Auth
-- Existing users get migrated transparently on first login

-- 1. Track which users have been verified via email
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- 2. Mark all existing users so we can show them a verification banner
-- (They were created with email_confirm:false, so email_confirmed_at IS NULL in auth.users)
-- The migrate-password API will auto-confirm them so they can sign in,
-- but email_verified stays false until they actually click a verification link.

-- 3. Trigger to auto-create public.users profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, phone, role, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    'user',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();
