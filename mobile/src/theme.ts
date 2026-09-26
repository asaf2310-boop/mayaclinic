/** Shared theme for the OfirBaby owner admin app (aligned with site browns). */
export const colors = {
  bg: "#F7F1EA",
  bgSoft: "#EFE6DC",
  surface: "#FFFDF9",
  ink: "#2A211A",
  muted: "#6E5C4F",
  brown: "#5C4033",
  brownDark: "#3C2C21",
  clay: "#D4C4B4",
  accent: "#8B5E3C",
  success: "#2F6B4F",
  warning: "#A07B2F",
  danger: "#9B3B3B",
  border: "#E2D6C8",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  confirmed: "מאושר",
  cancelled: "בוטל",
  completed: "הושלם",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "#A07B2F",
  confirmed: "#3C5A8C",
  cancelled: "#9B3B3B",
  completed: "#2F6B4F",
};
