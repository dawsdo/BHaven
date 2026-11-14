export const colors = {
  background: "#F4F1EA",
  surface: "#FFFFFF",
  ink: "#1A1D21",
  // Secondary text, tinted toward the primary green so it sits with the warm background.
  muted: "#505D57",
  border: "#DDD7CA",
  primary: "#0A5C55",
  primaryHover: "#09514B",
  primaryPressed: "#08473F",
  /** Faint wash of the primary, for hover on light controls. */
  primaryTint: "#EEF5F2",
  onPrimary: "#FFFFFF",
  openBg: "#DDF2E3",
  openInk: "#14532D",
  fullBg: "#E9E9E6",
  fullInk: "#474C54",
  warnBg: "#FCEFD0",
  warnInk: "#6B4300",
  errorBg: "#FBE4E1",
  errorInk: "#8A1C12",
};

export const radius = { card: 16, control: 12, pill: 999 };

/** Smallest comfortable touch target, in points. */
export const TOUCH = 48;

/** A count updated within this many minutes is shown as fresh. Older ones are shown plainly. */
export const FRESH_MINUTES = 60;
