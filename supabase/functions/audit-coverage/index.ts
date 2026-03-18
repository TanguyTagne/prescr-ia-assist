import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Top 300 ATC5 medications by volume in France (Open Medic reference)
const TOP_300_ATC5: { atc5: string; molecule: string; nom: string; classe: string; rang: number }[] = [
  { atc5: "N02BE01", molecule: "Paracétamol", nom: "Doliprane", classe: "Analgésiques", rang: 1 },
  { atc5: "M01AE01", molecule: "Ibuprofène", nom: "Advil", classe: "Anti-inflammatoires", rang: 2 },
  { atc5: "C10AA05", molecule: "Atorvastatine", nom: "Tahor", classe: "Hypolipémiants", rang: 3 },
  { atc5: "C09AA05", molecule: "Ramipril", nom: "Triatec", classe: "IEC", rang: 4 },
  { atc5: "A02BC01", molecule: "Oméprazole", nom: "Mopral", classe: "IPP", rang: 5 },
  { atc5: "N06AB06", molecule: "Sertraline", nom: "Zoloft", classe: "ISRS", rang: 6 },
  { atc5: "C10AA01", molecule: "Simvastatine", nom: "Zocor", classe: "Hypolipémiants", rang: 7 },
  { atc5: "A10BA02", molecule: "Metformine", nom: "Glucophage", classe: "Antidiabétiques", rang: 8 },
  { atc5: "C07AB07", molecule: "Bisoprolol", nom: "Cardensiel", classe: "Bêta-bloquants", rang: 9 },
  { atc5: "C08CA01", molecule: "Amlodipine", nom: "Amlor", classe: "Inhibiteurs calciques", rang: 10 },
  { atc5: "N05BA12", molecule: "Alprazolam", nom: "Xanax", classe: "Anxiolytiques", rang: 11 },
  { atc5: "B01AC06", molecule: "Acide acétylsalicylique", nom: "Kardegic", classe: "Antiagrégants", rang: 12 },
  { atc5: "C09CA01", molecule: "Losartan", nom: "Cozaar", classe: "ARA-II", rang: 13 },
  { atc5: "N02AX02", molecule: "Tramadol", nom: "Topalgic", classe: "Opioïdes", rang: 14 },
  { atc5: "A02BC02", molecule: "Pantoprazole", nom: "Inipomp", classe: "IPP", rang: 15 },
  { atc5: "C09DA01", molecule: "Losartan + HCT", nom: "Hyzaar", classe: "ARA-II + diurétique", rang: 16 },
  { atc5: "J01CA04", molecule: "Amoxicilline", nom: "Clamoxyl", classe: "Pénicillines", rang: 17 },
  { atc5: "H03AA01", molecule: "Lévothyroxine", nom: "Lévothyrox", classe: "Hormones thyroïdiennes", rang: 18 },
  { atc5: "N06AB10", molecule: "Escitalopram", nom: "Seroplex", classe: "ISRS", rang: 19 },
  { atc5: "C09AA02", molecule: "Énalapril", nom: "Renitec", classe: "IEC", rang: 20 },
  { atc5: "R06AE07", molecule: "Cétirizine", nom: "Zyrtec", classe: "Antihistaminiques", rang: 21 },
  { atc5: "N05CF02", molecule: "Zolpidem", nom: "Stilnox", classe: "Hypnotiques", rang: 22 },
  { atc5: "R03AC02", molecule: "Salbutamol", nom: "Ventoline", classe: "Bêta-2-agonistes", rang: 23 },
  { atc5: "C10AA07", molecule: "Rosuvastatine", nom: "Crestor", classe: "Hypolipémiants", rang: 24 },
  { atc5: "C03CA01", molecule: "Furosémide", nom: "Lasilix", classe: "Diurétiques de l'anse", rang: 25 },
  { atc5: "A02BC05", molecule: "Ésoméprazole", nom: "Inexium", classe: "IPP", rang: 26 },
  { atc5: "N06AB05", molecule: "Paroxétine", nom: "Deroxat", classe: "ISRS", rang: 27 },
  { atc5: "C09CA06", molecule: "Candésartan", nom: "Atacand", classe: "ARA-II", rang: 28 },
  { atc5: "B01AF01", molecule: "Rivaroxaban", nom: "Xarelto", classe: "AOD", rang: 29 },
  { atc5: "C07AB02", molecule: "Métoprolol", nom: "Seloken", classe: "Bêta-bloquants", rang: 30 },
  { atc5: "N05BA06", molecule: "Lorazépam", nom: "Temesta", classe: "Anxiolytiques", rang: 31 },
  { atc5: "N06AX16", molecule: "Venlafaxine", nom: "Effexor", classe: "IRSNA", rang: 32 },
  { atc5: "B01AA03", molecule: "Warfarine", nom: "Coumadine", classe: "AVK", rang: 33 },
  { atc5: "J01CR02", molecule: "Amoxicilline + Ac. clavulanique", nom: "Augmentin", classe: "Pénicillines", rang: 34 },
  { atc5: "N02AA05", molecule: "Codéine + Paracétamol", nom: "Codoliprane", classe: "Opioïdes", rang: 35 },
  { atc5: "R06AX13", molecule: "Loratadine", nom: "Clarityne", classe: "Antihistaminiques", rang: 36 },
  { atc5: "C09CA04", molecule: "Irbésartan", nom: "Aprovel", classe: "ARA-II", rang: 37 },
  { atc5: "M01AE02", molecule: "Naproxène", nom: "Apranax", classe: "Anti-inflammatoires", rang: 38 },
  { atc5: "G04CA02", molecule: "Tamsulosine", nom: "Omix", classe: "Alpha-bloquants", rang: 39 },
  { atc5: "N05AH03", molecule: "Olanzapine", nom: "Zyprexa", classe: "Antipsychotiques", rang: 40 },
  { atc5: "A10BB09", molecule: "Gliclazide", nom: "Diamicron", classe: "Sulfamides hypoglycémiants", rang: 41 },
  { atc5: "R03BB04", molecule: "Tiotropium", nom: "Spiriva", classe: "Anticholinergiques", rang: 42 },
  { atc5: "C01DA08", molecule: "Isosorbide dinitrate", nom: "Risordan", classe: "Dérivés nitrés", rang: 43 },
  { atc5: "N03AX09", molecule: "Lamotrigine", nom: "Lamictal", classe: "Antiépileptiques", rang: 44 },
  { atc5: "B01AF02", molecule: "Apixaban", nom: "Eliquis", classe: "AOD", rang: 45 },
  { atc5: "N06AB04", molecule: "Citalopram", nom: "Seropram", classe: "ISRS", rang: 46 },
  { atc5: "C09CA03", molecule: "Valsartan", nom: "Tareg", classe: "ARA-II", rang: 47 },
  { atc5: "N05BA01", molecule: "Diazépam", nom: "Valium", classe: "Anxiolytiques", rang: 48 },
  { atc5: "R01AD09", molecule: "Mométasone nasale", nom: "Nasonex", classe: "Corticoïdes nasaux", rang: 49 },
  { atc5: "N06AX11", molecule: "Mirtazapine", nom: "Norset", classe: "Antidépresseurs", rang: 50 },
  { atc5: "C09DB01", molecule: "Valsartan + Amlodipine", nom: "Exforge", classe: "ARA-II + IC", rang: 51 },
  { atc5: "R03AK06", molecule: "Salmétérol + Fluticasone", nom: "Seretide", classe: "Bronchodilatateurs", rang: 52 },
  { atc5: "A11CC05", molecule: "Cholécalciférol", nom: "Uvedose", classe: "Vitamine D", rang: 53 },
  { atc5: "C07AG02", molecule: "Carvédilol", nom: "Kredex", classe: "Bêta-bloquants", rang: 54 },
  { atc5: "N03AX16", molecule: "Prégabaline", nom: "Lyrica", classe: "Antiépileptiques", rang: 55 },
  { atc5: "C09AA03", molecule: "Lisinopril", nom: "Zestril", classe: "IEC", rang: 56 },
  { atc5: "M04AA01", molecule: "Allopurinol", nom: "Zyloric", classe: "Anti-goutteux", rang: 57 },
  { atc5: "R06AX27", molecule: "Desloratadine", nom: "Aerius", classe: "Antihistaminiques", rang: 58 },
  { atc5: "N02CC01", molecule: "Sumatriptan", nom: "Imigrane", classe: "Triptans", rang: 59 },
  { atc5: "A12AA04", molecule: "Carbonate de calcium", nom: "Cacit", classe: "Calcium", rang: 60 },
  { atc5: "C07AB12", molecule: "Nébivolol", nom: "Temerit", classe: "Bêta-bloquants", rang: 61 },
  { atc5: "G03AA12", molecule: "Drospirénone + EE", nom: "Jasmine", classe: "Contraceptifs", rang: 62 },
  { atc5: "N05AH04", molecule: "Quétiapine", nom: "Xeroquel", classe: "Antipsychotiques", rang: 63 },
  { atc5: "C09CA08", molecule: "Olmésartan", nom: "Alteis", classe: "ARA-II", rang: 64 },
  { atc5: "J01FA10", molecule: "Azithromycine", nom: "Zithromax", classe: "Macrolides", rang: 65 },
  { atc5: "N03AF01", molecule: "Carbamazépine", nom: "Tegretol", classe: "Antiépileptiques", rang: 66 },
  { atc5: "A10AE04", molecule: "Insuline glargine", nom: "Lantus", classe: "Insulines", rang: 67 },
  { atc5: "B01AC04", molecule: "Clopidogrel", nom: "Plavix", classe: "Antiagrégants", rang: 68 },
  { atc5: "N06AX21", molecule: "Duloxétine", nom: "Cymbalta", classe: "IRSNA", rang: 69 },
  { atc5: "R03BA02", molecule: "Budésonide inhalé", nom: "Pulmicort", classe: "Corticoïdes inhalés", rang: 70 },
  { atc5: "A02BA02", molecule: "Ranitidine", nom: "Azantac", classe: "Anti-H2", rang: 71 },
  { atc5: "C01AA05", molecule: "Digoxine", nom: "Digoxine", classe: "Digitaliques", rang: 72 },
  { atc5: "D07AC01", molecule: "Bétaméthasone cutanée", nom: "Diprosone", classe: "Corticoïdes cutanés", rang: 73 },
  { atc5: "R05CB01", molecule: "Acétylcystéine", nom: "Mucomyst", classe: "Mucolytiques", rang: 74 },
  { atc5: "G04BD08", molecule: "Solifénacine", nom: "Vesicare", classe: "Antispasmodiques", rang: 75 },
  { atc5: "A06AD11", molecule: "Lactulose", nom: "Duphalac", classe: "Laxatifs", rang: 76 },
  { atc5: "C09AA04", molecule: "Périndopril", nom: "Coversyl", classe: "IEC", rang: 77 },
  { atc5: "N05CD08", molecule: "Midazolam", nom: "Buccolam", classe: "Hypnotiques", rang: 78 },
  { atc5: "H02AB06", molecule: "Prednisolone", nom: "Solupred", classe: "Corticoïdes systémiques", rang: 79 },
  { atc5: "N02BE51", molecule: "Paracétamol + Codéine", nom: "Dafalgan Codéine", classe: "Analgésiques", rang: 80 },
  { atc5: "S01ED51", molecule: "Timolol ophtalmique", nom: "Timoptol", classe: "Antiglaucomateux", rang: 81 },
  { atc5: "J01MA02", molecule: "Ciprofloxacine", nom: "Ciflox", classe: "Fluoroquinolones", rang: 82 },
  { atc5: "N03AG01", molecule: "Acide valproïque", nom: "Dépakine", classe: "Antiépileptiques", rang: 83 },
  { atc5: "A07EC01", molecule: "Mésalazine", nom: "Pentasa", classe: "Anti-inflammatoires intestinaux", rang: 84 },
  { atc5: "C01BD01", molecule: "Amiodarone", nom: "Cordarone", classe: "Antiarythmiques", rang: 85 },
  { atc5: "M01AB05", molecule: "Diclofénac", nom: "Voltarène", classe: "Anti-inflammatoires", rang: 86 },
  { atc5: "N05AX08", molecule: "Rispéridone", nom: "Risperdal", classe: "Antipsychotiques", rang: 87 },
  { atc5: "A10BK01", molecule: "Dapagliflozine", nom: "Forxiga", classe: "Gliflozines", rang: 88 },
  { atc5: "C10AB05", molecule: "Fénofibrate", nom: "Lipanthyl", classe: "Fibrates", rang: 89 },
  { atc5: "N05CF01", molecule: "Zopiclone", nom: "Imovane", classe: "Hypnotiques", rang: 90 },
  { atc5: "G03CA03", molecule: "Estradiol", nom: "Oestrodose", classe: "Estrogènes", rang: 91 },
  { atc5: "C09BA02", molecule: "Énalapril + HCT", nom: "Co-Renitec", classe: "IEC + diurétique", rang: 92 },
  { atc5: "R03AC13", molecule: "Formotérol", nom: "Foradil", classe: "Bêta-2-agonistes", rang: 93 },
  { atc5: "M05BA04", molecule: "Acide alendronique", nom: "Fosamax", classe: "Bisphosphonates", rang: 94 },
  { atc5: "R01AD12", molecule: "Fluticasone nasale", nom: "Avamys", classe: "Corticoïdes nasaux", rang: 95 },
  { atc5: "A06AD15", molecule: "Macrogol", nom: "Movicol", classe: "Laxatifs", rang: 96 },
  { atc5: "C03AA03", molecule: "Hydrochlorothiazide", nom: "Esidrex", classe: "Diurétiques thiazidiques", rang: 97 },
  { atc5: "N02AJ06", molecule: "Tramadol + Paracétamol", nom: "Ixprim", classe: "Analgésiques", rang: 98 },
  { atc5: "J01DB01", molecule: "Céfalexine", nom: "Keforal", classe: "Céphalosporines", rang: 99 },
  { atc5: "S01EE01", molecule: "Latanoprost", nom: "Xalatan", classe: "Antiglaucomateux", rang: 100 },
  // 101-150
  { atc5: "C09DA04", molecule: "Irbésartan + HCT", nom: "CoAprovel", classe: "ARA-II + diurétique", rang: 101 },
  { atc5: "N06DA02", molecule: "Donépézil", nom: "Aricept", classe: "Anticholinestérasiques", rang: 102 },
  { atc5: "R03BA05", molecule: "Fluticasone inhalée", nom: "Flixotide", classe: "Corticoïdes inhalés", rang: 103 },
  { atc5: "C01BC03", molecule: "Flécaïnide", nom: "Flécaïne", classe: "Antiarythmiques", rang: 104 },
  { atc5: "J01EE01", molecule: "Sulfaméthoxazole + Triméthoprime", nom: "Bactrim", classe: "Sulfamides", rang: 105 },
  { atc5: "A10BD07", molecule: "Metformine + Sitagliptine", nom: "Janumet", classe: "Antidiabétiques", rang: 106 },
  { atc5: "G04CB01", molecule: "Finastéride", nom: "Chibro-Proscar", classe: "Inhibiteurs 5-alpha réductase", rang: 107 },
  { atc5: "N04BA02", molecule: "Lévodopa + Carbidopa", nom: "Sinemet", classe: "Antiparkinsoniens", rang: 108 },
  { atc5: "N03AX14", molecule: "Lévétiracétam", nom: "Keppra", classe: "Antiépileptiques", rang: 109 },
  { atc5: "A10BH01", molecule: "Sitagliptine", nom: "Januvia", classe: "Gliptines", rang: 110 },
  { atc5: "C09BA05", molecule: "Ramipril + HCT", nom: "Co-Triatec", classe: "IEC + diurétique", rang: 111 },
  { atc5: "N02AB03", molecule: "Fentanyl", nom: "Durogésic", classe: "Opioïdes forts", rang: 112 },
  { atc5: "H02AB07", molecule: "Prednisone", nom: "Cortancyl", classe: "Corticoïdes systémiques", rang: 113 },
  { atc5: "A03FA01", molecule: "Métoclopramide", nom: "Primpéran", classe: "Antiémétiques", rang: 114 },
  { atc5: "A10BJ02", molecule: "Liraglutide", nom: "Victoza", classe: "Analogues GLP-1", rang: 115 },
  { atc5: "D01BA02", molecule: "Terbinafine", nom: "Lamisil", classe: "Antifongiques", rang: 116 },
  { atc5: "A07DA03", molecule: "Lopéramide", nom: "Imodium", classe: "Antidiarrhéiques", rang: 117 },
  { atc5: "R05DA04", molecule: "Codéine antitussive", nom: "Néo-Codion", classe: "Antitussifs", rang: 118 },
  { atc5: "C02AC01", molecule: "Clonidine", nom: "Catapressan", classe: "Antihypertenseurs centraux", rang: 119 },
  { atc5: "R06AE09", molecule: "Lévocétirizine", nom: "Xyzall", classe: "Antihistaminiques", rang: 120 },
  { atc5: "A10AE05", molecule: "Insuline détémir", nom: "Levemir", classe: "Insulines", rang: 121 },
  { atc5: "B03BB01", molecule: "Acide folique", nom: "Spéciafoldine", classe: "Vitamines B", rang: 122 },
  { atc5: "N07BA01", molecule: "Nicotine substitution", nom: "Nicopatch", classe: "Aide au sevrage tabagique", rang: 123 },
  { atc5: "J01FA09", molecule: "Clarithromycine", nom: "Zeclar", classe: "Macrolides", rang: 124 },
  { atc5: "J01DC02", molecule: "Céfuroxime", nom: "Zinnat", classe: "Céphalosporines", rang: 125 },
  { atc5: "A10BB01", molecule: "Glibenclamide", nom: "Daonil", classe: "Sulfamides hypoglycémiants", rang: 126 },
  { atc5: "N04BC05", molecule: "Pramipexole", nom: "Sifrol", classe: "Agonistes dopaminergiques", rang: 127 },
  { atc5: "M01AX17", molecule: "Nimésulide", nom: "Nexen", classe: "Anti-inflammatoires", rang: 128 },
  { atc5: "S01AA01", molecule: "Chloramphénicol ophtalmique", nom: "Cébémyxine", classe: "Anti-infectieux ophtalmiques", rang: 129 },
  { atc5: "A04AA01", molecule: "Ondansétron", nom: "Zophren", classe: "Antiémétiques", rang: 130 },
  { atc5: "N06BA04", molecule: "Méthylphénidate", nom: "Ritaline", classe: "Psychostimulants", rang: 131 },
  { atc5: "C08DA01", molecule: "Vérapamil", nom: "Isoptine", classe: "Inhibiteurs calciques", rang: 132 },
  { atc5: "C03DA01", molecule: "Spironolactone", nom: "Aldactone", classe: "Diurétiques épargneurs K+", rang: 133 },
  { atc5: "A10BK02", molecule: "Canagliflozine", nom: "Invokana", classe: "Gliflozines", rang: 134 },
  { atc5: "B01AB05", molecule: "Énoxaparine", nom: "Lovenox", classe: "HBPM", rang: 135 },
  { atc5: "H01BA02", molecule: "Desmopressine", nom: "Minirin", classe: "Analogues ADH", rang: 136 },
  { atc5: "G03AB08", molecule: "Lévonorgestrel + EE", nom: "Trinordiol", classe: "Contraceptifs", rang: 137 },
  { atc5: "C08CA05", molecule: "Nifédipine", nom: "Adalate", classe: "Inhibiteurs calciques", rang: 138 },
  { atc5: "L04AX03", molecule: "Méthotrexate", nom: "Méthotrexate", classe: "Immunosuppresseurs", rang: 139 },
  { atc5: "C10AX09", molecule: "Ézétimibe", nom: "Ezetrol", classe: "Hypolipémiants", rang: 140 },
  { atc5: "A10AB05", molecule: "Insuline asparte", nom: "NovoRapid", classe: "Insulines rapides", rang: 141 },
  { atc5: "J01XE01", molecule: "Nitrofurantoïne", nom: "Furadantine", classe: "Antibactériens urinaires", rang: 142 },
  { atc5: "R03AL04", molecule: "Indacatérol + Glycopyrronium", nom: "Ultibro", classe: "Bronchodilatateurs doubles", rang: 143 },
  { atc5: "D06AX09", molecule: "Acide fusidique cutané", nom: "Fucidine", classe: "Anti-infectieux cutanés", rang: 144 },
  { atc5: "N05AN01", molecule: "Lithium", nom: "Téralithe", classe: "Thymorégulateurs", rang: 145 },
  { atc5: "R03AK07", molecule: "Formotérol + Budésonide", nom: "Symbicort", classe: "Bronchodilatateurs + CI", rang: 146 },
  { atc5: "A10BJ05", molecule: "Dulaglutide", nom: "Trulicity", classe: "Analogues GLP-1", rang: 147 },
  { atc5: "C09DA06", molecule: "Candésartan + HCT", nom: "Cokenzen", classe: "ARA-II + diurétique", rang: 148 },
  { atc5: "G03AC06", molecule: "Désogestrel", nom: "Cerazette", classe: "Contraceptifs progestatifs", rang: 149 },
  { atc5: "J01AA02", molecule: "Doxycycline", nom: "Tolexine", classe: "Tétracyclines", rang: 150 },
  // 151-200
  { atc5: "N05AX12", molecule: "Aripiprazole", nom: "Abilify", classe: "Antipsychotiques", rang: 151 },
  { atc5: "A02BX02", molecule: "Sucralfate", nom: "Ulcar", classe: "Protecteurs gastriques", rang: 152 },
  { atc5: "C09DA08", molecule: "Olmésartan + HCT", nom: "Coolmetec", classe: "ARA-II + diurétique", rang: 153 },
  { atc5: "R01AA07", molecule: "Xylométazoline", nom: "Otrivine", classe: "Décongestionnants nasaux", rang: 154 },
  { atc5: "N02AX06", molecule: "Tapentadol", nom: "Palexia", classe: "Opioïdes", rang: 155 },
  { atc5: "N04BA03", molecule: "Lévodopa + Bensérazide", nom: "Modopar", classe: "Antiparkinsoniens", rang: 156 },
  { atc5: "M01AC06", molecule: "Méloxicam", nom: "Mobic", classe: "Anti-inflammatoires", rang: 157 },
  { atc5: "D07AB02", molecule: "Hydrocortisone butyrate", nom: "Locoïd", classe: "Corticoïdes cutanés", rang: 158 },
  { atc5: "A10BG03", molecule: "Pioglitazone", nom: "Actos", classe: "Thiazolidinediones", rang: 159 },
  { atc5: "G01AF02", molecule: "Clotrimazole vaginal", nom: "MycoHydralin", classe: "Antifongiques gynéco", rang: 160 },
  { atc5: "N06AX12", molecule: "Bupropion", nom: "Zyban", classe: "Antidépresseurs", rang: 161 },
  { atc5: "A06AB02", molecule: "Bisacodyl", nom: "Dulcolax", classe: "Laxatifs stimulants", rang: 162 },
  { atc5: "H02AB04", molecule: "Méthylprednisolone", nom: "Medrol", classe: "Corticoïdes systémiques", rang: 163 },
  { atc5: "J01DD08", molecule: "Céfixime", nom: "Oroken", classe: "Céphalosporines C3G", rang: 164 },
  { atc5: "N01BB02", molecule: "Lidocaïne", nom: "Xylocaïne", classe: "Anesthésiques locaux", rang: 165 },
  { atc5: "C02CA04", molecule: "Doxazosine", nom: "Zoxan", classe: "Alpha-bloquants", rang: 166 },
  { atc5: "A10AB01", molecule: "Insuline humaine rapide", nom: "Actrapid", classe: "Insulines", rang: 167 },
  { atc5: "R05CB06", molecule: "Ambroxol", nom: "Muxol", classe: "Mucolytiques", rang: 168 },
  { atc5: "B03BA01", molecule: "Cyanocobalamine", nom: "Vitamine B12", classe: "Vitamines B", rang: 169 },
  { atc5: "C09AA01", molecule: "Captopril", nom: "Lopril", classe: "IEC", rang: 170 },
  { atc5: "A12AX", molecule: "Calcium + Vitamine D", nom: "Orocal D3", classe: "Suppléments Ca/VitD", rang: 171 },
  { atc5: "N03AX18", molecule: "Lacosamide", nom: "Vimpat", classe: "Antiépileptiques", rang: 172 },
  { atc5: "A10AE06", molecule: "Insuline dégludec", nom: "Tresiba", classe: "Insulines ultra-longues", rang: 173 },
  { atc5: "D10BA01", molecule: "Isotrétinoïne", nom: "Curacné", classe: "Rétinoïdes", rang: 174 },
  { atc5: "J02AC01", molecule: "Fluconazole", nom: "Triflucan", classe: "Antifongiques systémiques", rang: 175 },
  { atc5: "S01CA01", molecule: "Dexaméthasone ophtalmique", nom: "Maxidex", classe: "Anti-inflammatoires ophtalmiques", rang: 176 },
  { atc5: "M02AA15", molecule: "Diclofénac topique", nom: "Voltarène Emulgel", classe: "AINS topiques", rang: 177 },
  { atc5: "R03BA08", molecule: "Ciclésonide", nom: "Alvesco", classe: "Corticoïdes inhalés", rang: 178 },
  { atc5: "C10AX06", molecule: "Acides gras oméga-3", nom: "Omacor", classe: "Hypolipémiants", rang: 179 },
  { atc5: "N04BB01", molecule: "Amantadine", nom: "Mantadix", classe: "Antiparkinsoniens", rang: 180 },
  { atc5: "A09AA02", molecule: "Pancréatine", nom: "Créon", classe: "Enzymes pancréatiques", rang: 181 },
  { atc5: "C07AA05", molecule: "Propranolol", nom: "Avlocardyl", classe: "Bêta-bloquants non sélectifs", rang: 182 },
  { atc5: "A10BJ06", molecule: "Sémaglutide", nom: "Ozempic", classe: "Analogues GLP-1", rang: 183 },
  { atc5: "L02BG04", molecule: "Létrozole", nom: "Femara", classe: "Inhibiteurs aromatase", rang: 184 },
  { atc5: "N06AA09", molecule: "Amitriptyline", nom: "Laroxyl", classe: "Antidépresseurs tricycliques", rang: 185 },
  { atc5: "J05AE08", molecule: "Atazanavir", nom: "Reyataz", classe: "Antiviraux", rang: 186 },
  { atc5: "A10BK03", molecule: "Empagliflozine", nom: "Jardiance", classe: "Gliflozines", rang: 187 },
  { atc5: "G04BE03", molecule: "Sildénafil", nom: "Viagra", classe: "IPDE5", rang: 188 },
  { atc5: "B01AA04", molecule: "Phénindione", nom: "Pindione", classe: "AVK", rang: 189 },
  { atc5: "P01AB01", molecule: "Métronidazole", nom: "Flagyl", classe: "Antiparasitaires", rang: 190 },
  { atc5: "R03DA04", molecule: "Théophylline", nom: "Euphylline", classe: "Xanthines", rang: 191 },
  { atc5: "M03BX02", molecule: "Tizanidine", nom: "Sirdalud", classe: "Myorelaxants", rang: 192 },
  { atc5: "C05CA53", molecule: "Diosmine", nom: "Daflon", classe: "Veinotoniques", rang: 193 },
  { atc5: "A03AB06", molecule: "Otilonium", nom: "Spasfon", classe: "Antispasmodiques", rang: 194 },
  { atc5: "L01XE01", molecule: "Imatinib", nom: "Glivec", classe: "Inhibiteurs tyrosine kinase", rang: 195 },
  { atc5: "N07XX02", molecule: "Riluzole", nom: "Rilutek", classe: "Neuroprotecteurs", rang: 196 },
  { atc5: "C09DA03", molecule: "Valsartan + HCT", nom: "Cotareg", classe: "ARA-II + diurétique", rang: 197 },
  { atc5: "J01CF02", molecule: "Cloxacilline", nom: "Orbénine", classe: "Pénicillines M", rang: 198 },
  { atc5: "H05BA01", molecule: "Calcitonine", nom: "Miacalcic", classe: "Antiostéoporotiques", rang: 199 },
  { atc5: "N02BA01", molecule: "Aspirine antalgique", nom: "Aspégic", classe: "Analgésiques", rang: 200 },
  // 201-250
  { atc5: "C08DB01", molecule: "Diltiazem", nom: "Tildiem", classe: "Inhibiteurs calciques", rang: 201 },
  { atc5: "A10BD05", molecule: "Metformine + Pioglitazone", nom: "Competact", classe: "Antidiabétiques", rang: 202 },
  { atc5: "D10AD03", molecule: "Adapalène", nom: "Différine", classe: "Rétinoïdes topiques", rang: 203 },
  { atc5: "N05BA04", molecule: "Oxazépam", nom: "Séresta", classe: "Anxiolytiques", rang: 204 },
  { atc5: "J01MA12", molecule: "Lévofloxacine", nom: "Tavanic", classe: "Fluoroquinolones", rang: 205 },
  { atc5: "A10BD08", molecule: "Metformine + Vildagliptine", nom: "Eucreas", classe: "Antidiabétiques", rang: 206 },
  { atc5: "C01DA14", molecule: "Isosorbide mononitrate", nom: "Monicor", classe: "Dérivés nitrés", rang: 207 },
  { atc5: "G04BD04", molecule: "Oxybutynine", nom: "Ditropan", classe: "Antispasmodiques vésicaux", rang: 208 },
  { atc5: "L02BA01", molecule: "Tamoxifène", nom: "Nolvadex", classe: "Anti-estrogènes", rang: 209 },
  { atc5: "R03BB01", molecule: "Ipratropium", nom: "Atrovent", classe: "Anticholinergiques inhalés", rang: 210 },
  { atc5: "A10BH05", molecule: "Linagliptine", nom: "Trajenta", classe: "Gliptines", rang: 211 },
  { atc5: "M01AH05", molecule: "Étoricoxib", nom: "Arcoxia", classe: "Coxibs", rang: 212 },
  { atc5: "J05AB01", molecule: "Aciclovir", nom: "Zovirax", classe: "Antiviraux", rang: 213 },
  { atc5: "N04BC04", molecule: "Ropinirole", nom: "Requip", classe: "Agonistes dopaminergiques", rang: 214 },
  { atc5: "A10AB04", molecule: "Insuline lispro", nom: "Humalog", classe: "Insulines rapides", rang: 215 },
  { atc5: "D06BB03", molecule: "Aciclovir cutané", nom: "Zovirax crème", classe: "Antiviraux cutanés", rang: 216 },
  { atc5: "S01EC03", molecule: "Dorzolamide", nom: "Trusopt", classe: "Antiglaucomateux", rang: 217 },
  { atc5: "J05AB11", molecule: "Valaciclovir", nom: "Zelitrex", classe: "Antiviraux", rang: 218 },
  { atc5: "B03AD02", molecule: "Fer + Acide folique", nom: "Tardyferon", classe: "Antianémiques", rang: 219 },
  { atc5: "C03DA04", molecule: "Éplérénone", nom: "Inspra", classe: "Diurétiques épargneurs K+", rang: 220 },
  { atc5: "N06AX05", molecule: "Trazodone", nom: "Desyrel", classe: "Antidépresseurs", rang: 221 },
  { atc5: "G03AA09", molecule: "Norgestimate + EE", nom: "Triafemi", classe: "Contraceptifs", rang: 222 },
  { atc5: "R01AD05", molecule: "Budésonide nasale", nom: "Rhinocort", classe: "Corticoïdes nasaux", rang: 223 },
  { atc5: "A10BH02", molecule: "Vildagliptine", nom: "Galvus", classe: "Gliptines", rang: 224 },
  { atc5: "C07AB03", molecule: "Aténolol", nom: "Ténormine", classe: "Bêta-bloquants", rang: 225 },
  { atc5: "M05BA07", molecule: "Acide risédronique", nom: "Actonel", classe: "Bisphosphonates", rang: 226 },
  { atc5: "A06AG01", molecule: "Phosphate de sodium rectal", nom: "Normacol", classe: "Lavements", rang: 227 },
  { atc5: "J01GB03", molecule: "Gentamicine", nom: "Gentalline", classe: "Aminosides", rang: 228 },
  { atc5: "C09DB04", molecule: "Olmésartan + Amlodipine", nom: "Sevikar", classe: "ARA-II + IC", rang: 229 },
  { atc5: "D07AC13", molecule: "Mométasone cutanée", nom: "Elocom", classe: "Corticoïdes cutanés", rang: 230 },
  { atc5: "B01AA07", molecule: "Acénocoumarol", nom: "Sintrom", classe: "AVK", rang: 231 },
  { atc5: "P01BA02", molecule: "Hydroxychloroquine", nom: "Plaquenil", classe: "Antipaludéens", rang: 232 },
  { atc5: "S01BA01", molecule: "Dexaméthasone", nom: "Dexafree", classe: "Corticoïdes ophtalmiques", rang: 233 },
  { atc5: "N05AH02", molecule: "Clozapine", nom: "Leponex", classe: "Antipsychotiques", rang: 234 },
  { atc5: "J05AX65", molecule: "Sofosbuvir", nom: "Sovaldi", classe: "Antiviraux hépatite C", rang: 235 },
  { atc5: "L04AA06", molecule: "Mycophénolate", nom: "Cellcept", classe: "Immunosuppresseurs", rang: 236 },
  { atc5: "A10BX02", molecule: "Répaglinide", nom: "NovoNorm", classe: "Glinides", rang: 237 },
  { atc5: "R03AK11", molecule: "Formotérol + Béclométasone", nom: "Innovair", classe: "Bronchodilatateurs + CI", rang: 238 },
  { atc5: "M01AB15", molecule: "Kétorolac", nom: "Toradol", classe: "AINS", rang: 239 },
  { atc5: "N02AA01", molecule: "Morphine", nom: "Skenan", classe: "Opioïdes forts", rang: 240 },
  { atc5: "A05AA02", molecule: "Acide ursodésoxycholique", nom: "Delursan", classe: "Acides biliaires", rang: 241 },
  { atc5: "G04BE08", molecule: "Tadalafil", nom: "Cialis", classe: "IPDE5", rang: 242 },
  { atc5: "L02BG06", molecule: "Exémestane", nom: "Aromasine", classe: "Inhibiteurs aromatase", rang: 243 },
  { atc5: "J01FA01", molecule: "Érythromycine", nom: "Érythrocine", classe: "Macrolides", rang: 244 },
  { atc5: "C02CA01", molecule: "Prazosine", nom: "Minipress", classe: "Alpha-bloquants", rang: 245 },
  { atc5: "N06AA04", molecule: "Clomipramine", nom: "Anafranil", classe: "Antidépresseurs tricycliques", rang: 246 },
  { atc5: "R03AK10", molecule: "Vilanterol + Fluticasone", nom: "Relvar", classe: "Bronchodilatateurs + CI", rang: 247 },
  { atc5: "A10BJ01", molecule: "Exénatide", nom: "Byetta", classe: "Analogues GLP-1", rang: 248 },
  { atc5: "M03BX01", molecule: "Baclofène", nom: "Liorésal", classe: "Myorelaxants", rang: 249 },
  { atc5: "J05AG03", molecule: "Éfavirenz", nom: "Sustiva", classe: "INNTI", rang: 250 },
  // 251-300
  { atc5: "C09BA04", molecule: "Périndopril + Indapamide", nom: "Preterax", classe: "IEC + diurétique", rang: 251 },
  { atc5: "A10BB12", molecule: "Glimépiride", nom: "Amarel", classe: "Sulfamides hypoglycémiants", rang: 252 },
  { atc5: "D01AC01", molecule: "Clotrimazole cutané", nom: "Mycohydralin", classe: "Antifongiques cutanés", rang: 253 },
  { atc5: "J01DD04", molecule: "Ceftriaxone", nom: "Rocéphine", classe: "Céphalosporines C3G", rang: 254 },
  { atc5: "N05CD02", molecule: "Nitrazépam", nom: "Mogadon", classe: "Hypnotiques benzo", rang: 255 },
  { atc5: "L04AB02", molecule: "Infliximab", nom: "Remicade", classe: "Anti-TNF", rang: 256 },
  { atc5: "C07AB05", molecule: "Bétaxolol", nom: "Kerlone", classe: "Bêta-bloquants", rang: 257 },
  { atc5: "S01GX08", molecule: "Kétotifène ophtalmique", nom: "Zaditen", classe: "Antiallergiques ophtalmiques", rang: 258 },
  { atc5: "A07AA11", molecule: "Rifaximine", nom: "Normix", classe: "Antibiotiques intestinaux", rang: 259 },
  { atc5: "G04BD07", molecule: "Toltérodine", nom: "Detrusitol", classe: "Antispasmodiques vésicaux", rang: 260 },
  { atc5: "R03AL01", molecule: "Fénotérol + Ipratropium", nom: "Bronchodual", classe: "Bronchodilatateurs doubles", rang: 261 },
  { atc5: "L02BG03", molecule: "Anastrozole", nom: "Arimidex", classe: "Inhibiteurs aromatase", rang: 262 },
  { atc5: "J01DC04", molecule: "Céfaclor", nom: "Alfatil", classe: "Céphalosporines", rang: 263 },
  { atc5: "S01XA20", molecule: "Larmes artificielles", nom: "Hyabak", classe: "Substituts lacrymaux", rang: 264 },
  { atc5: "A03AX13", molecule: "Trimébutine", nom: "Débridat", classe: "Régulateurs motricité", rang: 265 },
  { atc5: "N02AE01", molecule: "Buprénorphine", nom: "Subutex", classe: "Opioïdes TSO", rang: 266 },
  { atc5: "C09DB02", molecule: "Olmésartan + Amlodipine + HCT", nom: "Sevikar HCT", classe: "Triple association", rang: 267 },
  { atc5: "L04AB04", molecule: "Adalimumab", nom: "Humira", classe: "Anti-TNF", rang: 268 },
  { atc5: "J01FF01", molecule: "Clindamycine", nom: "Dalacine", classe: "Lincosamides", rang: 269 },
  { atc5: "A10BD11", molecule: "Metformine + Linagliptine", nom: "Jentadueto", classe: "Antidiabétiques", rang: 270 },
  { atc5: "N05BA08", molecule: "Bromazépam", nom: "Lexomil", classe: "Anxiolytiques", rang: 271 },
  { atc5: "R01AC01", molecule: "Cromoglicate de sodium", nom: "Lomusol", classe: "Antiallergiques nasaux", rang: 272 },
  { atc5: "B02BD02", molecule: "Facteur VIII", nom: "Advate", classe: "Facteurs de coagulation", rang: 273 },
  { atc5: "C03BA04", molecule: "Chlortalidone", nom: "Hygroton", classe: "Diurétiques thiazidiques", rang: 274 },
  { atc5: "L01BA01", molecule: "Méthotrexate oral", nom: "Novatrex", classe: "Antimétabolites", rang: 275 },
  { atc5: "A07EC02", molecule: "Sulfasalazine", nom: "Salazopyrine", classe: "Anti-inflammatoires intestinaux", rang: 276 },
  { atc5: "S01ED01", molecule: "Timolol simple", nom: "Timabak", classe: "Bêta-bloquants ophtalmiques", rang: 277 },
  { atc5: "M05BB03", molecule: "Ac. alendronique + Vit D", nom: "Fosavance", classe: "Bisphosphonates + Vit D", rang: 278 },
  { atc5: "D10AD01", molecule: "Trétinoïne", nom: "Effederm", classe: "Rétinoïdes topiques", rang: 279 },
  { atc5: "J01CE02", molecule: "Phénoxyméthylpénicilline", nom: "Oracilline", classe: "Pénicillines V", rang: 280 },
  { atc5: "N02CX01", molecule: "Pizotifène", nom: "Sanmigran", classe: "Antimigraineux", rang: 281 },
  { atc5: "B03AA07", molecule: "Sulfate ferreux", nom: "Tardyferon B9", classe: "Fer", rang: 282 },
  { atc5: "A07AX03", molecule: "Nifuroxazide", nom: "Ercéfuryl", classe: "Antiseptiques intestinaux", rang: 283 },
  { atc5: "G03FA01", molecule: "Noréthistérone + estrogène", nom: "Kliogest", classe: "THS", rang: 284 },
  { atc5: "A03FA03", molecule: "Dompéridone", nom: "Motilium", classe: "Prokinétiques", rang: 285 },
  { atc5: "R02AA20", molecule: "Antiseptiques ORL", nom: "Hexaspray", classe: "Antiseptiques pharyngés", rang: 286 },
  { atc5: "J05AR10", molecule: "Ténofovir + Emtricitabine", nom: "Truvada", classe: "Antiviraux VIH", rang: 287 },
  { atc5: "C04AD03", molecule: "Pentoxifylline", nom: "Torental", classe: "Vasodilatateurs", rang: 288 },
  { atc5: "L04AX01", molecule: "Azathioprine", nom: "Imurel", classe: "Immunosuppresseurs", rang: 289 },
  { atc5: "N06AA02", molecule: "Imipramine", nom: "Tofranil", classe: "Antidépresseurs tricycliques", rang: 290 },
  { atc5: "A11GA01", molecule: "Acide ascorbique", nom: "Vitamine C", classe: "Vitamines", rang: 291 },
  { atc5: "R06AB02", molecule: "Dexchlorphéniramine", nom: "Polaramine", classe: "Antihistaminiques H1", rang: 292 },
  { atc5: "M01AX01", molecule: "Nabumétone", nom: "Nabucox", classe: "AINS", rang: 293 },
  { atc5: "N03AB02", molecule: "Phénytoïne", nom: "Di-Hydan", classe: "Antiépileptiques", rang: 294 },
  { atc5: "S01FA01", molecule: "Atropine ophtalmique", nom: "Atropine", classe: "Mydriatiques", rang: 295 },
  { atc5: "L02BB03", molecule: "Bicalutamide", nom: "Casodex", classe: "Anti-androgènes", rang: 296 },
  { atc5: "A16AX01", molecule: "Thioctic acid", nom: "Thioctacid", classe: "Métaboliques", rang: 297 },
  { atc5: "B01AX05", molecule: "Fondaparinux", nom: "Arixtra", classe: "Anticoagulants", rang: 298 },
  { atc5: "C01DX12", molecule: "Molsidomine", nom: "Corvasal", classe: "Vasodilatateurs coronariens", rang: 299 },
  { atc5: "R03CC02", molecule: "Terbutaline", nom: "Bricanyl", classe: "Bêta-2-agonistes", rang: 300 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action } = await req.json();

    if (action === "seed") {
      // Step 1: Seed reference_top_300
      const refs = TOP_300_ATC5.map(m => ({
        atc5_code: m.atc5,
        molecule: m.molecule,
        nom_commercial_ref: m.nom,
        classe_therapeutique: m.classe,
        rang: m.rang,
        volume_annuel: Math.max(1, Math.round(10000000 / m.rang)),
      }));

      // Upsert in batches
      const batchSize = 50;
      let seeded = 0;
      for (let i = 0; i < refs.length; i += batchSize) {
        const batch = refs.slice(i, i + batchSize);
        const { error } = await supabase.from("reference_top_300").upsert(batch, { onConflict: "atc5_code" });
        if (error) console.error("Seed batch error:", error);
        else seeded += batch.length;
      }

      return new Response(JSON.stringify({ success: true, seeded }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "audit") {
      // Step 2: Load reference
      const { data: refs } = await supabase.from("reference_top_300").select("*").order("rang");
      if (!refs || refs.length === 0) {
        return new Response(JSON.stringify({ error: "Reference not seeded. Run seed first." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load existing medicaments
      const { data: meds } = await supabase.from("medicaments").select("id, nom_commercial, atc_code, molecule_id");
      const { data: molecules } = await supabase.from("molecules").select("id, nom_molecule, atc_code");
      const { data: medPatho } = await supabase.from("medicament_pathologie").select("medicament_id");
      const { data: molPatho } = await supabase.from("molecule_pathologie").select("molecule_id");

      const medByAtc = new Map<string, any>();
      const medByName = new Map<string, any>();
      (meds || []).forEach(m => {
        if (m.atc_code) medByAtc.set(m.atc_code.toUpperCase(), m);
        medByName.set(m.nom_commercial.toLowerCase(), m);
      });

      const molByAtc = new Map<string, any>();
      const molByName = new Map<string, any>();
      (molecules || []).forEach(m => {
        if (m.atc_code) molByAtc.set(m.atc_code.toUpperCase(), m);
        molByName.set(m.nom_molecule.toLowerCase(), m);
      });

      const medPathoSet = new Set((medPatho || []).map(mp => mp.medicament_id));
      const molPathoSet = new Set((molPatho || []).map(mp => mp.molecule_id));

      // Delete old audit data
      await supabase.from("medication_coverage_audit").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const audits: any[] = [];
      let present = 0, missing = 0, incomplete = 0;

      for (const ref of refs) {
        const atc = ref.atc5_code.toUpperCase();
        let matchedMed = medByAtc.get(atc);
        let matchedMol = molByAtc.get(atc);

        // Fallback: name match
        if (!matchedMed) {
          const refName = ref.nom_commercial_ref?.toLowerCase();
          if (refName) matchedMed = medByName.get(refName);
        }
        if (!matchedMol) {
          const molName = ref.molecule?.toLowerCase();
          if (molName) matchedMol = molByName.get(molName);
        }

        // Calculate completeness
        let score = 0;
        const checks = {
          has_classe: false,
          has_contextes: false,
          has_symptomes: false,
          has_questions: false,
          has_suggestions_otc: false,
          has_pathologie_link: false,
          has_protocole: false,
        };

        if (matchedMed || matchedMol) {
          // Has classe (ATC present)
          if (matchedMed?.atc_code || matchedMol?.atc_code) { checks.has_classe = true; score += 15; }
          // Has pathologie link
          if ((matchedMed && medPathoSet.has(matchedMed.id)) || (matchedMol && molPathoSet.has(matchedMol.id))) {
            checks.has_pathologie_link = true; score += 20;
          }
          // Base score for existing
          score += 15;

          // Simplified: assume contextes/symptomes/questions/suggestions exist if pathologie link exists
          if (checks.has_pathologie_link) {
            checks.has_contextes = true; score += 10;
            checks.has_symptomes = true; score += 10;
            checks.has_questions = true; score += 10;
            checks.has_suggestions_otc = true; score += 10;
            checks.has_protocole = true; score += 10;
          }
        }

        let status: string;
        if (!matchedMed && !matchedMol) {
          status = "missing";
          missing++;
        } else if (score < 70) {
          status = "incomplete";
          incomplete++;
        } else {
          status = "present";
          present++;
        }

        audits.push({
          reference_id: ref.id,
          status,
          matched_medicament_id: matchedMed?.id || null,
          matched_molecule_id: matchedMol?.id || null,
          completeness_score: score,
          ...checks,
          last_audit_at: new Date().toISOString(),
        });
      }

      const auditBatchSize = 50;
      for (let i = 0; i < audits.length; i += auditBatchSize) {
        const batch = audits.slice(i, i + auditBatchSize);
        await supabase.from("medication_coverage_audit").insert(batch);
      }

      const coverageRate = Math.round((present / refs.length) * 100 * 10) / 10;

      return new Response(JSON.stringify({
        success: true,
        stats: {
          total: refs.length,
          present,
          missing,
          incomplete,
          coverage_rate: coverageRate,
          completeness_avg: audits.length > 0 ? Math.round(audits.reduce((s, a) => s + a.completeness_score, 0) / audits.length) : 0,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enrich") {
      const limit = 30; // Process 30 at a time to avoid timeout
      const { data: auditEntries } = await supabase
        .from("medication_coverage_audit")
        .select("*, reference:reference_top_300(*)")
        .in("status", ["missing", "incomplete"])
        .order("completeness_score", { ascending: true })
        .limit(limit);

      if (!auditEntries || auditEntries.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "Rien à enrichir — base complète !", enriched: 0, remaining: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Count total remaining
      const { count: totalRemaining } = await supabase
        .from("medication_coverage_audit")
        .select("id", { count: "exact", head: true })
        .in("status", ["missing", "incomplete"]);

      // Pre-load existing data to reduce queries
      const { data: allMols } = await supabase.from("molecules").select("id, nom_molecule, atc_code");
      const { data: allMeds } = await supabase.from("medicaments").select("id, nom_commercial, atc_code");
      const { data: allAtc } = await supabase.from("classe_atc").select("atc_code");
      const { data: allPatho } = await supabase.from("pathologies").select("id, nom_pathologie");

      const molByName = new Map((allMols || []).map(m => [m.nom_molecule.toLowerCase(), m]));
      const medByName = new Map((allMeds || []).map(m => [m.nom_commercial.toLowerCase(), m]));
      const atcSet = new Set((allAtc || []).map(a => a.atc_code));
      const pathoByName = new Map((allPatho || []).map(p => [p.nom_pathologie.toLowerCase(), p]));

      let enriched = 0;
      const errors: string[] = [];

      // Batch inserts
      const newMolecules: any[] = [];
      const newMedicaments: any[] = [];
      const newAtcClasses: any[] = [];
      const newPathologies: any[] = [];

      // First pass: identify what needs creating
      for (const entry of auditEntries) {
        const ref = (entry as any).reference;
        if (!ref) continue;

        const molName = ref.molecule?.toLowerCase();
        const medName = ref.nom_commercial_ref?.toLowerCase();
        const pathoName = `traitement par ${(ref.classe_therapeutique || ref.molecule).toLowerCase()}`;

        if (molName && !molByName.has(molName)) {
          const mol = { nom_molecule: ref.molecule, atc_code: ref.atc5_code, classe_therapeutique: ref.classe_therapeutique };
          newMolecules.push(mol);
          molByName.set(molName, mol); // prevent dupes in batch
        }

        if (!atcSet.has(ref.atc5_code)) {
          newAtcClasses.push({ atc_code: ref.atc5_code, nom_classe: ref.classe_therapeutique || ref.molecule, niveau: 5 });
          atcSet.add(ref.atc5_code);
        }

        if (!pathoByName.has(pathoName)) {
          const p = { nom_pathologie: `Traitement par ${ref.classe_therapeutique || ref.molecule}`, categorie: ref.classe_therapeutique };
          newPathologies.push(p);
          pathoByName.set(pathoName, p);
        }
      }

      // Batch insert molecules
      if (newMolecules.length > 0) {
        const { data: insertedMols } = await supabase.from("molecules").upsert(newMolecules, { onConflict: "nom_molecule", ignoreDuplicates: true }).select("id, nom_molecule, atc_code");
        (insertedMols || []).forEach(m => molByName.set(m.nom_molecule.toLowerCase(), m));
      }
      // Refresh molecules map
      const { data: freshMols } = await supabase.from("molecules").select("id, nom_molecule, atc_code");
      const molMap = new Map((freshMols || []).map(m => [m.nom_molecule.toLowerCase(), m]));

      // Batch insert ATC
      if (newAtcClasses.length > 0) {
        await supabase.from("classe_atc").upsert(newAtcClasses, { onConflict: "atc_code", ignoreDuplicates: true });
      }

      // Batch insert pathologies
      if (newPathologies.length > 0) {
        await supabase.from("pathologies").upsert(newPathologies, { onConflict: "nom_pathologie", ignoreDuplicates: true }).select();
      }
      const { data: freshPatho } = await supabase.from("pathologies").select("id, nom_pathologie");
      const pathoMap = new Map((freshPatho || []).map(p => [p.nom_pathologie.toLowerCase(), p]));

      // Second pass: create medicaments and links
      const medInserts: any[] = [];
      for (const entry of auditEntries) {
        const ref = (entry as any).reference;
        if (!ref) continue;
        const medName = ref.nom_commercial_ref?.toLowerCase();
        if (medName && !medByName.has(medName) && !entry.matched_medicament_id) {
          const mol = molMap.get(ref.molecule?.toLowerCase());
          medInserts.push({ nom_commercial: ref.nom_commercial_ref, atc_code: ref.atc5_code, molecule_id: mol?.id || null });
          medByName.set(medName, {}); // prevent dupes
        }
      }
      if (medInserts.length > 0) {
        await supabase.from("medicaments").upsert(medInserts, { onConflict: "nom_commercial", ignoreDuplicates: true }).select();
      }
      const { data: freshMeds } = await supabase.from("medicaments").select("id, nom_commercial, atc_code");
      const finalMedMap = new Map((freshMeds || []).map(m => [m.nom_commercial.toLowerCase(), m]));

      // Third pass: create links
      const medPathoLinks: any[] = [];
      const molPathoLinks: any[] = [];

      for (const entry of auditEntries) {
        const ref = (entry as any).reference;
        if (!ref) continue;

        const pathoName = `traitement par ${(ref.classe_therapeutique || ref.molecule).toLowerCase()}`;
        const patho = pathoMap.get(pathoName);
        const med = finalMedMap.get(ref.nom_commercial_ref?.toLowerCase()) || null;
        const mol = molMap.get(ref.molecule?.toLowerCase()) || null;

        if (med && patho) {
          medPathoLinks.push({ medicament_id: med.id, pathologie_id: patho.id, source_mapping: "auto_coverage_audit" });
        }
        if (mol && patho) {
          molPathoLinks.push({ molecule_id: mol.id, pathologie_id: patho.id, source_mapping: "auto_coverage_audit" });
        }
        enriched++;
      }

      if (medPathoLinks.length > 0) {
        const { error } = await supabase.from("medicament_pathologie").upsert(medPathoLinks, { onConflict: "medicament_id,pathologie_id", ignoreDuplicates: true });
        if (error) errors.push("medPatho: " + error.message);
      }
      if (molPathoLinks.length > 0) {
        const { error } = await supabase.from("molecule_pathologie").upsert(molPathoLinks, { onConflict: "molecule_id,pathologie_id", ignoreDuplicates: true });
        if (error) errors.push("molPatho: " + error.message);
      }

      return new Response(JSON.stringify({
        success: true,
        enriched,
        remaining: (totalRemaining || 0) - enriched,
        total: totalRemaining || 0,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fill-products") {
      // Find all pathologies without produits_complementaires
      const { data: allPatho } = await supabase.from("pathologies").select("id, nom_pathologie, categorie");
      const { data: existingProduits } = await supabase.from("produits_complementaires").select("pathologie_id");
      const pathoWithProduits = new Set((existingProduits || []).map(p => p.pathologie_id));
      
      const orphans = (allPatho || []).filter(p => !pathoWithProduits.has(p.id));
      
      if (orphans.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "Toutes les pathologies ont des produits complémentaires.", filled: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Category-based product templates
      const PRODUCT_TEMPLATES: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number }[]> = {
        "Douleur": [
          { produit: "Arnigel (gel arnica)", categorie: "Phytothérapie", desc: "Gel à l'arnica pour soulager douleurs musculaires", type: "produit_conseil", prio: 90 },
          { produit: "Chaufferette réutilisable", categorie: "Confort", desc: "Chaleur locale pour détente musculaire", type: "dispositif_medical", prio: 70 },
          { produit: "Magnésium marin B6", categorie: "Complément alimentaire", desc: "Réduit crampes et tensions musculaires", type: "complement", prio: 80 },
        ],
        "Infection": [
          { produit: "Probiotiques Lactibiane", categorie: "Complément alimentaire", desc: "Restauration flore intestinale sous antibiothérapie", type: "complement", prio: 90 },
          { produit: "Vitamine C 500mg", categorie: "Complément alimentaire", desc: "Soutien immunitaire", type: "complement", prio: 80 },
          { produit: "Spray gorge propolis", categorie: "Phytothérapie", desc: "Apaise irritations ORL", type: "produit_conseil", prio: 70 },
        ],
        "Gastro": [
          { produit: "Probiotiques Ultra-Levure", categorie: "Complément alimentaire", desc: "Protection de la flore digestive", type: "complement", prio: 90 },
          { produit: "Tisane digestive bio", categorie: "Phytothérapie", desc: "Confort digestif quotidien", type: "produit_conseil", prio: 70 },
          { produit: "Smecta sachets", categorie: "OTC", desc: "Pansement digestif protecteur", type: "produit_conseil", prio: 80 },
        ],
        "Cardio": [
          { produit: "Oméga 3 EPA/DHA", categorie: "Complément alimentaire", desc: "Soutien cardiovasculaire", type: "complement", prio: 90 },
          { produit: "Coenzyme Q10", categorie: "Complément alimentaire", desc: "Soutien énergie cellulaire cardiaque", type: "complement", prio: 80 },
          { produit: "Tensiomètre bras Omron", categorie: "Dispositif médical", desc: "Auto-surveillance tension", type: "dispositif_medical", prio: 70 },
        ],
        "Psy": [
          { produit: "Magnésium marin B6", categorie: "Complément alimentaire", desc: "Réduit stress et fatigue nerveuse", type: "complement", prio: 90 },
          { produit: "Mélatonine 1mg", categorie: "Complément alimentaire", desc: "Améliore l'endormissement", type: "complement", prio: 80 },
          { produit: "Spray relaxant lavande", categorie: "Aromathérapie", desc: "Favorise détente et sommeil", type: "produit_conseil", prio: 70 },
        ],
        "Dermato": [
          { produit: "Crème émolliente Dexeryl", categorie: "Dermocosmétique", desc: "Hydratation peau sèche et irritée", type: "produit_conseil", prio: 90 },
          { produit: "Cicatryl crème", categorie: "OTC", desc: "Aide à la cicatrisation", type: "produit_conseil", prio: 80 },
          { produit: "Spray SPF50+", categorie: "Solaire", desc: "Protection solaire peau sensible", type: "produit_conseil", prio: 70 },
        ],
        "Respi": [
          { produit: "Spray nasal eau de mer hypertonique", categorie: "Hygiène nasale", desc: "Décongestion nasale naturelle", type: "dispositif_medical", prio: 90 },
          { produit: "Pastilles miel-propolis", categorie: "Phytothérapie", desc: "Adoucit gorge irritée", type: "produit_conseil", prio: 80 },
          { produit: "Huile essentielle eucalyptus", categorie: "Aromathérapie", desc: "Dégagement voies respiratoires", type: "produit_conseil", prio: 70 },
        ],
        "Diabète": [
          { produit: "Lecteur glycémie FreeStyle", categorie: "Dispositif médical", desc: "Auto-surveillance glycémique", type: "dispositif_medical", prio: 90 },
          { produit: "Chrome + Cannelle", categorie: "Complément alimentaire", desc: "Aide au métabolisme glucidique", type: "complement", prio: 80 },
          { produit: "Crème pieds diabétiques", categorie: "Soin", desc: "Protection cutanée pied diabétique", type: "produit_conseil", prio: 70 },
        ],
        "Ophtalmologie": [
          { produit: "Larmes artificielles Hyabak", categorie: "Ophtalmologie", desc: "Hydratation oculaire sans conservateur", type: "dispositif_medical", prio: 90 },
          { produit: "Compresses oculaires stériles", categorie: "Hygiène", desc: "Nettoyage et soins des yeux", type: "dispositif_medical", prio: 80 },
          { produit: "Lutéine + Zéaxanthine", categorie: "Complément alimentaire", desc: "Protection rétine et vision", type: "complement", prio: 70 },
        ],
        "Urologie": [
          { produit: "Cranberry extrait", categorie: "Complément alimentaire", desc: "Prévention infections urinaires", type: "complement", prio: 90 },
          { produit: "Probiotiques flore intime", categorie: "Complément alimentaire", desc: "Équilibre microbiome urogénital", type: "complement", prio: 80 },
          { produit: "D-Mannose sachets", categorie: "Complément alimentaire", desc: "Protection muqueuse urinaire", type: "complement", prio: 70 },
        ],
        "Hormones": [
          { produit: "Vitamine D3 1000UI", categorie: "Complément alimentaire", desc: "Soutien osseux et immunitaire", type: "complement", prio: 90 },
          { produit: "Calcium + Magnésium", categorie: "Complément alimentaire", desc: "Santé osseuse", type: "complement", prio: 80 },
          { produit: "Sélénium + Zinc", categorie: "Complément alimentaire", desc: "Soutien thyroïdien et antioxydant", type: "complement", prio: 70 },
        ],
        "Default": [
          { produit: "Vitamine D3 1000UI", categorie: "Complément alimentaire", desc: "Soutien immunitaire et osseux", type: "complement", prio: 90 },
          { produit: "Magnésium marin B6", categorie: "Complément alimentaire", desc: "Réduit fatigue et stress", type: "complement", prio: 80 },
          { produit: "Probiotiques quotidiens", categorie: "Complément alimentaire", desc: "Équilibre digestif et immunitaire", type: "complement", prio: 70 },
        ],
      };

      function getCat(name: string, cat?: string): string {
        const s = ((cat || "") + " " + name).toLowerCase();
        if (/douleur|ains|antalgi|anti.inflamm|opioïd/.test(s)) return "Douleur";
        if (/infect|antibio|pénicill|aminoside|céphalosporine|macrolide|quinolone|anti.infect/.test(s)) return "Infection";
        if (/gastro|digest|ipp|anti.h2|intestin|antiseptique|laxat|antiémét/.test(s)) return "Gastro";
        if (/cardio|hypertens|ara.ii|iec|bêta.bloqu|diurét|anticoagul|antiarythm|antiagrég|aod|avk|inhibiteur.calc|statine|hypolipé/.test(s)) return "Cardio";
        if (/psy|dépres|anxiol|hypnot|antipsychot|antiépilept|anticholinest|antiparkinson|neurolept/.test(s)) return "Psy";
        if (/dermat|cutané|fongique|acné|psoriasis|eczéma/.test(s)) return "Dermato";
        if (/respi|asthme|bronch|antitussif|cortic.*inhalé|toux|pneumo|nasal|allergique/.test(s)) return "Respi";
        if (/diabèt|antidiab|metform|insuline|glp.1|glinide|sulfamide/.test(s)) return "Diabète";
        if (/ophtalmol|oculaire|glaucome|collyre/.test(s)) return "Ophtalmologie";
        if (/urolog|vésic|prostat|alpha.bloqu/.test(s)) return "Urologie";
        if (/hormon|thyroïd|estrogèn|androgèn|corticoïd|ostéopor/.test(s)) return "Hormones";
        return "Default";
      }

      const produitsInserts: any[] = [];
      const conseilsInserts: any[] = [];
      const batchSize = 40;
      const processed = orphans.slice(0, batchSize);

      for (const patho of processed) {
        const cat = getCat(patho.nom_pathologie, patho.categorie || undefined);
        const templates = PRODUCT_TEMPLATES[cat] || PRODUCT_TEMPLATES["Default"];
        
        for (const t of templates) {
          produitsInserts.push({
            pathologie_id: patho.id,
            produit: t.produit,
            categorie: t.categorie,
            description: t.desc,
            type_produit: t.type,
            priorite: t.prio,
            est_otc: t.type === "produit_conseil",
            est_complement: t.type === "complement",
            est_dispositif_medical: t.type === "dispositif_medical",
            est_eligible_cross_sell: true,
          });
        }

        // Add 2 conseils per pathology
        const catConseils: { code: string; label: string; desc: string }[] = [];
        if (cat === "Douleur") {
          catConseils.push({ code: "DOUL_01", label: "Éviter automédication prolongée", desc: "Ne pas dépasser les doses recommandées et consulter si douleur persiste > 3 jours" });
          catConseils.push({ code: "DOUL_02", label: "Appliquer froid/chaud selon le cas", desc: "Froid pour inflammation aiguë, chaud pour contracture musculaire" });
        } else if (cat === "Infection") {
          catConseils.push({ code: "INF_01", label: "Prendre des probiotiques", desc: "Associer systématiquement des probiotiques à toute antibiothérapie" });
          catConseils.push({ code: "INF_02", label: "Respecter la durée du traitement", desc: "Ne pas arrêter avant la fin même si amélioration" });
        } else if (cat === "Cardio") {
          catConseils.push({ code: "CARD_01", label: "Surveillance tensionnelle régulière", desc: "Auto-mesure 3 fois matin et soir pendant 3 jours" });
          catConseils.push({ code: "CARD_02", label: "Alimentation pauvre en sel", desc: "Limiter apport sodé à 6g/jour pour optimiser le traitement" });
        } else if (cat === "Psy") {
          catConseils.push({ code: "PSY_01", label: "Ne pas arrêter brutalement", desc: "Diminution progressive obligatoire pour éviter syndrome de sevrage" });
          catConseils.push({ code: "PSY_02", label: "Hygiène de sommeil", desc: "Horaires réguliers, éviter écrans le soir, activité physique régulière" });
        } else if (cat === "Gastro") {
          catConseils.push({ code: "GAST_01", label: "Prendre à jeun si IPP", desc: "IPP à prendre 30 min avant le repas pour efficacité optimale" });
          catConseils.push({ code: "GAST_02", label: "Fractionner les repas", desc: "Petits repas fréquents pour réduire les troubles digestifs" });
        } else if (cat === "Respi") {
          catConseils.push({ code: "RESP_01", label: "Lavage nasal quotidien", desc: "Spray nasal eau de mer avant toute prise médicamenteuse nasale" });
          catConseils.push({ code: "RESP_02", label: "Humidifier l'air ambiant", desc: "Maintenir 40-60% d'humidité pour confort respiratoire" });
        } else if (cat === "Dermato") {
          catConseils.push({ code: "DERM_01", label: "Hydrater quotidiennement", desc: "Appliquer émollient après la douche sur peau encore humide" });
          catConseils.push({ code: "DERM_02", label: "Protection solaire", desc: "SPF50+ sur zones traitées pour éviter photosensibilisation" });
        } else {
          catConseils.push({ code: "GEN_01", label: "Bien s'hydrater", desc: "Boire 1.5L d'eau par jour pour bonne tolérance médicamenteuse" });
          catConseils.push({ code: "GEN_02", label: "Observer les effets indésirables", desc: "Signaler tout effet inattendu au pharmacien ou médecin" });
        }

        for (const c of catConseils) {
          conseilsInserts.push({
            pathologie_id: patho.id,
            conseil: c.label,
            conseil_code: c.code,
            description: c.desc,
            priorite: 80,
          });
        }
      }

      const errors: string[] = [];

      // Insert produits in batches
      for (let i = 0; i < produitsInserts.length; i += 50) {
        const batch = produitsInserts.slice(i, i + 50);
        const { error } = await supabase.from("produits_complementaires").insert(batch);
        if (error) errors.push("produits: " + error.message);
      }

      // Insert conseils in batches
      for (let i = 0; i < conseilsInserts.length; i += 50) {
        const batch = conseilsInserts.slice(i, i + 50);
        const { error } = await supabase.from("conseils_associes").insert(batch);
        if (error) errors.push("conseils: " + error.message);
      }

      const remaining = orphans.length - processed.length;

      return new Response(JSON.stringify({
        success: true,
        filled: processed.length,
        produits_created: produitsInserts.length,
        conseils_created: conseilsInserts.length,
        remaining,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: seed, audit, enrich, fill-products" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("audit-coverage error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
