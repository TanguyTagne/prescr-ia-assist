DELETE FROM public.medicament_pc_valide
WHERE pc_id NOT IN (SELECT id FROM public.produits_complementaires);

DELETE FROM public.medicament_pc_valide
WHERE medicament_id NOT IN (SELECT id FROM public.medicaments);

ALTER TABLE public.medicament_pc_valide
  ADD CONSTRAINT medicament_pc_valide_medicament_id_fkey
  FOREIGN KEY (medicament_id) REFERENCES public.medicaments(id) ON DELETE CASCADE;

ALTER TABLE public.medicament_pc_valide
  ADD CONSTRAINT medicament_pc_valide_pc_id_fkey
  FOREIGN KEY (pc_id) REFERENCES public.produits_complementaires(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';