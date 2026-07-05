-- Allow pharmacists (authenticated users) to insert 'learned' PC↔EAN mappings
-- generated when they manually accept a PC right after scanning an unmatched
-- EAN. These rows land as pending and are reviewed by admins.
CREATE POLICY "Authenticated can insert learned pc_cip_mapping"
  ON public.pc_cip_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (source = 'learned_from_click' AND statut = 'pending');