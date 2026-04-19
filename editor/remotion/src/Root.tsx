import { Composition } from "remotion";
import { VideoProject, type ProjectData } from "./VideoProject";
import { registerFonts } from "./fonts";

// Register all custom fonts for rendering
registerFonts();

const FPS = 30;

// Default props for Remotion Studio preview
const defaultProps: ProjectData = {
  clips: [
    { source: "sample.mp4", start: 0, end: 3, source_idx: 0 },
    { source: "sample.mp4", start: 3, end: 6, source_idx: 0 },
  ],
  clipMeta: [{ speed: 1 }, { speed: 1 }],
  clipCrops: [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 0, y: 0, w: 100, h: 100 },
  ],
  clipZooms: [
    { scale: 1, panX: 0, panY: 0 },
    { scale: 1, panX: 0, panY: 0 },
  ],
  clipSubStyles: [
    { size: 16, x: 50, y: 80, font: "'BMDOHYEON',sans-serif" },
    { size: 16, x: 50, y: 80, font: "'BMDOHYEON',sans-serif" },
  ],
  transitions: [{ type: "fade", duration: 0.5 }],
  subs: [],
  globalSubs: [
    {
      text: "자막 테스트",
      start: 0,
      end: 3,
      style: { size: 24, x: 50, y: 80 },
      effect: "typewriter",
    },
    {
      text: "슬라이드 업",
      start: 3,
      end: 6,
      style: { size: 24, x: 50, y: 80 },
      effect: "slideUp",
    },
  ],
  bgmClips: [],
  totalDuration: 6,
  sources: ["sample.mp4"],
  mediaBasePath: "",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoProject"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={VideoProject as any}
        durationInFrames={Math.ceil(defaultProps.totalDuration * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => {
          const p = props as unknown as ProjectData & { orientation?: string };
          const duration = p.totalDuration || defaultProps.totalDuration;
          const orientation = p.orientation || 'vertical';
          const dimensions = orientation === 'square'
            ? { width: 1080, height: 1080 }
            : orientation === 'horizontal'
            ? { width: 1920, height: 1080 }
            : { width: 1080, height: 1920 };
          return {
            durationInFrames: Math.ceil(duration * FPS),
            ...dimensions,
          };
        }}
      />
    </>
  );
};
