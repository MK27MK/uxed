import { AbsoluteFill, Interactive, useVideoConfig } from "remotion";
import { colors, sans } from "../theme";
import { Eyebrow } from "./Eyebrow";
import { TimingRow } from "./TimingRow";

const TimingInner = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        padding: "110px 120px",
        gap: 28,
        fontFamily: sans,
      }}
    >
      <Eyebrow>Same sketches, same spec</Eyebrow>
      <div
        style={{
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: colors.foreground,
        }}
      >
        Time to a mock
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 64,
        }}
      >
        <TimingRow
          name="building-ui"
          from={0.5 * fps}
          tool="building-ui"
          model="Opus 5.5 medium"
          seconds={150}
          highlight
        />
        <TimingRow
          name="ChatGPT"
          from={0.5 * fps}
          tool="ChatGPT"
          model="Sol 6.1 high"
          seconds={344}
          highlight={false}
        />
        <TimingRow
          name="Claude Design"
          from={0.5 * fps}
          tool="Claude Design"
          model="Opus 5.5 medium"
          seconds={931}
          highlight={false}
        />
      </div>
    </AbsoluteFill>
  );
};

export const Timing = Interactive.create({
  Component: TimingInner,
  layout: "absolute-fill",
});
