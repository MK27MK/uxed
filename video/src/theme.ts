import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const sans = loadManrope("normal", {
  weights: ["500", "700", "800"],
  subsets: ["latin"],
}).fontFamily;

export const mono = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
}).fontFamily;

export const colors = {
  background: "#0b0f15",
  foreground: "#eef1f6",
  muted: "#8b95a7",
  line: "#232b38",
  accent: "#3d9bff",
  paper: "#f7f7f5",
  ink: "#141414",
  sketchBlue: "#2f7bf5",
};
