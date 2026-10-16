import { Composition, Folder } from "remotion";
import { Presentation } from "./Presentation";
import { Input } from "./scenes/Input";
import { Notes } from "./scenes/Notes";
import { Outro } from "./scenes/Outro";
import { SketchToMock } from "./scenes/SketchToMock";
import { Timing } from "./scenes/Timing";
import { TimingRow } from "./scenes/TimingRow";
import { Title } from "./scenes/Title";
import { ChatScene } from "./walkthrough/ChatScene";
import { EndCard } from "./walkthrough/EndCard";
import { MockScene } from "./walkthrough/MockScene";
import { Walkthrough } from "./walkthrough/Walkthrough";

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
      <Composition
        id="Walkthrough"
        component={Walkthrough}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Walkthrough-scenes">
        <Composition
          id="WalkthroughPrompt"
          component={ChatScene}
          durationInFrames={184}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ style: { backgroundColor: "#0b0f15" } }}
        />
        <Composition
          id="WalkthroughMock"
          component={MockScene}
          durationInFrames={376}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ style: { backgroundColor: "#0b0e12" } }}
        />
        <Composition
          id="WalkthroughEnd"
          component={EndCard}
          durationInFrames={64}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            style: {
              backgroundColor: "#0b0f15",
              justifyContent: "center",
              alignItems: "center",
            },
          }}
        />
      </Folder>
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
