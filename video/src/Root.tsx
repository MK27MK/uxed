import { Composition, Folder } from "remotion";
import { Presentation } from "./Presentation";
import { Input } from "./scenes/Input";
import { Notes } from "./scenes/Notes";
import { Outro } from "./scenes/Outro";
import { SketchToMock } from "./scenes/SketchToMock";
import { Timing } from "./scenes/Timing";
import { TimingRow } from "./scenes/TimingRow";
import { Title } from "./scenes/Title";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StrategySearch"
        component={Presentation}
        durationInFrames={930}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition
          id="Title"
          component={Title}
          durationInFrames={105}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Input"
          component={Input}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="SketchToMock"
          component={SketchToMock}
          durationInFrames={120}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            step: "Output · 1 of 3",
            title: "Find a strategy",
            sketch: "sketch-1-search.png",
            mock: "mock-1-search.png",
          }}
        />
        <Composition
          id="Notes"
          component={Notes}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Timing"
          component={Timing}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="TimingRow"
          component={TimingRow}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            tool: "building-ui",
            model: "Opus 5.5 medium",
            seconds: 150,
            highlight: true,
          }}
        />
        <Composition
          id="Outro"
          component={Outro}
          durationInFrames={105}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
