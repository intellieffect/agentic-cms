import React from "react";
import { SLIDE_TEMPLATES } from "../../lib/studio/slide-templates";

export interface CarouselSlideProps {
  slideData: {
    id: string;
    templateId: string;
    label: string;
    category: "cover" | "hook" | "body" | "cta";
    content: Record<string, unknown>;
    overrides: Record<string, unknown>;
  };
  slideIndex: number;
  totalSlides: number;
}

/**
 * Field alias mapping — mirrors slide-deck.ts resolveSlideProps logic.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  title: [
    "title", "heading", "question", "overline", "eventName",
    "statLabel", "statement", "painPoint", "myth", "result",
  ],
  subtitle: [
    "subtitle", "subQuestion", "detail", "teaser", "caption",
    "reason", "guide", "empathy", "context", "reveal", "transition",
  ],
  body: ["body", "content", "quote", "tip", "description"],
  imageUrl: ["imageUrl", "backgroundImageUrl"],
  items: ["items", "points", "nodes", "beforeItems", "afterItems", "conditions"],
  steps: ["steps"],
};

function resolveProps(
  slide: CarouselSlideProps["slideData"],
  slideIndex: number,
  totalSlides: number
): Record<string, unknown> {
  const tpl = SLIDE_TEMPLATES.find((t) => t.id === slide.templateId);
  if (!tpl) return {};

  const fromContent: Record<string, unknown> = {};
  for (const [contentKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (slide.content?.[contentKey] === undefined) continue;
    for (const alias of aliases) {
      if (alias in tpl.propsSchema) {
        fromContent[alias] = slide.content[contentKey];
        break;
      }
    }
  }

  return {
    ...tpl.defaultProps,
    ...fromContent,
    ...(slide.overrides || {}),
    slideNumber: `${slideIndex + 1}/${totalSlides}`,
  };
}

export const CarouselSlideComp: React.FC<CarouselSlideProps> = ({
  slideData,
  slideIndex,
  totalSlides,
}) => {
  const tpl = SLIDE_TEMPLATES.find((t) => t.id === slideData.templateId);
  if (!tpl) {
    return (
      <div
        style={{
          width: 1080,
          height: 1440,
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          fontSize: 48,
        }}
      >
        Template not found: {slideData.templateId}
      </div>
    );
  }

  const props = resolveProps(slideData, slideIndex, totalSlides);
  const Component = tpl.component as React.FC<Record<string, unknown>>;

  return <Component {...props} />;
};
