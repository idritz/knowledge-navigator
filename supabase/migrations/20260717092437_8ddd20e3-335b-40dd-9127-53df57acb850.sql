
-- Enum for document types
CREATE TYPE public.document_type AS ENUM (
  'drivers_license',
  'vehicle_particulars',
  'facility_photo',
  'address_proof'
);

-- Rejection reason columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.storage_facilities ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Verification documents table
CREATE TABLE public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.storage_facilities(id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

-- Admin check function (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _uid AND role = 'admin'
  )
$$;

-- Verification documents policies
CREATE POLICY "Users manage own documents"
  ON public.verification_documents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all documents"
  ON public.verification_documents FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin policies on existing tables
CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update profile verification"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins view all facilities"
  ON public.storage_facilities FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update facilities"
  ON public.storage_facilities FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins view all vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update vehicles"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins view all bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage: verification-docs bucket. Path convention: <user_id>/...
CREATE POLICY "Users read own verification files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own verification files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own verification files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own verification files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins read all verification files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND public.is_admin(auth.uid())
  );
