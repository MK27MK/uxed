import type React from "react";
import { colors, mono } from "../theme";

export const Eyebrow: React.FC<{ readonly children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      fontFamily: mono,
      fontSize: 30,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: colors.accent,
    }}
  >
    {children}
  </div>
);
