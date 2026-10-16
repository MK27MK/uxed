import type React from "react";

type LogoProps = {
  readonly size: number;
  readonly drawn: number;
  readonly style?: React.CSSProperties;
};

export const Logo: React.FC<LogoProps> = ({ size, drawn, style }) => (
  <svg viewBox="1.26 1.69 97.49 97.49" width={size} height={size} style={style}>
    <path
      d="M 17.51 12.91 C 30.09 24.29, 41.28 33.03, 41.37 42.59 C 41.49 55.28, 21.71 59.58, 17.05 73.75 C 14.82 80.55, 19.83 87.95, 27.34 87.95 L 72.66 87.95 C 80.17 87.95, 85.18 80.55, 82.95 73.75 C 78.29 59.58, 58.51 55.28, 58.63 42.59 C 58.72 33.03, 69.91 24.29, 82.49 12.91"
      fill="none"
      stroke="#00AAFF"
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - drawn}
    />
  </svg>
);
