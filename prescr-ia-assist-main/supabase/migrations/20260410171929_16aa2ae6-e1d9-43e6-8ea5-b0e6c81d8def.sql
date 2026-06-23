
-- Add status column to pharmacies
ALTER TABLE public.pharmacies 
ADD COLUMN status text NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'paused', 'disabled'));

-- Add index for status filtering
CREATE INDEX idx_pharmacies_status ON public.pharmacies(status);
