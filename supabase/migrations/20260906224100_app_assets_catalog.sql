CREATE TABLE IF NOT EXISTS public.app_assets (
  name text PRIMARY KEY,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  content_type text,
  bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_assets TO anon, authenticated;
GRANT ALL ON public.app_assets TO service_role;
ALTER TABLE public.app_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read app_assets catalog" ON public.app_assets FOR SELECT TO public USING (true);
