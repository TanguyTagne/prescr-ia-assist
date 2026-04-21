export type LgoType = "winpharma" | "lgpi" | "smart_rx" | "leo" | "pharmagest" | "autre";

export type WidgetPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "right-center";

export interface LgoPreset {
  position: WidgetPosition;
  width: number;
  height: number;
  label: string;
}

export const LGO_PRESETS: Record<LgoType, LgoPreset> = {
  winpharma: {
    position: "top-right",
    width: 320,
    height: 200,
    label: "Winpharma",
  },
  lgpi: {
    position: "bottom-right",
    width: 280,
    height: 240,
    label: "id. / LGPI",
  },
  smart_rx: {
    position: "top-left",
    width: 300,
    height: 180,
    label: "Smart Rx",
  },
  leo: {
    position: "right-center",
    width: 260,
    height: 320,
    label: "LEO Officine",
  },
  pharmagest: {
    position: "bottom-left",
    width: 300,
    height: 200,
    label: "Pharmagest Crystal",
  },
  autre: {
    position: "bottom-right",
    width: 320,
    height: 480,
    label: "Standard",
  },
};

/**
 * Returns Tailwind classes positioning a `fixed` element based on a preset position.
 * The trigger button stays in bottom-right; this is for the modal panel.
 * Bottom-right position uses bottom-[4.5rem] to leave room for the trigger button.
 */
export const getPresetClasses = (position: WidgetPosition): string => {
  switch (position) {
    case "top-left":
      return "top-4 left-4";
    case "top-right":
      return "top-4 right-4";
    case "bottom-left":
      return "bottom-4 left-4";
    case "bottom-right":
      return "bottom-[4.5rem] right-4";
    case "right-center":
      return "top-1/2 right-4 -translate-y-1/2";
    default:
      return "bottom-[4.5rem] right-4";
  }
};

/**
 * Same as getPresetClasses but for the Electron forceOpen full-screen mode,
 * where the widget content is positioned within the window without the trigger offset.
 */
export const getPresetClassesElectron = (position: WidgetPosition): string => {
  switch (position) {
    case "top-left":
      return "top-2 left-2";
    case "top-right":
      return "top-2 right-2";
    case "bottom-left":
      return "bottom-2 left-2";
    case "bottom-right":
      return "bottom-2 right-2";
    case "right-center":
      return "top-1/2 right-2 -translate-y-1/2";
    default:
      return "bottom-2 right-2";
  }
};
