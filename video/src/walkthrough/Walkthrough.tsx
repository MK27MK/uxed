import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { colors } from "../theme";
import { ChatScene } from "./ChatScene";
import { EndCard } from "./EndCard";
import { MockScene } from "./MockScene";
import { PulsePresentation } from "./pulse";

export const Walkthrough = () => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries name="Scenes">
      <TransitionSeries.Sequence name="Prompt" durationInFrames={160}>
        <ChatScene style={{ backgroundColor: colors.background }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={{ component: PulsePresentation, props: {} }}
        timing={linearTiming({ durationInFrames: 0.4 * fps })}
      />
      <TransitionSeries.Sequence name="Mock" durationInFrames={362}>
        <MockScene style={{ backgroundColor: "#0b0e12" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.4 * fps })}
      />
      <TransitionSeries.Sequence name="End" durationInFrames={3.4 * fps}>
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
