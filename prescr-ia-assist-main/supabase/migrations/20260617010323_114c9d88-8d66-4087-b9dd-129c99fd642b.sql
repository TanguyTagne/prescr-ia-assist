ALTER TABLE public.medicament_curated_pcs
  ADD COLUMN IF NOT EXISTS pertinence_pc1 text,
  ADD COLUMN IF NOT EXISTS pertinence_pc2 text;