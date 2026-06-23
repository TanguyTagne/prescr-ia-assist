import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── MOLECULES MANQUANTES ──────────────────────────────────────
const MOLECULES = [
  { nom: "Cefpodoxime", atc: "J01DD13", classe: "Céphalosporines 3e gén" },
  { nom: "Céfixime", atc: "J01DD08", classe: "Céphalosporines 3e gén" },
  { nom: "Doxycycline", atc: "J01AA02", classe: "Tétracyclines" },
  { nom: "Clarithromycine", atc: "J01FA09", classe: "Macrolides" },
  { nom: "Ofloxacine", atc: "J01MA01", classe: "Fluoroquinolones" },
  { nom: "Ciprofloxacine", atc: "J01MA02", classe: "Fluoroquinolones" },
  { nom: "Pristinamycine", atc: "J01FG01", classe: "Synergistines" },
  { nom: "Hélicidine", atc: "R05DB", classe: "Antitussifs" },
  { nom: "Loratadine", atc: "R06AX13", classe: "Antihistaminiques non sédatifs" },
  { nom: "Dexchlorphéniramine", atc: "R06AB02", classe: "Antihistaminiques sédatifs" },
  { nom: "Fexofénadine", atc: "R06AX26", classe: "Antihistaminiques non sédatifs" },
  { nom: "Lévocétirizine", atc: "R06AE09", classe: "Antihistaminiques non sédatifs" },
  { nom: "Alginate de sodium", atc: "A02BX13", classe: "Antiacides" },
  { nom: "Phosphate d'aluminium", atc: "A02AB03", classe: "Antiacides" },
  { nom: "Macrogol", atc: "A06AD15", classe: "Laxatifs osmotiques" },
  { nom: "Bisacodyl", atc: "A06AB02", classe: "Laxatifs stimulants" },
  { nom: "Paraffine liquide", atc: "A06AA01", classe: "Laxatifs lubrifiants" },
  { nom: "Sorbitol", atc: "A06AD18", classe: "Laxatifs osmotiques" },
  { nom: "Ramipril", atc: "C09AA05", classe: "IEC" },
  { nom: "Simvastatine", atc: "C10AA01", classe: "Statines" },
  { nom: "Sitagliptine", atc: "A10BH01", classe: "Inhibiteurs DPP-4" },
  { nom: "Cicatridine", atc: "D03AX", classe: "Cicatrisants" },
  { nom: "Fenticonazole", atc: "G01AF12", classe: "Antifongiques gynécologiques" },
  { nom: "Acide fusidique", atc: "D06AX01", classe: "Antibiotiques topiques" },
  { nom: "Trolamine", atc: "D02AE01", classe: "Émollients" },
  { nom: "Borax + Acide borique", atc: "S01AX", classe: "Antiseptiques ophtalmiques" },
  { nom: "Dexaméthasone + Oxytétracycline oph", atc: "S01CA01", classe: "Anti-infectieux ophtalmiques" },
  { nom: "Sertaconazole", atc: "G01AF", classe: "Antifongiques gynéco" },
  { nom: "Éconazole vaginal", atc: "G01AF05", classe: "Antifongiques gynéco" },
  { nom: "Sumatriptan", atc: "N02CC01", classe: "Triptans" },
  { nom: "Zolmitriptan", atc: "N02CC03", classe: "Triptans" },
  { nom: "Tamsulosine", atc: "G04CA02", classe: "Alpha-bloquants urologiques" },
  { nom: "Serenoa repens", atc: "G04CX02", classe: "Phytothérapie prostatique" },
  { nom: "Biclotymol + Lysozyme", atc: "R02AA", classe: "Antiseptiques ORL" },
  { nom: "Soufre colloïdal", atc: "R01AX", classe: "ORL divers" },
  { nom: "Diménhydrinate", atc: "R06AA52", classe: "Antiémétiques" },
  { nom: "Kétotifène", atc: "R06AX17", classe: "Antihistaminiques" },
  { nom: "Chlorhexidine + Cétrimide", atc: "D08AC52", classe: "Antiseptiques" },
  { nom: "Povidone iodée", atc: "D08AG02", classe: "Antiseptiques iodés" },
  { nom: "Éosine aqueuse", atc: "D08AX", classe: "Antiseptiques" },
  { nom: "Saccharomyces boulardii", atc: "A07FA02", classe: "Probiotiques" },
  { nom: "Lidocaïne topique buccale", atc: "A01AD11", classe: "Anesthésiques buccaux" },
  { nom: "Trimebutine topique buccale", atc: "A01AD", classe: "Analgésiques buccaux" },
  { nom: "Diosmine + Hespéridine", atc: "C05CA53", classe: "Veinotoniques" },
  { nom: "Ginkgo biloba extrait", atc: "C04AX", classe: "Veinotoniques" },
  { nom: "Ispaghul", atc: "A06AC01", classe: "Laxatifs de lest" },
  { nom: "Gomme sterculia", atc: "A06AC", classe: "Laxatifs de lest" },
  { nom: "Zopiclone", atc: "N05CF01", classe: "Hypnotiques" },
  { nom: "Prednisolone", atc: "H02AB06", classe: "Corticoïdes systémiques" },
  { nom: "Prednisone", atc: "H02AB07", classe: "Corticoïdes systémiques" },
  { nom: "Acide folique", atc: "B03BB01", classe: "Vitamines B" },
  { nom: "Cyanocobalamine", atc: "B03BA01", classe: "Vitamine B12" },
  { nom: "Fer (sulfate ferreux)", atc: "B03AA07", classe: "Suppléments en fer" },
  { nom: "Gluconate de calcium", atc: "A12AA03", classe: "Suppléments calciques" },
  { nom: "Lévonorgestrel seul", atc: "G03AC03", classe: "Contraceptifs progestatifs" },
  { nom: "Éthinylestradiol + Désogestrel", atc: "G03AA09", classe: "Contraceptifs combinés" },
  { nom: "Éthinylestradiol + Lévonorgestrel cp", atc: "G03AA07", classe: "Contraceptifs combinés" },
  { nom: "Vaccin grippe", atc: "J07BB02", classe: "Vaccins" },
  { nom: "Vaccin HPV", atc: "J07BM01", classe: "Vaccins" },
  { nom: "Acide tranexamique", atc: "B02AA02", classe: "Antifibrinolytiques" },
  { nom: "Chlorure de sodium isotonique", atc: "B05BB01", classe: "Solutions isotoniques" },
  { nom: "Eau de mer hypertonique", atc: "R01AX10", classe: "Solutions nasales" },
];

// ─── MEDICAMENTS MANQUANTS ──────────────────────────────────────
const MEDICAMENTS = [
  // Antalgiques
  { nom: "Spifen 400mg", molecule: "Ibuprofène", atc: "M01AE01", labo: "Pfizer", forme: "Granulé", dosage: "400mg", otc: false },
  { nom: "Aspégic 1000mg", molecule: "Acide acétylsalicylique", atc: "N02BA01", labo: "Sanofi", forme: "Poudre", dosage: "1000mg", otc: false },
  { nom: "Aspégic nourrisson 100mg", molecule: "Acide acétylsalicylique", atc: "N02BA01", labo: "Sanofi", forme: "Poudre", dosage: "100mg", otc: false },
  { nom: "Codoliprane", molecule: "Codéine", atc: "N02AA59", labo: "Sanofi", forme: "Comprimé", dosage: "Paracétamol 400mg + Codéine 20mg", otc: false },
  { nom: "Tramadol/Paracétamol 37.5/325mg", molecule: "Tramadol", atc: "N02AX52", labo: "Biogaran", forme: "Comprimé", dosage: "37.5/325mg", otc: false },
  { nom: "Paracétamol générique 1g", molecule: "Paracétamol", atc: "N02BE01", labo: "Biogaran", forme: "Comprimé", dosage: "1g", otc: true },
  { nom: "Ibuprofène générique 400mg", molecule: "Ibuprofène", atc: "M01AE01", labo: "Biogaran", forme: "Comprimé", dosage: "400mg", otc: false },

  // Antibiotiques
  { nom: "Cefpodoxime 100mg", molecule: "Cefpodoxime", atc: "J01DD13", labo: "Biogaran", forme: "Comprimé", dosage: "100mg", otc: false },
  { nom: "Oroken 200mg", molecule: "Céfixime", atc: "J01DD08", labo: "Sanofi", forme: "Comprimé", dosage: "200mg", otc: false },
  { nom: "Doxycycline 100mg", molecule: "Doxycycline", atc: "J01AA02", labo: "Biogaran", forme: "Comprimé", dosage: "100mg", otc: false },
  { nom: "Zeclar 500mg", molecule: "Clarithromycine", atc: "J01FA09", labo: "Abbott", forme: "Comprimé", dosage: "500mg", otc: false },
  { nom: "Oflocet 200mg", molecule: "Ofloxacine", atc: "J01MA01", labo: "Sanofi", forme: "Comprimé", dosage: "200mg", otc: false },
  { nom: "Ciflox 500mg", molecule: "Ciprofloxacine", atc: "J01MA02", labo: "Bayer", forme: "Comprimé", dosage: "500mg", otc: false },
  { nom: "Monuril 3g", molecule: "Fosfomycine trométamol", atc: "J01XX01", labo: "Zambon", forme: "Sachet", dosage: "3g", otc: false },
  { nom: "Pyostacine 500mg", molecule: "Pristinamycine", atc: "J01FG01", labo: "Sanofi", forme: "Comprimé", dosage: "500mg", otc: false },
  { nom: "Amoxicilline générique 1g", molecule: "Amoxicilline", atc: "J01CA04", labo: "Biogaran", forme: "Comprimé", dosage: "1g", otc: false },

  // ORL / rhume / toux
  { nom: "Dolirhume", molecule: "Paracétamol", atc: "N02BE51", labo: "Sanofi", forme: "Comprimé", dosage: "500mg + Pseudoéphédrine", otc: true },
  { nom: "Helicidine sirop", molecule: "Hélicidine", atc: "R05DB", labo: "Therabel", forme: "Sirop", dosage: "10%", otc: true },
  { nom: "Acétylcystéine 200mg", molecule: "Acétylcystéine", atc: "R05CB01", labo: "Biogaran", forme: "Sachet", dosage: "200mg", otc: true },
  { nom: "Carbocistéine sirop", molecule: "Carbocistéine", atc: "R05CB03", labo: "Biogaran", forme: "Sirop", dosage: "5%", otc: true },
  { nom: "Physiomer spray nasal", molecule: "Eau de mer hypertonique", atc: "R01AX10", labo: "Omega Pharma", forme: "Spray nasal", dosage: "135ml", otc: true },

  // Allergie
  { nom: "Cétirizine 10mg", molecule: "Cétirizine", atc: "R06AE07", labo: "Biogaran", forme: "Comprimé", dosage: "10mg", otc: true },
  { nom: "Loratadine 10mg", molecule: "Loratadine", atc: "R06AX13", labo: "Biogaran", forme: "Comprimé", dosage: "10mg", otc: true },
  { nom: "Desloratadine 5mg", molecule: "Desloratadine", atc: "R06AX27", labo: "Biogaran", forme: "Comprimé", dosage: "5mg", otc: false },
  { nom: "Polaramine 2mg", molecule: "Dexchlorphéniramine", atc: "R06AB02", labo: "MSD", forme: "Comprimé", dosage: "2mg", otc: false },
  { nom: "Telfast 180mg", molecule: "Fexofénadine", atc: "R06AX26", labo: "Sanofi", forme: "Comprimé", dosage: "180mg", otc: false },
  { nom: "Xyzall 5mg", molecule: "Lévocétirizine", atc: "R06AE09", labo: "UCB", forme: "Comprimé", dosage: "5mg", otc: false },

  // Digestif
  { nom: "Oméprazole 20mg", molecule: "Oméprazole", atc: "A02BC01", labo: "Biogaran", forme: "Gélule", dosage: "20mg", otc: false },
  { nom: "Phosphalugel", molecule: "Phosphate d'aluminium", atc: "A02AB03", labo: "Astellas", forme: "Sachet", dosage: "12.38g", otc: true },
  { nom: "Diosmectite 3g", molecule: "Diosmectite", atc: "A07BC05", labo: "Biogaran", forme: "Sachet", dosage: "3g", otc: true },

  // Constipation
  { nom: "Movicol", molecule: "Macrogol", atc: "A06AD15", labo: "Norgine", forme: "Sachet", dosage: "13.125g", otc: true },
  { nom: "Macrogol 4000 10g", molecule: "Macrogol", atc: "A06AD15", labo: "Biogaran", forme: "Sachet", dosage: "10g", otc: true },
  { nom: "Dulcolax 5mg", molecule: "Bisacodyl", atc: "A06AB02", labo: "Sanofi", forme: "Comprimé", dosage: "5mg", otc: true },
  { nom: "Lansoyl gel oral", molecule: "Paraffine liquide", atc: "A06AA01", labo: "Johnson & Johnson", forme: "Gel oral", dosage: "78.23%", otc: true },
  { nom: "Microlax", molecule: "Sorbitol", atc: "A06AD18", labo: "Johnson & Johnson", forme: "Solution rectale", dosage: "5ml", otc: true },

  // Cardiovasculaire
  { nom: "Amlodipine 5mg", molecule: "Amlodipine", atc: "C08CA01", labo: "Biogaran", forme: "Comprimé", dosage: "5mg", otc: false },
  { nom: "Amlodipine générique 10mg", molecule: "Amlodipine", atc: "C08CA01", labo: "Biogaran", forme: "Comprimé", dosage: "10mg", otc: false },
  { nom: "Bisoprolol 5mg", molecule: "Bisoprolol", atc: "C07AB07", labo: "Biogaran", forme: "Comprimé", dosage: "5mg", otc: false },
  { nom: "Ramipril 5mg", molecule: "Ramipril", atc: "C09AA05", labo: "Biogaran", forme: "Comprimé", dosage: "5mg", otc: false },
  { nom: "Enalapril 20mg", molecule: "Énalapril", atc: "C09AA02", labo: "Biogaran", forme: "Comprimé", dosage: "20mg", otc: false },
  { nom: "Simvastatine 20mg", molecule: "Simvastatine", atc: "C10AA01", labo: "Biogaran", forme: "Comprimé", dosage: "20mg", otc: false },
  { nom: "Atorvastatine générique 20mg", molecule: "Atorvastatine", atc: "C10AA05", labo: "Biogaran", forme: "Comprimé", dosage: "20mg", otc: false },
  { nom: "Furosémide 40mg", molecule: "Furosémide", atc: "C03CA01", labo: "Biogaran", forme: "Comprimé", dosage: "40mg", otc: false },

  // Diabète
  { nom: "Metformine 1000mg", molecule: "Metformine", atc: "A10BA02", labo: "Biogaran", forme: "Comprimé", dosage: "1000mg", otc: false },
  { nom: "Metformine générique 850mg", molecule: "Metformine", atc: "A10BA02", labo: "Biogaran", forme: "Comprimé", dosage: "850mg", otc: false },

  // Thyroïde
  { nom: "L-Thyroxine Henning 100µg", molecule: "Lévothyroxine", atc: "H03AA01", labo: "Sanofi", forme: "Comprimé", dosage: "100µg", otc: false },

  // Dermatologie
  { nom: "Cicatridine ovules", molecule: "Cicatridine", atc: "D03AX", labo: "HRA Pharma", forme: "Ovule", dosage: "10 ovules", otc: true },
  { nom: "Mycohydralin 500mg", molecule: "Clotrimazole", atc: "G01AF02", labo: "Bayer", forme: "Capsule vaginale", dosage: "500mg", otc: true },
  { nom: "Lomexin 600mg", molecule: "Fenticonazole", atc: "G01AF12", labo: "Effik", forme: "Capsule vaginale", dosage: "600mg", otc: true },
  { nom: "Econazole crème 1%", molecule: "Éconazole", atc: "D01AC03", labo: "Biogaran", forme: "Crème", dosage: "1%", otc: true },
  { nom: "Fucidine crème 2%", molecule: "Acide fusidique", atc: "D06AX01", labo: "Leo Pharma", forme: "Crème", dosage: "2%", otc: false },
  { nom: "Biafine émulsion", molecule: "Trolamine", atc: "D02AE01", labo: "Johnson & Johnson", forme: "Émulsion", dosage: "186g", otc: true },
  { nom: "Atoderm crème", molecule: "Dexeryl", atc: "D02AX", labo: "Bioderma", forme: "Crème", dosage: "200ml", otc: true },
  { nom: "Lipikar baume AP+M", molecule: "Dexeryl", atc: "D02AX", labo: "La Roche-Posay", forme: "Baume", dosage: "400ml", otc: true },

  // Ophtalmologie
  { nom: "Dacryum", molecule: "Borax + Acide borique", atc: "S01AX", labo: "Alcon", forme: "Collyre", dosage: "Unidoses", otc: true },
  { nom: "Sterdex", molecule: "Dexaméthasone + Oxytétracycline oph", atc: "S01CA01", labo: "Théa", forme: "Pommade ophtalmique", dosage: "1mg", otc: false },
  { nom: "Optrex collyre", molecule: "Borax + Acide borique", atc: "S01AX", labo: "Reckitt", forme: "Collyre", dosage: "10ml", otc: true },

  // Gynécologie
  { nom: "Monazol ovule", molecule: "Sertaconazole", atc: "G01AF", labo: "Théramex", forme: "Ovule", dosage: "300mg", otc: true },
  { nom: "Lomexin ovule 600mg", molecule: "Fenticonazole", atc: "G01AF12", labo: "Effik", forme: "Ovule", dosage: "600mg", otc: true },
  { nom: "Gyno-Pevaryl 150mg", molecule: "Éconazole vaginal", atc: "G01AF05", labo: "Johnson & Johnson", forme: "Ovule", dosage: "150mg", otc: true },

  // Compléments
  { nom: "Vitamine D3 1000UI", molecule: "Cholécalciférol", atc: "A11CC05", labo: "UPSA", forme: "Comprimé", dosage: "1000UI", otc: true },
  { nom: "Magnésium B6 48mg", molecule: "Magnésium", atc: "A12CC", labo: "Sanofi", forme: "Comprimé", dosage: "48mg", otc: true },

  // Psychiatrie / sommeil
  { nom: "Zopiclone 7.5mg", molecule: "Zopiclone", atc: "N05CF01", labo: "Biogaran", forme: "Comprimé", dosage: "7.5mg", otc: false },
  { nom: "Paroxétine 20mg", molecule: "Paroxétine", atc: "N06AB05", labo: "Biogaran", forme: "Comprimé", dosage: "20mg", otc: false },

  // Anti-inflammatoires
  { nom: "Diclofénac 50mg", molecule: "Diclofénac", atc: "M01AB05", labo: "Biogaran", forme: "Comprimé", dosage: "50mg", otc: false },
  { nom: "Kétoprofène 100mg", molecule: "Kétoprofène", atc: "M01AE03", labo: "Biogaran", forme: "Gélule", dosage: "100mg", otc: false },
  { nom: "Naproxène 550mg", molecule: "Naproxène", atc: "M01AE02", labo: "Biogaran", forme: "Comprimé", dosage: "550mg", otc: false },
  { nom: "Voltarène 75mg", molecule: "Diclofénac", atc: "M01AB05", labo: "Novartis", forme: "Comprimé", dosage: "75mg", otc: false },
  { nom: "Voltarène Emulgel 1%", molecule: "Diclofénac", atc: "M02AA15", labo: "Novartis", forme: "Gel", dosage: "1%", otc: true },
  { nom: "Flector Tissugel", molecule: "Diclofénac", atc: "M02AA15", labo: "IBSA", forme: "Patch", dosage: "140mg", otc: true },
  { nom: "Ketum gel 2.5%", molecule: "Kétoprofène", atc: "M02AA10", labo: "Ménarini", forme: "Gel", dosage: "2.5%", otc: true },

  // Anti-infectieux
  { nom: "Aciclovir 200mg", molecule: "Aciclovir", atc: "J05AB01", labo: "Biogaran", forme: "Comprimé", dosage: "200mg", otc: false },

  // Veinotoniques
  { nom: "Ginkor Fort", molecule: "Ginkgo biloba extrait", atc: "C04AX", labo: "Beaufour Ipsen", forme: "Gélule", dosage: "Ginkgo + Troxérutine", otc: true },
  { nom: "Veinamitol 3500mg", molecule: "Diosmine + Hespéridine", atc: "C05CA53", labo: "Negma", forme: "Sachet", dosage: "3500mg", otc: true },

  // Laxatifs de lest
  { nom: "Spagulax", molecule: "Ispaghul", atc: "A06AC01", labo: "Almirall", forme: "Sachet", dosage: "6.19g", otc: true },
  { nom: "Normacol", molecule: "Gomme sterculia", atc: "A06AC", labo: "Norgine", forme: "Granulé", dosage: "62%", otc: true },

  // Divers
  { nom: "Guronsan", molecule: "Gluconate de calcium", atc: "A12AA03", labo: "Bayer", forme: "Comprimé effervescent", dosage: "Vitamine C + Caféine", otc: true },

  // Pédiatrie
  { nom: "Doliprane enfant 2.4%", molecule: "Paracétamol", atc: "N02BE01", labo: "Sanofi", forme: "Suspension buvable", dosage: "2.4%", otc: true },
  { nom: "Efferalgan nourrisson 30mg/ml", molecule: "Paracétamol", atc: "N02BE01", labo: "UPSA", forme: "Solution buvable", dosage: "30mg/ml", otc: true },
  { nom: "Advil enfant 20mg/ml", molecule: "Ibuprofène", atc: "M01AE01", labo: "Pfizer", forme: "Suspension buvable", dosage: "20mg/ml", otc: true },
  { nom: "Nurofen enfant 20mg/ml", molecule: "Ibuprofène", atc: "M01AE01", labo: "Reckitt", forme: "Suspension buvable", dosage: "20mg/ml", otc: true },
  { nom: "Camilia", molecule: "Arnica montana", atc: "V03AX", labo: "Boiron", forme: "Solution buvable", dosage: "Unidoses", otc: true },

  // Anticoagulants
  { nom: "Xarelto 15mg", molecule: "Rivaroxaban", atc: "B01AF01", labo: "Bayer", forme: "Comprimé", dosage: "15mg", otc: false },

  // Antiacides / IPP
  { nom: "Inexium Control 20mg", molecule: "Ésoméprazole", atc: "A02BC05", labo: "Bayer", forme: "Comprimé", dosage: "20mg", otc: true },
  { nom: "Esoméprazole 40mg", molecule: "Ésoméprazole", atc: "A02BC05", labo: "Biogaran", forme: "Gélule", dosage: "40mg", otc: false },

  // Antiémétiques
  { nom: "Vogalène 15mg", molecule: "Métopimazine", atc: "A04AD05", labo: "Teva", forme: "Gélule", dosage: "15mg", otc: false },

  // Antiseptiques
  { nom: "Biseptine", molecule: "Chlorhexidine + Cétrimide", atc: "D08AC52", labo: "Bayer", forme: "Solution", dosage: "250ml", otc: true },
  { nom: "Bétadine 10%", molecule: "Povidone iodée", atc: "D08AG02", labo: "Viatris", forme: "Solution", dosage: "10%", otc: true },
  { nom: "Éosine aqueuse 2%", molecule: "Éosine aqueuse", atc: "D08AX", labo: "Gilbert", forme: "Solution", dosage: "2%", otc: true },

  // Probiotiques
  { nom: "Ultra Levure 200mg", molecule: "Saccharomyces boulardii", atc: "A07FA02", labo: "Biocodex", forme: "Gélule", dosage: "200mg", otc: true },

  // Migraine
  { nom: "Sumatriptan 50mg", molecule: "Sumatriptan", atc: "N02CC01", labo: "Biogaran", forme: "Comprimé", dosage: "50mg", otc: false },
  { nom: "Zomig 2.5mg", molecule: "Zolmitriptan", atc: "N02CC03", labo: "AstraZeneca", forme: "Comprimé", dosage: "2.5mg", otc: false },

  // Corticoïdes
  { nom: "Prednisolone 20mg", molecule: "Prednisolone", atc: "H02AB06", labo: "Sanofi", forme: "Comprimé", dosage: "20mg", otc: false },
  { nom: "Cortancyl 5mg", molecule: "Prednisone", atc: "H02AB07", labo: "Sanofi", forme: "Comprimé", dosage: "5mg", otc: false },

  // Urologie
  { nom: "Tamsulosine 0.4mg", molecule: "Tamsulosine", atc: "G04CA02", labo: "Biogaran", forme: "Gélule", dosage: "0.4mg", otc: false },
  { nom: "Permixon 160mg", molecule: "Serenoa repens", atc: "G04CX02", labo: "Pierre Fabre", forme: "Gélule", dosage: "160mg", otc: false },

  // ORL antiseptiques
  { nom: "Hexalyse", molecule: "Biclotymol + Lysozyme", atc: "R02AA", labo: "Bouchara", forme: "Comprimé à sucer", dosage: "5mg", otc: true },
  { nom: "Sinuspax", molecule: "Soufre colloïdal", atc: "R01AX", labo: "Lehning", forme: "Comprimé", dosage: "Homéopathie", otc: true },

  // Anti-nausée
  { nom: "Nautamine 90mg", molecule: "Diménhydrinate", atc: "R06AA52", labo: "Pfizer", forme: "Comprimé", dosage: "90mg", otc: true },

  // Anti-allergiques
  { nom: "Kétotifène 1mg", molecule: "Kétotifène", atc: "R06AX17", labo: "Biogaran", forme: "Comprimé", dosage: "1mg", otc: false },

  // Buccal
  { nom: "Dolodent", molecule: "Lidocaïne topique buccale", atc: "A01AD11", labo: "Viatris", forme: "Gel gingival", dosage: "Lidocaïne", otc: true },
  { nom: "Pansoral", molecule: "Trimebutine topique buccale", atc: "A01AD", labo: "Pierre Fabre", forme: "Gel buccal", dosage: "15ml", otc: true },

  // Compléments fréquents
  { nom: "Acide folique 5mg", molecule: "Acide folique", atc: "B03BB01", labo: "CCD", forme: "Comprimé", dosage: "5mg", otc: false },
  { nom: "Tardyferon B9", molecule: "Fer (sulfate ferreux)", atc: "B03AA07", labo: "Pierre Fabre", forme: "Comprimé", dosage: "50mg Fe + Acide folique", otc: false },
  { nom: "Vitamine B12 1000µg", molecule: "Cyanocobalamine", atc: "B03BA01", labo: "Gerda", forme: "Comprimé", dosage: "1000µg", otc: true },

  // Contraception
  { nom: "Microval", molecule: "Lévonorgestrel seul", atc: "G03AC03", labo: "Pfizer", forme: "Comprimé", dosage: "0.03mg", otc: false },
  { nom: "Optilova", molecule: "Éthinylestradiol + Désogestrel", atc: "G03AA09", labo: "Majorelle", forme: "Comprimé", dosage: "20µg/150µg", otc: false },

  // Vaccins
  { nom: "Influvac Tetra", molecule: "Vaccin grippe", atc: "J07BB02", labo: "Abbott", forme: "Suspension injectable", dosage: "0.5ml", otc: false },
  { nom: "Gardasil 9", molecule: "Vaccin HPV", atc: "J07BM01", labo: "MSD", forme: "Suspension injectable", dosage: "0.5ml", otc: false },

  // Divers
  { nom: "Exacyl 1g", molecule: "Acide tranexamique", atc: "B02AA02", labo: "Sanofi", forme: "Comprimé", dosage: "1g", otc: false },
  { nom: "Sérum physiologique unidoses", molecule: "Chlorure de sodium isotonique", atc: "B05BB01", labo: "Gilbert", forme: "Unidoses", dosage: "5ml", otc: true },

  // Oméprazole générique
  { nom: "Oméprazole générique 20mg", molecule: "Oméprazole", atc: "A02BC01", labo: "Biogaran", forme: "Gélule", dosage: "20mg", otc: false },
];

// ─── PATHOLOGIES MANQUANTES ──────────────────────────────────────
const PATHOLOGIES = [
  { nom: "Douleur dentaire", categorie: "Stomatologie", gravite: 2, desc: "Douleur d'origine dentaire ou gingivale" },
  { nom: "Vaccination", categorie: "Prévention", gravite: 0, desc: "Prévention par vaccination" },
  { nom: "Troubles prostatiques", categorie: "Urologie", gravite: 2, desc: "Hypertrophie bénigne de la prostate, troubles mictionnels" },
  { nom: "Rétention hydrique", categorie: "Cardiologie", gravite: 2, desc: "Œdème par rétention d'eau" },
  { nom: "Carence en acide folique", categorie: "Hématologie", gravite: 1, desc: "Déficit en vitamine B9" },
];

// ─── PATHOLOGY → PRODUITS COMPLÉMENTAIRES ──────────────────────
const PATHO_PRODUITS: Record<string, { produit: string; categorie: string; desc: string; type: string; prio: number }[]> = {
  "Douleur dentaire": [
    { produit: "Bain de bouche antiseptique", categorie: "Hygiène buccale", desc: "Chlorhexidine 0.12% pour réduire l'infection", type: "produit_conseil", prio: 90 },
    { produit: "Gel gingival Pansoral", categorie: "Antalgique local", desc: "Soulagement local de la douleur gingivale", type: "produit_conseil", prio: 85 },
    { produit: "Clou de girofle HE", categorie: "Antalgique naturel", desc: "Eugénol analgésique dentaire traditionnel", type: "complement", prio: 70 },
  ],
  "Troubles prostatiques": [
    { produit: "Palmier nain 320mg", categorie: "Phytothérapie", desc: "Serenoa repens pour le confort urinaire", type: "complement", prio: 85 },
    { produit: "Zinc 15mg", categorie: "Oligo-éléments", desc: "Soutien de la fonction prostatique", type: "complement", prio: 75 },
    { produit: "Graines de courge", categorie: "Phytothérapie", desc: "Confort urinaire masculin", type: "complement", prio: 70 },
  ],
  "Migraine": [
    { produit: "Roll-on menthe poivrée", categorie: "Aromathérapie", desc: "Huile essentielle apaisante en application locale", type: "produit_conseil", prio: 85 },
    { produit: "Magnésium bisglycinate 300mg", categorie: "Prévention", desc: "Réduit la fréquence des migraines", type: "complement", prio: 90 },
    { produit: "Lunettes anti-lumière bleue", categorie: "Prévention", desc: "Réduction de la fatigue visuelle déclencheuse", type: "produit_conseil", prio: 65 },
  ],
  "Vaccination": [
    { produit: "Poche de froid", categorie: "Confort", desc: "Soulage la douleur au point d'injection", type: "produit_conseil", prio: 80 },
    { produit: "Arnica gel", categorie: "Antalgique local", desc: "Réduit ecchymose et douleur locale", type: "produit_conseil", prio: 75 },
  ],
  "Rétention hydrique": [
    { produit: "Piloselle extrait", categorie: "Drainage", desc: "Diurétique naturel doux", type: "complement", prio: 80 },
    { produit: "Queue de cerise tisane", categorie: "Drainage", desc: "Favorise l'élimination rénale", type: "complement", prio: 75 },
    { produit: "Bas de contention classe 2", categorie: "Dispositif", desc: "Réduction des œdèmes des membres inférieurs", type: "dispositif_medical", prio: 85 },
  ],
  "Carence en acide folique": [
    { produit: "Levure de bière", categorie: "Complément", desc: "Source naturelle de vitamines B", type: "complement", prio: 75 },
    { produit: "Spiruline bio", categorie: "Super-aliment", desc: "Riche en fer et vitamines B", type: "complement", prio: 70 },
  ],
};

// ─── MED → PATHOLOGY LINKS ──────────────────────────────────────
const MED_PATHO: Record<string, string[]> = {
  "Spifen 400mg": ["Douleur modérée", "Fièvre", "Douleur articulaire", "Inflammation"],
  "Aspégic 1000mg": ["Douleur modérée", "Fièvre", "Céphalées"],
  "Aspégic nourrisson 100mg": ["Fièvre"],
  "Codoliprane": ["Douleur modérée", "Lombalgie"],
  "Tramadol/Paracétamol 37.5/325mg": ["Douleur modérée", "Lombalgie", "Douleur articulaire"],
  "Paracétamol générique 1g": ["Douleur légère", "Fièvre", "Céphalées"],
  "Ibuprofène générique 400mg": ["Douleur modérée", "Fièvre", "Inflammation"],
  "Cefpodoxime 100mg": ["Infection bactérienne", "Otite", "Sinusite", "Infection urinaire"],
  "Oroken 200mg": ["Infection urinaire", "Infection bactérienne"],
  "Doxycycline 100mg": ["Infection bactérienne", "Acné"],
  "Zeclar 500mg": ["Infection bactérienne", "Sinusite", "Otite"],
  "Oflocet 200mg": ["Infection urinaire", "Infection bactérienne"],
  "Ciflox 500mg": ["Infection urinaire", "Infection bactérienne"],
  "Monuril 3g": ["Infection urinaire", "Cystite"],
  "Pyostacine 500mg": ["Infection bactérienne", "Sinusite", "Angine"],
  "Amoxicilline générique 1g": ["Infection bactérienne", "Otite", "Sinusite", "Angine"],
  "Dolirhume": ["Rhinopharyngite", "Congestion nasale", "Rhume"],
  "Helicidine sirop": ["Toux sèche"],
  "Acétylcystéine 200mg": ["Toux productive", "Bronchite aiguë"],
  "Carbocistéine sirop": ["Toux productive", "Bronchite aiguë"],
  "Physiomer spray nasal": ["Rhinite aiguë", "Congestion nasale", "Rhinopharyngite"],
  "Cétirizine 10mg": ["Allergie saisonnière", "Urticaire", "Rhinite allergique"],
  "Loratadine 10mg": ["Allergie saisonnière", "Urticaire", "Rhinite allergique"],
  "Desloratadine 5mg": ["Allergie saisonnière", "Urticaire", "Rhinite allergique"],
  "Polaramine 2mg": ["Allergie saisonnière", "Urticaire"],
  "Telfast 180mg": ["Allergie saisonnière", "Urticaire"],
  "Xyzall 5mg": ["Allergie saisonnière", "Urticaire", "Rhinite allergique"],
  "Oméprazole 20mg": ["Brûlures d estomac", "Reflux gastro-œsophagien", "Gastrite"],
  "Phosphalugel": ["Brûlures d estomac", "Gastrite"],
  "Diosmectite 3g": ["Diarrhée aiguë", "Gastro-entérite"],
  "Movicol": ["Constipation"],
  "Macrogol 4000 10g": ["Constipation"],
  "Dulcolax 5mg": ["Constipation"],
  "Lansoyl gel oral": ["Constipation"],
  "Microlax": ["Constipation"],
  "Amlodipine 5mg": ["Hypertension artérielle"],
  "Amlodipine générique 10mg": ["Hypertension artérielle"],
  "Bisoprolol 5mg": ["Hypertension artérielle", "Insuffisance cardiaque"],
  "Ramipril 5mg": ["Hypertension artérielle", "Insuffisance cardiaque"],
  "Enalapril 20mg": ["Hypertension artérielle"],
  "Simvastatine 20mg": ["Hypercholestérolémie"],
  "Atorvastatine générique 20mg": ["Hypercholestérolémie"],
  "Furosémide 40mg": ["Insuffisance cardiaque", "Rétention hydrique", "Oedème"],
  "Metformine 1000mg": ["Diabète type 2"],
  "Metformine générique 850mg": ["Diabète type 2"],
  "L-Thyroxine Henning 100µg": ["Hypothyroïdie"],
  "Cicatridine ovules": ["Sécheresse vaginale"],
  "Mycohydralin 500mg": ["Candidose vaginale", "Mycose cutanée"],
  "Lomexin 600mg": ["Candidose vaginale"],
  "Econazole crème 1%": ["Mycose cutanée", "Onychomycose"],
  "Fucidine crème 2%": ["Impétigo", "Infection bactérienne"],
  "Biafine émulsion": ["Brûlure légère", "Coup de soleil"],
  "Atoderm crème": ["Sécheresse cutanée", "Eczéma"],
  "Lipikar baume AP+M": ["Sécheresse cutanée", "Eczéma"],
  "Dacryum": ["Sécheresse oculaire", "Conjonctivite bactérienne"],
  "Sterdex": ["Conjonctivite bactérienne", "Blépharite"],
  "Optrex collyre": ["Sécheresse oculaire"],
  "Monazol ovule": ["Candidose vaginale"],
  "Lomexin ovule 600mg": ["Candidose vaginale"],
  "Gyno-Pevaryl 150mg": ["Candidose vaginale"],
  "Vitamine D3 1000UI": ["Carence en vitamine D"],
  "Magnésium B6 48mg": ["Crampes musculaires", "Fatigue", "Anxiété légère"],
  "Zopiclone 7.5mg": ["Insomnie"],
  "Paroxétine 20mg": ["Dépression", "Anxiété"],
  "Diclofénac 50mg": ["Douleur modérée", "Inflammation", "Douleur articulaire"],
  "Kétoprofène 100mg": ["Douleur modérée", "Inflammation"],
  "Naproxène 550mg": ["Douleur modérée", "Inflammation", "Douleur articulaire"],
  "Voltarène 75mg": ["Douleur modérée", "Inflammation"],
  "Voltarène Emulgel 1%": ["Douleur articulaire", "Entorse", "Douleur musculaire"],
  "Flector Tissugel": ["Douleur articulaire", "Entorse", "Douleur musculaire"],
  "Ketum gel 2.5%": ["Douleur articulaire", "Entorse", "Douleur musculaire"],
  "Aciclovir 200mg": ["Herpès labial", "Zona"],
  "Ginkor Fort": ["Insuffisance veineuse", "Jambes lourdes", "Hémorroïdes"],
  "Veinamitol 3500mg": ["Insuffisance veineuse", "Jambes lourdes"],
  "Spagulax": ["Constipation"],
  "Normacol": ["Constipation"],
  "Guronsan": ["Fatigue", "Convalescence"],
  "Doliprane enfant 2.4%": ["Fièvre", "Douleur légère"],
  "Efferalgan nourrisson 30mg/ml": ["Fièvre", "Douleur légère"],
  "Advil enfant 20mg/ml": ["Fièvre", "Douleur légère", "Inflammation"],
  "Nurofen enfant 20mg/ml": ["Fièvre", "Douleur légère", "Inflammation"],
  "Camilia": ["Poussées dentaires"],
  "Xarelto 15mg": ["Fibrillation auriculaire", "Thrombose veineuse"],
  "Inexium Control 20mg": ["Brûlures d estomac", "Reflux gastro-œsophagien"],
  "Esoméprazole 40mg": ["Brûlures d estomac", "Reflux gastro-œsophagien", "Gastrite"],
  "Vogalène 15mg": ["Nausées", "Vomissements"],
  "Biseptine": ["Plaie superficielle"],
  "Bétadine 10%": ["Plaie superficielle"],
  "Éosine aqueuse 2%": ["Plaie superficielle", "Érythème fessier"],
  "Ultra Levure 200mg": ["Diarrhée aiguë", "Dysbiose intestinale"],
  "Sumatriptan 50mg": ["Migraine"],
  "Zomig 2.5mg": ["Migraine"],
  "Prednisolone 20mg": ["Inflammation", "Allergie saisonnière", "Asthme"],
  "Cortancyl 5mg": ["Inflammation", "Allergie saisonnière"],
  "Tamsulosine 0.4mg": ["Troubles prostatiques", "Hypertrophie bénigne de la prostate"],
  "Permixon 160mg": ["Troubles prostatiques", "Hypertrophie bénigne de la prostate"],
  "Hexalyse": ["Maux de gorge", "Angine"],
  "Sinuspax": ["Sinusite", "Congestion nasale"],
  "Nautamine 90mg": ["Mal des transports", "Nausées"],
  "Kétotifène 1mg": ["Allergie saisonnière", "Asthme"],
  "Dolodent": ["Douleur dentaire", "Poussées dentaires"],
  "Pansoral": ["Douleur dentaire", "Aphtes"],
  "Acide folique 5mg": ["Carence en acide folique", "Grossesse complémentation"],
  "Tardyferon B9": ["Anémie ferriprive", "Carence en fer", "Grossesse complémentation"],
  "Vitamine B12 1000µg": ["Carence en vitamine B12", "Fatigue"],
  "Microval": ["Contraception"],
  "Optilova": ["Contraception"],
  "Influvac Tetra": ["Vaccination"],
  "Gardasil 9": ["Vaccination"],
  "Exacyl 1g": ["Hémorragies"],
  "Sérum physiologique unidoses": ["Rhinopharyngite", "Rhinite aiguë"],
  "Furosémide 40mg": ["Rétention hydrique", "Insuffisance cardiaque", "Oedème"],
  "Oméprazole générique 20mg": ["Brûlures d estomac", "Reflux gastro-œsophagien", "Gastrite"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Admin auth guard ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminCheckClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminCheckClient.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stats = {
      molecules_created: 0,
      medicaments_created: 0,
      pathologies_created: 0,
      produits_created: 0,
      links_created: 0,
      protocoles_created: 0,
      errors: [] as string[],
    };

    // ── 1. Load existing maps ──
    const moleculeMap: Record<string, string> = {};
    const { data: existMols } = await supabase.from("molecules").select("id, nom_molecule");
    for (const m of existMols || []) moleculeMap[m.nom_molecule] = m.id;

    const pathoMap: Record<string, string> = {};
    const { data: existPathos } = await supabase.from("pathologies").select("id, nom_pathologie");
    for (const p of existPathos || []) pathoMap[p.nom_pathologie] = p.id;

    // ── 2. Insert molecules ──
    for (const mol of MOLECULES) {
      if (moleculeMap[mol.nom]) continue;
      const { data, error } = await supabase.from("molecules").insert({
        nom_molecule: mol.nom,
        atc_code: mol.atc,
        classe_therapeutique: mol.classe,
      }).select("id").single();
      if (data) { moleculeMap[mol.nom] = data.id; stats.molecules_created++; }
      if (error) stats.errors.push(`Mol ${mol.nom}: ${error.message}`);
    }

    // ── 3. Insert pathologies ──
    for (const patho of PATHOLOGIES) {
      if (pathoMap[patho.nom]) continue;
      const { data, error } = await supabase.from("pathologies").insert({
        nom_pathologie: patho.nom,
        categorie: patho.categorie,
        niveau_gravite: patho.gravite,
        description: patho.desc,
      }).select("id").single();
      if (data) { pathoMap[patho.nom] = data.id; stats.pathologies_created++; }
      if (error) stats.errors.push(`Patho ${patho.nom}: ${error.message}`);
    }

    // ── 4. Insert produits complémentaires + protocoles ──
    for (const [pathoName, produits] of Object.entries(PATHO_PRODUITS)) {
      const pathoId = pathoMap[pathoName];
      if (!pathoId) continue;

      const { data: existProds } = await supabase
        .from("produits_complementaires").select("produit").eq("pathologie_id", pathoId);
      const existSet = new Set((existProds || []).map(p => p.produit));

      const produitIds: string[] = [];
      for (const prod of produits) {
        if (existSet.has(prod.produit)) continue;
        const { data, error } = await supabase.from("produits_complementaires").insert({
          produit: prod.produit,
          categorie: prod.categorie,
          description: prod.desc,
          type_produit: prod.type,
          priorite: prod.prio,
          pathologie_id: pathoId,
          est_otc: prod.type === "produit_conseil",
          est_complement: prod.type === "complement",
          est_dispositif_medical: prod.type === "dispositif_medical",
          est_eligible_cross_sell: true,
        }).select("id").single();
        if (data) { produitIds.push(data.id); stats.produits_created++; }
        if (error) stats.errors.push(`Prod ${prod.produit}: ${error.message}`);
      }

      // Create conseils if missing
      const conseilIds: string[] = [];
      const { data: existConseils } = await supabase
        .from("conseils_associes").select("id").eq("pathologie_id", pathoId);
      if (!existConseils || existConseils.length === 0) {
        const templates = [
          { code: `CONSEIL_${pathoName.toUpperCase().replace(/\s/g, "_")}_1`, label: "Conseil hygiéno-diététique", desc: `Mesures pour ${pathoName.toLowerCase()}` },
          { code: `CONSEIL_${pathoName.toUpperCase().replace(/\s/g, "_")}_2`, label: "Suivi et surveillance", desc: `Quand reconsulter pour ${pathoName.toLowerCase()}` },
        ];
        for (const c of templates) {
          const { data } = await supabase.from("conseils_associes").insert({
            pathologie_id: pathoId, conseil: c.label, description: c.desc, conseil_code: c.code, priorite: 80,
          }).select("id").single();
          if (data) conseilIds.push(data.id);
        }
      } else {
        for (const c of existConseils) conseilIds.push(c.id);
      }

      // Create protocole if needed
      if (conseilIds.length >= 2 && produitIds.length >= 3) {
        const { data: existProto } = await supabase
          .from("protocole_pathologie").select("id").eq("pathologie_id", pathoId).eq("actif", true).limit(1);
        if (!existProto || existProto.length === 0) {
          const { error } = await supabase.from("protocole_pathologie").insert({
            pathologie_id: pathoId,
            conseil_1_id: conseilIds[0], conseil_2_id: conseilIds[1],
            produit_complementaire_1_id: produitIds[0],
            produit_complementaire_2_id: produitIds[1],
            produit_complementaire_3_id: produitIds[2],
            actif: true, version_protocole: 1,
          });
          if (!error) stats.protocoles_created++;
          else stats.errors.push(`Proto ${pathoName}: ${error.message}`);
        }
      }
    }

    // ── 5. Insert medicaments + links ──
    for (const med of MEDICAMENTS) {
      const { data: existing } = await supabase
        .from("medicaments").select("id").eq("nom_commercial", med.nom).limit(1);
      if (existing && existing.length > 0) {
        // Still ensure links exist
        const medId = existing[0].id;
        const pathologies = MED_PATHO[med.nom] || [];
        for (const pathoName of pathologies) {
          const pathoId = pathoMap[pathoName];
          if (!pathoId) continue;
          const { data: existLink } = await supabase
            .from("medicament_pathologie").select("id")
            .eq("medicament_id", medId).eq("pathologie_id", pathoId).limit(1);
          if (!existLink || existLink.length === 0) {
            const { error } = await supabase.from("medicament_pathologie").insert({
              medicament_id: medId, pathologie_id: pathoId,
              score_pertinence: 80, source_mapping: "seed_all_missing",
            });
            if (!error) stats.links_created++;
          }
        }
        continue;
      }

      const moleculeId = moleculeMap[med.molecule] || null;
      const { data, error } = await supabase.from("medicaments").insert({
        nom_commercial: med.nom,
        molecule_id: moleculeId,
        atc_code: med.atc,
        laboratoire: med.labo,
        forme_galenique: med.forme,
        dosage: med.dosage,
        est_otc: med.otc,
        est_produit_conseil: med.otc,
        statut_officine: "actif",
      }).select("id").single();

      if (data) {
        stats.medicaments_created++;
        const pathologies = MED_PATHO[med.nom] || [];
        for (const pathoName of pathologies) {
          const pathoId = pathoMap[pathoName];
          if (!pathoId) { stats.errors.push(`Patho not found: ${pathoName}`); continue; }
          const { error: linkError } = await supabase.from("medicament_pathologie").insert({
            medicament_id: data.id, pathologie_id: pathoId,
            score_pertinence: 80, source_mapping: "seed_all_missing",
          });
          if (!linkError) stats.links_created++;
          else stats.errors.push(`Link ${med.nom}→${pathoName}: ${linkError.message}`);
        }
      }
      if (error) stats.errors.push(`Med ${med.nom}: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Seed terminé: ${stats.medicaments_created} médicaments, ${stats.molecules_created} molécules, ${stats.pathologies_created} pathologies, ${stats.produits_created} produits, ${stats.links_created} liens, ${stats.protocoles_created} protocoles`,
      stats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
