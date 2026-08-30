ALTER TABLE public.medicament_curated_pcs
  ADD COLUMN IF NOT EXISTS vigilance text,
  ADD COLUMN IF NOT EXISTS phrase_vigilance text,
  ADD COLUMN IF NOT EXISTS pertinence_vigilance text DEFAULT 'Sécurité';

-- Curacne / isotrétinoïne
UPDATE public.medicament_curated_pcs c
SET pc_1 = 'Crème émolliente réparatrice',
    pertinence_pc1 = 'Effet secondaire',
    phrase_conseil_pc1 = 'Réhydrate la peau asséchée par le traitement.',
    pc_2 = 'Baume lèvres réparateur',
    pertinence_pc2 = 'Effet secondaire',
    phrase_conseil_pc2 = 'Prévient la chéilite, quasi constante sous isotrétinoïne.',
    vigilance = 'Contraception et test de grossesse mensuel',
    pertinence_vigilance = 'Sécurité',
    phrase_vigilance = 'Tératogène : test de grossesse mensuel et contraception obligatoires.'
FROM public.medicaments m
WHERE m.id = c.medicament_id AND m.nom_commercial ILIKE '%curacne%';

-- Bactrim / sulfaméthoxazole
UPDATE public.medicament_curated_pcs c
SET pc_1 = 'Probiotiques (flore intestinale)',
    pertinence_pc1 = 'Effet secondaire',
    phrase_conseil_pc1 = 'Restaure la flore intestinale perturbée par le traitement.',
    pc_2 = 'Protection solaire SPF50+',
    pertinence_pc2 = 'Effet secondaire',
    phrase_conseil_pc2 = 'Protège la peau, photosensibilisée par le sulfamide.',
    vigilance = 'Hydratation abondante',
    pertinence_vigilance = 'Sécurité',
    phrase_vigilance = 'Boire 1,5 à 2 L/j : le sulfaméthoxazole peut cristalliser dans les urines.'
FROM public.medicaments m
WHERE m.id = c.medicament_id AND m.nom_commercial ILIKE '%bactrim%';

-- Flagyl / métronidazole
UPDATE public.medicament_curated_pcs c
SET pc_1 = 'Probiotiques (flore intestinale)',
    pertinence_pc1 = 'Effet secondaire',
    phrase_conseil_pc1 = 'Restaure la flore intestinale perturbée par le traitement.',
    pc_2 = 'Bain de bouche antiseptique sans alcool',
    pertinence_pc2 = 'Prévention',
    phrase_conseil_pc2 = 'Complète le traitement des infections dentaires à anaérobies.',
    vigilance = 'Aucun alcool pendant et 3 jours après',
    pertinence_vigilance = 'Sécurité',
    phrase_vigilance = 'Métronidazole + alcool = réaction antabuse (bouffées, vomissements).'
FROM public.medicaments m
WHERE m.id = c.medicament_id AND m.nom_commercial ILIKE '%flagyl%';

-- Jardiance / empagliflozine
UPDATE public.medicament_curated_pcs c
SET pc_1 = 'Hygiène intime douce (pH physiologique)',
    pertinence_pc1 = 'Prévention',
    phrase_conseil_pc1 = 'Prévient les mycoses génitales favorisées par la glycosurie.',
    pc_2 = 'Bandelettes de cétonurie',
    pertinence_pc2 = 'Surveillance',
    phrase_conseil_pc2 = 'Détecte une acidocétose possible même à glycémie normale.',
    vigilance = 'Acidocétose à glycémie normale',
    pertinence_vigilance = 'Sécurité',
    phrase_vigilance = 'Nausées, souffle court : contrôler les cétones et consulter, même sans hyperglycémie.'
FROM public.medicaments m
WHERE m.id = c.medicament_id AND m.nom_commercial ILIKE '%jardiance%';

-- Durogesic / fentanyl transdermique
UPDATE public.medicament_curated_pcs c
SET pc_1 = 'Laxatif osmotique (macrogol)',
    pertinence_pc1 = 'Effet secondaire',
    phrase_conseil_pc1 = 'À débuter dès J1 : la constipation opioïde ne s''atténue jamais.',
    pc_2 = 'Antiémétique (métopimazine)',
    pertinence_pc2 = 'Effet secondaire',
    phrase_conseil_pc2 = 'Calme les nausées transitoires du début de traitement.',
    vigilance = 'Chaleur et élimination du patch',
    pertinence_vigilance = 'Sécurité',
    phrase_vigilance = 'Fièvre, bain chaud ou canicule augmentent la libération de fentanyl : risque de surdosage. Patch usagé plié et rapporté en pharmacie.'
FROM public.medicaments m
WHERE m.id = c.medicament_id AND m.nom_commercial ILIKE '%durogesic%';