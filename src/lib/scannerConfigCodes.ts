/**
 * Configuration "clean install" pour les familles de douchettes les plus
 * répandues en officine française.
 *
 * IMPORTANT — cadrage honnête :
 *   Asclion capture les scans via 6 chemins parallèles passifs (Raw Input
 *   N-API, PowerShell Raw Input fallback, uiohook, node-hid, WebHID,
 *   SerialPort). Le scanner peut rester dans son mode USB-Keyboard par
 *   défaut : aucune reconfiguration n'est requise dans 95% des cas.
 *
 *   Ce guide sert à RÉINITIALISER une douchette mal configurée et à
 *   garantir le clavier FR-AZERTY (sinon les chiffres EAN-13 sortent en
 *   "&é\"'(-è_çà" — voir le bug commenté dans useBarcodeScanner.ts).
 *
 *   Deux formats de barcodes supportés :
 *     - "code128" : commande ASCII générée à la volée (Honeywell PAP).
 *                   Commandes vérifiées via la doc Honeywell EZConfig et
 *                   l'analyse USB de s3lph.me/configuration-of-honeywell.
 *     - "image"   : PNG officiel à déposer dans /public/scanner-codes/{slug}/
 *                   (les codes Datalogic/Zebra/Newland sont propriétaires
 *                   et non régénérables à partir d'une chaîne ASCII).
 *
 *   Workflow d'enrichissement : à chaque 1ère installation sur un modèle
 *   "manual", capturer les codes depuis le PDF officiel (lien fourni), les
 *   déposer dans le dossier indiqué, pousser sur Git → tous les comptes en
 *   bénéficient.
 */

export type BarcodeFormat = "code128" | "image";

export interface ScannerStep {
  order: number;
  title: string;
  description: string;
  format: BarcodeFormat;
  /** Pour format="code128" : la chaîne ASCII à encoder. */
  payload?: string;
  /** Pour format="image" : nom du fichier dans /public/scanner-codes/{slug}/. */
  imageFile?: string;
}

export interface ScannerFamily {
  /** Identifiant stable pour le routing et le dossier d'images. */
  slug: string;
  brand: string;
  /** Nom de la famille (couvre plusieurs modèles avec mêmes codes). */
  familyName: string;
  /** Liste explicite des modèles compatibles. */
  models: string[];
  /** Part de marché estimée en officine française. */
  marketShare?: string;
  /** Statut : verified = testé en officine, beta = à valider sur place. */
  status: "verified" | "beta" | "manual";
  shortDesc: string;
  manualUrl: string;
  manualPage?: number;
  steps: ScannerStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Honeywell — commandes PAP-format ASCII confirmées via reverse-engineering USB
// (s3lph.me/configuration-of-honeywell-barcode-scanners) + doc EZConfig.
// Toutes les douchettes Honeywell General Purpose (Xenon, Voyager, Hyperion,
// Genesis, Vuquest, Eclipse) partagent ce langage de configuration.
// ─────────────────────────────────────────────────────────────────────────────

const HW_DEFOVR: ScannerStep = {
  order: 1,
  title: "Override defaults (DEFOVR)",
  description: "Lève la protection contre les changements de config (étape obligatoire avant DEFALT sur les firmwares récents).",
  format: "code128",
  payload: "DEFOVR.",
};

const HW_DEFALT: ScannerStep = {
  order: 2,
  title: "Factory reset (DEFALT)",
  description: "Réinitialise toute la configuration. Repart d'un état connu, identique sur tous les modèles Honeywell.",
  format: "code128",
  payload: "DEFALT.",
};

const HW_KBD_FRANCE: ScannerStep = {
  order: 3,
  title: "Clavier français AZERTY (KBDCTY10)",
  description: "Sélectionne le layout France. Sans ça, les chiffres EAN-13 sortent en \"&é\\\"'(-è_çà\" et le LGO comme Asclion deviennent inutilisables.",
  format: "code128",
  payload: "KBDCTY10.",
};

const HW_SAVE: ScannerStep = {
  order: 4,
  title: "Sauvegarder en mémoire douchette",
  description: "Persiste les réglages dans la flash de la douchette. Survit aux débranchements et reboots.",
  format: "code128",
  payload: "SAVE.",
};

export const SCANNER_FAMILIES: ScannerFamily[] = [
  // ── Honeywell (codes générés, prêts à l'emploi) ─────────────────────────
  {
    slug: "honeywell-general-purpose",
    brand: "Honeywell",
    familyName: "General Purpose 2D",
    models: [
      "Xenon 1900 / 1902 / 1950g / 1952g",
      "Voyager 1450g / 1452g / 1470g / 1472g",
      "Genesis XP 7680g / 7580g",
      "Vuquest 3320g / 3330g",
      "Hyperion 1300g (1D)",
      "Eclipse 5145 (1D)",
    ],
    marketShare: "~35%",
    status: "beta",
    shortDesc:
      "Toutes les douchettes Honeywell General Purpose partagent les mêmes commandes PAP en ASCII. Une seule séquence pour ~35% du parc officinal.",
    manualUrl:
      "https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/ppr/en-gb/public/products/barcode-scanners/general-purpose-handheld/1900-1902/documents/sps-ppr-xenon-1900-2-ug.pdf",
    manualPage: 18,
    steps: [HW_DEFOVR, HW_DEFALT, HW_KBD_FRANCE, HW_SAVE],
  },

  // ── Datalogic Gryphon family ────────────────────────────────────────────
  {
    slug: "datalogic-gryphon-family",
    brand: "Datalogic",
    familyName: "Gryphon family",
    models: [
      "GD4500 / GD4520 (filaire 2D)",
      "GD4220 (filaire 1D)",
      "GBT4500 (Bluetooth)",
      "GFS4500 (fixe)",
      "GM4500 / GM4100 / GM4200 (sans-fil RF)",
    ],
    marketShare: "~25%",
    status: "manual",
    shortDesc:
      "Famille Gryphon Datalogic. UN seul set de codes couvre les ~15 variantes de la famille (firmware partagé). Souvent fournie par Pharmagest/Cegedim.",
    manualUrl: "https://www.datalogic.com/upload/marketlit/manuals/gryphon/820050514.pdf",
    manualPage: 26,
    steps: [
      {
        order: 1,
        title: "Enter Programming Mode",
        description:
          "Code à capturer depuis le PDF page 26 (section 'Configuration Method'). Active le mode programmation — la LED verte de la douchette clignote.",
        format: "image",
        imageFile: "1-enter-programming.png",
      },
      {
        order: 2,
        title: "Restore Default Settings",
        description: "Réinitialise toute la config. À capturer depuis le PDF.",
        format: "image",
        imageFile: "2-restore-defaults.png",
      },
      {
        order: 3,
        title: "Country Mode : France (AZERTY)",
        description:
          "Sélectionne le layout clavier français — indispensable pour que les chiffres EAN-13 sortent correctement. Voir section 'Country Mode' du PDF.",
        format: "image",
        imageFile: "3-country-france.png",
      },
      {
        order: 4,
        title: "Exit Programming Mode",
        description: "Sauvegarde et sort du mode programmation. La LED verte arrête de clignoter.",
        format: "image",
        imageFile: "4-exit-programming.png",
      },
    ],
  },

  // ── Datalogic QuickScan family ──────────────────────────────────────────
  {
    slug: "datalogic-quickscan-family",
    brand: "Datalogic",
    familyName: "QuickScan family",
    models: [
      "QD2500 / QD2400 (filaire 2D)",
      "QD2200 (filaire 1D)",
      "QM2500 (sans-fil RF)",
      "QBT2500 (Bluetooth)",
      "QW2500 (entrée de gamme)",
    ],
    marketShare: "~8%",
    status: "manual",
    shortDesc:
      "Gamme entrée-de-gamme Datalogic. UN set de codes couvre toute la famille. Mêmes commandes que Gryphon mais codes-barres différents.",
    manualUrl: "https://www.datalogic.com/upload/marketlit/manuals/quickscan/820059405.pdf",
    manualPage: 24,
    steps: [
      {
        order: 1,
        title: "Enter Programming Mode",
        description: "Code à capturer page 24 du PRG QuickScan. LED verte clignote.",
        format: "image",
        imageFile: "1-enter-programming.png",
      },
      {
        order: 2,
        title: "Restore Default Settings",
        description: "Réinitialise toute la config. À capturer depuis le PDF.",
        format: "image",
        imageFile: "2-restore-defaults.png",
      },
      {
        order: 3,
        title: "Country Mode : France (AZERTY)",
        description: "Layout français. Section 'Country Mode' du PDF.",
        format: "image",
        imageFile: "3-country-france.png",
      },
      {
        order: 4,
        title: "Exit Programming Mode",
        description: "Sauvegarde et sort.",
        format: "image",
        imageFile: "4-exit-programming.png",
      },
    ],
  },

  // ── Zebra DS22xx family ─────────────────────────────────────────────────
  {
    slug: "zebra-ds22xx-family",
    brand: "Zebra",
    familyName: "DS22xx family",
    models: [
      "DS2208 (filaire)",
      "DS2278 (Bluetooth)",
      "DS2278-HC (Healthcare)",
      "DS2208-HC (Healthcare)",
    ],
    marketShare: "~12%",
    status: "manual",
    shortDesc:
      "Famille DS22xx Zebra. Successeur du légendaire LS2208. UN set de codes pour les 4 variantes. ⚠️ Mode 'USB CDC + HID concurrent' non garanti — vérifier sur premier poste.",
    manualUrl:
      "https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/guide/product/ds2208-prg-en.pdf",
    manualPage: 35,
    steps: [
      {
        order: 1,
        title: "Set Defaults",
        description:
          "Réinitialise la douchette. Code à capturer page 35 du Product Reference Guide DS2208. Le même code marche aussi pour DS2278.",
        format: "image",
        imageFile: "1-set-defaults.png",
      },
      {
        order: 2,
        title: "USB HID Keyboard (par défaut)",
        description:
          "Mode clavier USB. Asclion captures ces frappes via Raw Input N-API / uiohook en parallèle du LGO. Aucune config CDC nécessaire dans ce mode.",
        format: "image",
        imageFile: "2-usb-hid-keyboard.png",
      },
      {
        order: 3,
        title: "Country Code : French (AZERTY)",
        description: "Layout clavier français. Section 'Country Codes' du PRG.",
        format: "image",
        imageFile: "3-country-french.png",
      },
    ],
  },

  // ── Newland HR family ───────────────────────────────────────────────────
  {
    slug: "newland-hr-family",
    brand: "Newland",
    familyName: "HR family",
    models: [
      "HR32 Marlin (filaire 2D, milieu de gamme)",
      "HR22 Dorada (filaire 2D, économique)",
      "HR3280 Marlin II (haut de gamme)",
      "HR15 / HR11 Aringa (entrée de gamme 1D-2D)",
    ],
    marketShare: "~10%",
    status: "manual",
    shortDesc:
      "Famille HR Newland — alternative économique. UN set de codes via NLS Config Tool. Documentation moins fournie que les autres marques.",
    manualUrl: "https://www.newland-id.com/wp-content/uploads/2022/12/HR32-Marlin-User-Guide-V1.0.0.pdf",
    manualPage: 22,
    steps: [
      {
        order: 1,
        title: "Restore All Factory Defaults",
        description: "Code à capturer page 22 du User Guide HR32 (compatible HR22, HR3280, HR15).",
        format: "image",
        imageFile: "1-factory-defaults.png",
      },
      {
        order: 2,
        title: "USB HID-KBW (Keyboard Wedge)",
        description:
          "Mode clavier USB — Asclion capture les frappes en parallèle du LGO sans config supplémentaire.",
        format: "image",
        imageFile: "2-usb-hid-kbw.png",
      },
      {
        order: 3,
        title: "Keyboard Layout : France",
        description: "Layout clavier français. Section 'Keyboard Layout' du User Guide.",
        format: "image",
        imageFile: "3-keyboard-france.png",
      },
    ],
  },

  // ── Datalogic Heron HD3430 (présentation comptoir) ──────────────────────
  {
    slug: "datalogic-heron-family",
    brand: "Datalogic",
    familyName: "Heron family (présentation)",
    models: [
      "HD3430 (comptoir 2D)",
      "HD3130 (comptoir 1D)",
    ],
    marketShare: "~5%",
    status: "manual",
    shortDesc:
      "Famille Heron Datalogic — scanners de présentation fixés au comptoir. Mêmes commandes que Gryphon mais format différent.",
    manualUrl: "https://www.datalogic.com/upload/marketlit/manuals/heron/820055016.pdf",
    manualPage: 28,
    steps: [
      {
        order: 1,
        title: "Enter Programming Mode",
        description: "Code à capturer page 28 du PRG Heron.",
        format: "image",
        imageFile: "1-enter-programming.png",
      },
      {
        order: 2,
        title: "Restore Default Settings",
        description: "Réinitialise toute la config.",
        format: "image",
        imageFile: "2-restore-defaults.png",
      },
      {
        order: 3,
        title: "Country Mode : France (AZERTY)",
        description: "Layout français.",
        format: "image",
        imageFile: "3-country-france.png",
      },
      {
        order: 4,
        title: "Exit Programming Mode",
        description: "Sauvegarde et sort.",
        format: "image",
        imageFile: "4-exit-programming.png",
      },
    ],
  },
];

// Conservé pour la rétro-compatibilité avec d'éventuels imports existants.
export const SCANNER_MODELS = SCANNER_FAMILIES;

export const STATUS_LABEL: Record<ScannerFamily["status"], { label: string; tone: string }> = {
  verified: { label: "Vérifié sur place", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  beta: { label: "Commandes vérifiées, à tester 1er install", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  manual: { label: "Images PDF à capturer", tone: "bg-slate-100 text-slate-700 border-slate-200" },
};
