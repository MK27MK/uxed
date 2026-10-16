import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { useVideoConfig } from "remotion";
import { colors } from "../theme";
import { ChatScene } from "./ChatScene";
import { EndCard } from "./EndCard";
import { ImplementScene } from "./ImplementScene";
import { MockScene } from "./MockScene";
import { PulsePresentation } from "./pulse";

const SCENES = { prompt: 241, mock: 519, implement: 166, end: 75 };

export const Walkthrough = () => {
  const { fps } = useVideoConfig();
  const pulse = 0.4 * fps;
  const transition = (
    <TransitionSeries.Transition
      presentation={{ component: PulsePresentation, props: {} }}
      timing={linearTiming({ durationInFrames: pulse })}
    />
  );

  return (
    <TransitionSeries name="Scenes">
      <TransitionSeries.Sequence name="Prompt" durationInFrames={SCENES.prompt}>
        <ChatScene style={{ backgroundColor: colors.background }} />
      </TransitionSeries.Sequence>
      {transition}
      <TransitionSeries.Sequence
        name="Mock"
        durationInFrames={SCENES.mock}
        trimBefore={19}
      >
        <MockScene style={{ backgroundColor: "#0b0e12" }} />
      </TransitionSeries.Sequence>
      {transition}
      <TransitionSeries.Sequence
        name="Implement"
        durationInFrames={SCENES.implement}
      >
        <ImplementScene style={{ backgroundColor: colors.background }} />
      </TransitionSeries.Sequence>
      {transition}
      <TransitionSeries.Sequence name="End" durationInFrames={SCENES.end}>
        <EndCard
          style={{
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
