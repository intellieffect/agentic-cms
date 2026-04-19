/**
 * Custom Cube 3D Transition for @remotion/transitions
 * Creates a 3D rotating cube effect between two scenes.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

type CubeDirection = "from-left" | "from-right" | "from-top" | "from-bottom";

interface CubeProps {
  [key: string]: unknown;
  direction: CubeDirection;
  perspective?: number;
}

const CubePresentationComponent: React.FC<
  TransitionPresentationComponentProps<CubeProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { direction = "from-left", perspective = 1000 } = passedProps;
  const progress = presentationProgress;
  const isEntering = presentationDirection === "entering";

  // Calculate rotation based on direction
  let rotateAxis = "Y";
  let rotateFrom = 0;
  let rotateTo = 0;

  switch (direction) {
    case "from-left":
      rotateAxis = "Y";
      if (isEntering) {
        rotateFrom = 90;
        rotateTo = 0;
      } else {
        rotateFrom = 0;
        rotateTo = -90;
      }
      break;
    case "from-right":
      rotateAxis = "Y";
      if (isEntering) {
        rotateFrom = -90;
        rotateTo = 0;
      } else {
        rotateFrom = 0;
        rotateTo = 90;
      }
      break;
    case "from-top":
      rotateAxis = "X";
      if (isEntering) {
        rotateFrom = -90;
        rotateTo = 0;
      } else {
        rotateFrom = 0;
        rotateTo = 90;
      }
      break;
    case "from-bottom":
      rotateAxis = "X";
      if (isEntering) {
        rotateFrom = 90;
        rotateTo = 0;
      } else {
        rotateFrom = 0;
        rotateTo = -90;
      }
      break;
  }

  const rotation = rotateFrom + (rotateTo - rotateFrom) * progress;
  const transform = `perspective(${perspective}px) rotate${rotateAxis}(${rotation}deg)`;

  // Fade slightly to simulate lighting on cube faces
  const opacity = isEntering
    ? 0.5 + 0.5 * progress
    : 1 - 0.5 * progress;

  return (
    <AbsoluteFill
      style={{
        transform,
        transformOrigin: (() => {
          switch (direction) {
            case "from-left": return isEntering ? "left center" : "right center";
            case "from-right": return isEntering ? "right center" : "left center";
            case "from-top": return isEntering ? "center top" : "center bottom";
            case "from-bottom": return isEntering ? "center bottom" : "center top";
          }
        })(),
        backfaceVisibility: "hidden",
        opacity,
      }}
    >
      {children as React.ReactNode}
    </AbsoluteFill>
  );
};

export function cube(props: CubeProps = { direction: "from-left" }): TransitionPresentation<CubeProps> {
  return {
    component: CubePresentationComponent,
    props,
  };
}
