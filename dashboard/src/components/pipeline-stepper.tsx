import Link from "next/link";
import {
  TagIcon,
  LightbulbIcon,
  FileTextIcon,
  SplitIcon,
  SendIcon,
  ChevronRightIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pipeline 플로우의 5단계. 순서가 곧 사용자 흐름.
// Topics: 키워드/테마 선정
// Ideas: 구체 앵글/인사이트
// Contents: 마스터 롱폼
// Variants: 플랫폼별 파생
// Publish: Publications 로 집계 (실제 발행은 Postiz 등 외부)
export type PipelineStep = "topics" | "ideas" | "contents" | "variants" | "publish";

interface StepDef {
  key: PipelineStep;
  label: string;
  href: string;
  icon: LucideIcon;
}

const STEPS: readonly StepDef[] = [
  { key: "topics", label: "Topics", href: "/topics", icon: TagIcon },
  { key: "ideas", label: "Ideas", href: "/ideas", icon: LightbulbIcon },
  { key: "contents", label: "Contents", href: "/contents", icon: FileTextIcon },
  { key: "variants", label: "Variants", href: "/variants", icon: SplitIcon },
  { key: "publish", label: "Publish", href: "/publications", icon: SendIcon },
];

interface PipelineStepperProps {
  currentStep: PipelineStep;
  className?: string;
}

/**
 * 파이프라인 단계 컨텍스트를 페이지 상단에 표시하는 stepper.
 * 각 단계는 해당 페이지로 이동 가능한 Link. 현재 단계는 시각적으로 하이라이트.
 *
 * 모바일: 가로 스크롤로 전체 단계 노출 (overflow-x-auto).
 */
export function PipelineStepper({ currentStep, className }: PipelineStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <nav
      aria-label="Pipeline progress"
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm",
        className,
      )}
    >
      {STEPS.map((step, idx) => {
        const isCurrent = idx === currentIndex;
        const isPast = idx < currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center gap-1 shrink-0">
            <Link
              href={step.href}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                isCurrent
                  ? "bg-info/10 text-info font-medium"
                  : isPast
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{step.label}</span>
            </Link>
            {idx < STEPS.length - 1 && (
              <ChevronRightIcon
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
