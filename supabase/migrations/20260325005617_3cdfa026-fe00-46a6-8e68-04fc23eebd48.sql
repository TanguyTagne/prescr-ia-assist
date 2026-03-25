UPDATE public.produits_complementaires SET phrase_conseil = sub.phrase FROM (VALUES
('1fc6f25b-8549-45ed-8d45-126afe8a4e5a', 'Une crème solaire non comédogène prévient l''obstruction des pores, évitant l''aggravation des lésions acnéiques sous l''exposition solaire.'),
('f7743075-19dd-4254-aae6-154b85b47e92', 'L''acné est souvent liée à une production excessive de sébum et une inflammation cutanée, le zinc aide à réguler le sébum et calmer la peau.'),
('095a525f-50d8-49d5-9ecc-3417856fca4a', 'L''excès de sébum et l''obstruction des pores favorisent l''acné, un gel nettoyant purifiant régule le sébum et nettoie la peau en profondeur.')
) AS sub(id, phrase) WHERE produits_complementaires.id = sub.id::uuid;