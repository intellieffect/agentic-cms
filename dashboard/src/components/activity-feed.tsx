import {
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
  SendIcon,
  RotateCcwIcon,
  ArrowUpCircleIcon,
  BotIcon,
  UserIcon,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ActivityLog, ActivityAction } from "@/lib/types";

const actionConfig: Record<ActivityAction, { icon: typeof PlusCircleIcon; color: string; label: string }> = {
  create: { icon: PlusCircleIcon, color: "text-success", label: "Created" },
  update: { icon: PencilIcon, color: "text-info", label: "Updated" },
  delete: { icon: TrashIcon, color: "text-destructive", label: "Deleted" },
  publish: { icon: SendIcon, color: "text-warning", label: "Published" },
  revert: { icon: RotateCcwIcon, color: "text-muted-foreground", label: "Reverted" },
  promote: { icon: ArrowUpCircleIcon, color: "text-success", label: "Promoted" },
};

interface ActivityFeedProps {
  logs: ActivityLog[];
  compact?: boolean;
}

export function ActivityFeed({ logs, compact = false }: ActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No activity yet
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {logs.map((log) => {
        const config = actionConfig[log.action];
        const Icon = config.icon;
        const ActorIcon = log.actor_type === "agent" ? BotIcon : UserIcon;

        return (
          <div key={log.id} className={cn("relative flex gap-3 py-2", compact ? "py-1.5" : "py-2.5")}>
            {/* Timeline dot */}
            <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background", config.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
                <span className="text-xs text-muted-foreground">in</span>
                <span className="text-xs font-medium text-foreground">{log.collection}</span>
              </div>
              <div className="flex items-center gap-2">
                <ActorIcon className="h-3 w-3 text-muted-foreground" />
                <span className="truncate text-sm text-foreground">
                  {log.actor ?? (log.actor_type === "agent" ? "Agent" : "Human")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(log.timestamp)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
