/**
 * Configuration "dual-output" pour les 10 modèles de douchettes les plus
 * répandus en officine française. Permet à Asclion de recevoir chaque scan
 * sans couper le flux vers le LGO.
 *
 * Deux formats de barcodes supportés :
 *   - "code128" : commande ASCII générée à la volée (Honeywell PAP-format).
 *   - "image"   : PNG officiel à déposer dans /public/scanner-codes/{slug}/
 *                 (les codes propriétaires Datalogic/Zebra/Newland ne sont
 *                 pas régénérables à partir d'une chaîne — il faut capturer
 *                 le code-barres exact depuis le PDF constructeur).
 *
 * ⚠️ AVERTISSEMENT : avant de déployer en production, valider chaque
 * séquence sur un poste de test. Une mauvaise commande PAP peut réinitialiser
 * la douchette en mode non-souhaité. Le bouton "Manuel constructeur" pointe
 * sur la page exacte du PDF officiel pour vérification.
 */

export type BarcodeFormat = "code128" | "image";

export interface ScannerStep {
  /** Numérotation affichée à l'écran (1, 2, 3…). */
  order: number;
  title: string;
  description: string;
  /** "code128" → barcode généré, "image" → PNG dans /public/scanner-codes/{slug}/. */
  format: BarcodeFormat;
  /** Pour format="code128" : la chaîne ASCII à encoder. */
  payload?: string;
  /** Pour format="image" : nom du fichier dans /public/scanner-codes/{slug}/. */
  imageFile?: string;
}

export interface ScannerModel {
  /** Identifiant unique stable pour le routing et le dossier d'images. */
  slug: string;
  brand: string;
  model: string;
  /** Part de marché estimée en officine française (informative). */
  marketShare?: string;
  /** Statut : verified = testé en officine, beta = à valider sur place. */
  status: "verified" | "beta" | "manual";
  shortDesc: string;
  manualUrl: string;
  /** Page du PDF où se trouvent les codes de configuration. */
  manualPage?: number;
  steps: ScannerStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Honeywell — commandes PAP-format documentées dans le guide EZConfig.
// Toutes les douchettes Honeywell (Voyager, Xenon, Hyperion, Genesis, Vuquest)
// partagent le même langage de configuration. Le mode "USB Composite Keyboard
// + Serial Emulation" envoie chaque scan SIMULTANÉMENT sur le clavier (LGO) et
// sur un port COM virtuel (Asclion).
// ─────────────────────────────────────────────────────────────────────────────

const HONEYWELL_RESET: ScannerStep = {
  order: 1,
  title: "Réinitialiser aux valeurs d'usine",
  description: "Repart d'une config propre, identique sur tous les modèles Honeywell.",
  format: "code128",
  payload: "DEFALT.",
};

const HONEYWELL_USB_COMPOSITE: ScannerStep = {
  order: 2,
  title: "Activer USB Composite (Keyboard + Serial)",
  description:
    "Mode où chaque scan sort sur le clavier (vers le LGO) ET sur un port COM virtuel (vers Asclion). Aucun conflit possible.",
  format: "code128",
  payload: "PAPSPP.",
};

const HONEYWELL_SAVE: ScannerStep = {
  order: 3,
  title: "Sauvegarder dans la mémoire douchette",
  description: "Persiste les réglages — la douchette gardera ce mode même après débranchement.",
  format: "code128",
  payload: "SAVE.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Datalogic / Zebra / Newland — codes propriétaires (binaire avec checksum
// constructeur). Non régénérables : il faut capturer le PNG du manuel.
// Lors de la 1ère installation sur un modèle, capturer chaque code-barres et
// déposer le PNG dans /public/scanner-codes/{slug}/{step}.png. Les emplacements
// sont prêts ; tant que le fichier n'existe pas, l'UI affichera le lien vers
// la page du manuel constructeur.
// ─────────────────────────────────────────────────────────────────────────────

export const SCANNER_MODELS: ScannerModel[] = [
  // ── Honeywell (codes générés, prêts à l'emploi) ──────────────────────────
  {
    slug: "honeywell-xenon-1900",
    brand: "Honeywell",
    model: "Xenon 1900 / 1902 / 1950g",
    marketShare: "~18%",
    status: "beta",
    shortDesc: "Imageur 2D le plus courant en officine. Codes PAP universels.",
    manualUrl: "https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/ppr/en-gb/public/products/barcode-scanners/general-purpose-handheld/1900-1902/documents/sps-ppr-xenon-1900-2-ug.pdf",
    manualPage: 18,
    steps: [HONEYWELL_RESET, HONEYWELL_USB_COMPOSITE, HONEYWELL_SAVE],
  },
  {
    slug: "honeywell-voyager-1450",
    brand: "Honeywell",
    model: "Voyager 1450g / 1452g",
    marketShare: "~12%",
    status: "beta",
    shortDesc: "Imageur 2D filaire, entrée de gamme la plus vendue. Mêmes commandes que Xenon.",
    manualUrl: "https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/ppr/en-gb/public/products/barcode-scanners/general-purpose-handheld/1450g/documents/sps-ppr-voyager-1450g-ug.pdf",
    manualPage: 18,
    steps: [HONEYWELL_RESET, HONEYWELL_USB_COMPOSITE, HONEYWELL_SAVE],
  },
  {
    slug: "honeywell-genesis-7680",
    brand: "Honeywell",
    model: "Genesis XP 7680g",
    marketShare: "~3%",
    status: "beta",
    shortDesc: "Présentation hands-free, format compact comptoir. Pousse Datamatrix pharmacie.",
    manualUrl: "https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/ppr/en-gb/public/products/barcode-scanners/general-purpose-handheld/7680g/documents/sps-ppr-genesis-xp-7680g-ug.pdf",
    manualPage: 18,
    steps: [HONEYWELL_RESET, HONEYWELL_USB_COMPOSITE, HONEYWELL_SAVE],
  },
  {
    slug: "honeywell-vuquest-3320",
    brand: "Honeywell",
    model: "Vuquest 3320g",
    marketShare: "~2%",
    status: "beta",
    shortDesc: "Imageur 2D pour comptoirs étroits. Mêmes commandes que la série Xenon.",
    manualUrl: "https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/ppr/en-gb/public/products/barcode-scanners/general-purpose-handheld/3320g/documents/sps-ppr-vuquest-3320g-ug.pdf",
    manualPage: 18,
    steps: [HONEYWELL_RESET, HONEYWELL_USB_COMPOSITE, HONEYWELL_SAVE],
  },

  // ── Datalogic (PNG à capturer depuis manuel — codes propriétaires) ────────
  {
    slug: "datalogic-gryphon-gd4500",
    brand: "Datalogic",
    model: "Gryphon GD4500 / GD4520",
    marketShare: "~20%",
    status: "manual",
    shortDesc: "Famille Gryphon (filaire). Souvent fournie par Pharmagest/Cegedim. Multi-Interface natif.",
    manualUrl: "https://www.datalogic.com/upload/marketlit/manuals/gryphon/820050514.pdf",
    manualPage: 26,
    steps: [
      {
        order: 1,
        title: "Restore Default Settings",
        description: "Aladdin software → 'Restore Default Settings'. Code à capturer depuis le PDF manuel page 26.",
        format: "image",
        imageFile: "1-restore-defaults.png",
      },
      {
        order: 2,
        title: "Set Interface : USB-COM",
        description: "Mode USB virtual COM port. Capturer code depuis le PDF manuel.",
        format: "image",
        imageFile: "2-usb-com.png",
      },
      {
        order: 3,
        title: "Enable Keyboard Wedge Concurrent",
        description: "Active l'émission simultanée vers le clavier (LGO). Capturer code depuis le PDF.",
        format: "image",
        imageFile: "3-keyboard-wedge-concurrent.png",
      },
    ],
  },
  {
    slug: "datalogic-quickscan-qd2500",
    brand: "Datalogic",
    model: "QuickScan QD2500 / QD2200",
    marketShare: "~5%",
    status: "manual",
    shortDesc: "Gamme entrée-de-gamme Datalogic. Même langage de config que Gryphon.",
    manualUrl: "https://www.datalogic.com/upload/marketlit/manuals/quickscan/820059405.pdf",
    manualPage: 24,
    steps: [
      {
        order: 1,
        title: "Restore Default Settings",
        description: "Capturer le code-barres depuis le PDF page 24.",
        format: "image",
        imageFile: "1-restore-defaults.png",
      },
      {
        order: 2,
        title: "Set Interface : USB-COM",
        description: "Mode COM virtuel. Capturer code depuis le PDF.",
        format: "image",
        imageFile: "2-usb-com.png",
      },
      {
        order: 3,
        title: "Enable Keyboard Wedge Concurrent",
        description: "Émission simultanée clavier + COM. Capturer code depuis le PDF.",
        format: "image",
        imageFile: "3-keyboard-wedge-concurrent.png",
      },
    ],
  },

  // ── Zebra / Symbol (PNG à capturer — codes 123Scan) ──────────────────────
  {
    slug: "zebra-ds2208",
    brand: "Zebra",
    model: "DS2208",
    marketShare: "~8%",
    status: "manual",
    shortDesc: "Imageur 2D filaire. Successeur du LS2208. Config via 123Scan ou codes du manuel.",
    manualUrl: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/manuals/barcode-scanners/ds2208/ds2208-prg-en.pdf",
    manualPage: 35,
    steps: [
      {
        order: 1,
        title: "Set Defaults",
        description: "Réinitialise la douchette. Code à capturer page 35 du Product Reference Guide.",
        format: "image",
        imageFile: "1-set-defaults.png",
      },
      {
        order: 2,
        title: "USB CDC Host",
        description: "Mode COM virtuel — Asclion lit ce port. Capturer depuis section USB Host Types.",
        format: "image",
        imageFile: "2-usb-cdc-host.png",
      },
      {
        order: 3,
        title: "USB Keyboard HID — Concurrent",
        description: "Active la sortie clavier en parallèle pour le LGO. Capturer depuis le PDF.",
        format: "image",
        imageFile: "3-usb-hid-concurrent.png",
      },
    ],
  },
  {
    slug: "zebra-ds2278",
    brand: "Zebra",
    model: "DS2278 (sans fil Bluetooth)",
    marketShare: "~5%",
    status: "manual",
    shortDesc: "Version Bluetooth du DS2208. Cradle USB + scanner sans fil. Mêmes codes que DS2208.",
    manualUrl: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/manuals/barcode-scanners/ds2278/ds2278-prg-en.pdf",
    manualPage: 37,
    steps: [
      {
        order: 1,
        title: "Set Defaults",
        description: "Réinitialise scanner + cradle. Capturer page 37.",
        format: "image",
        imageFile: "1-set-defaults.png",
      },
      {
        order: 2,
        title: "USB CDC Host",
        description: "Mode COM virtuel via le cradle. Capturer depuis le PDF.",
        format: "image",
        imageFile: "2-usb-cdc-host.png",
      },
      {
        order: 3,
        title: "USB Keyboard HID — Concurrent",
        description: "Sortie clavier parallèle. Capturer depuis le PDF.",
        format: "image",
        imageFile: "3-usb-hid-concurrent.png",
      },
    ],
  },

  // ── Newland (PNG à capturer — codes propriétaires) ───────────────────────
  {
    slug: "newland-hr32",
    brand: "Newland",
    model: "HR32 Marlin",
    marketShare: "~6%",
    status: "manual",
    shortDesc: "Imageur 2D filaire, alternative économique aux Honeywell. Multi-interface.",
    manualUrl: "https://www.newland-id.com/wp-content/uploads/2022/12/HR32-Marlin-User-Guide-V1.0.0.pdf",
    manualPage: 22,
    steps: [
      {
        order: 1,
        title: "Restore All Factory Defaults",
        description: "Code à capturer page 22 du User Guide.",
        format: "image",
        imageFile: "1-factory-defaults.png",
      },
      {
        order: 2,
        title: "USB COM Port Emulation",
        description: "Mode COM virtuel. Capturer depuis le PDF.",
        format: "image",
        imageFile: "2-usb-com-port.png",
      },
      {
        order: 3,
        title: "Enable HID-Keyboard Concurrent",
        description: "Sortie clavier en parallèle pour le LGO. Capturer depuis le PDF.",
        format: "image",
        imageFile: "3-hid-keyboard-concurrent.png",
      },
    ],
  },
  {
    slug: "newland-hr22",
    brand: "Newland",
    model: "HR22 Dorada",
    marketShare: "~3%",
    status: "manual",
    shortDesc: "Imageur 2D compact économique. Mêmes principes que HR32.",
    manualUrl: "https://www.newland-id.com/wp-content/uploads/2021/10/HR22-Dorada-User-Guide-V1.0.0.pdf",
    manualPage: 21,
    steps: [
      {
        order: 1,
        title: "Restore All Factory Defaults",
        description: "Code à capturer page 21 du User Guide.",
        format: "image",
        imageFile: "1-factory-defaults.png",
      },
      {
        order: 2,
        title: "USB COM Port Emulation",
        description: "Mode COM virtuel. Capturer depuis le PDF.",
        format: "image",
        imageFile: "2-usb-com-port.png",
      },
      {
        order: 3,
        title: "Enable HID-Keyboard Concurrent",
        description: "Sortie clavier parallèle. Capturer depuis le PDF.",
        format: "image",
        imageFile: "3-hid-keyboard-concurrent.png",
      },
    ],
  },
];

export const STATUS_LABEL: Record<ScannerModel["status"], { label: string; tone: string }> = {
  verified: { label: "Vérifié sur place", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  beta: { label: "À valider 1ère install", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  manual: { label: "Image PDF à capturer", tone: "bg-slate-100 text-slate-700 border-slate-200" },
};
