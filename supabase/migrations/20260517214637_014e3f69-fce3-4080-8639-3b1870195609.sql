DELETE FROM public.medicament_pc_valide WHERE id IN (SELECT id FROM public._pc_audit_to_delete);
DROP TABLE public._pc_audit_to_delete;