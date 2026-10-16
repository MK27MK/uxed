import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { Input } from "./scenes/Input";
import { Notes } from "./scenes/Notes";
import { Outro } from "./scenes/Outro";
import { SketchToMock } from "./scenes/SketchToMock";
import { Timing } from "./scenes/Timing";
import { Title } from "./scenes/Title";

export const Presentation = () => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries name="Scenes">
      <TransitionSeries.Sequence name="Title" durationInFrames={3.5 * fps}>
        <Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Input" durationInFrames={5 * fps}>
        <Input />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Search" durationInFrames={4 * fps}>
        <SketchToMock
          step="Output · 1 of 3"
          title="Find a strategy"
          sketch="sketch-1-search.png"
          mock="mock-1-search.png"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Configuration" durationInFrames={4 * fps}>
        <SketchToMock
          step="Output · 2 of 3"
          title="Change its parameters"
          sketch="sketch-2-configuration.png"
          mock="mock-2-configuration.png"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Past runs" durationInFrames={4 * fps}>
        <SketchToMock
          step="Output · 3 of 3"
          title="Review its past runs"
          sketch="sketch-3-past-runs.png"
          mock="mock-3-past-runs.png"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Notes" durationInFrames={4.5 * fps}>
        <Notes />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Timing" durationInFrames={6 * fps}>
        <Timing />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 0.5 * fps })}
      />
      <TransitionSeries.Sequence name="Outro" durationInFrames={3.5 * fps}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
