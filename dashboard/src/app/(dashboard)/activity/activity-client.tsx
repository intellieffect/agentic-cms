"use client";

import { useState } from "react";
import {
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
  SendIcon,
  RotateCcwIcon,
  ArrowUpCircleIcon,
  BotIcon,
  UserIcon,
  FilterIcon,
  ChevronDownIcon,
} from "lucide-react";
import type { ActivityLog, ActivityAction, ActorType } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";

const actionConfig: Record<ActivityAction, { icon: typeof PlusCircleIcon; color: string; bgColor: string; label: string }> = {
  create: { icon: PlusCircleIcon, color: "text-success", bgColor: "bg-success/10", label: "Created" },
  update: { icon: PencilIcon, color: "text-info", bgColor: "bg-info/10", label: "Updated" },
  delete: { icon: TrashIcon, color: "text-destructive", bgColor: "bg-destructive/10", label: "Deleted" },
  publish: { icon: SendIcon, color: "text-warning", bgColor: "bg-warning/10", label: "Published" },
  revert: { icon: RotateCcwIcon, color: "text-muted-foreground", bgColor: "bg-muted", label: "Reverted" },
  promote: { icon: ArrowUpCircleIcon, color: "text-success", bgColor: "bg-success/10", label: "Promoted" },
};

const actionTypes: ActivityAction[] = ["create", "update", "delete", "publish", "revert", "promote"];
const actorTypes: ActorType[] = ["agent", "human"];

interface ActivityPageClientProps {
  logs: ActivityLog[];
}

export function ActivityPageClient({ logs }: ActivityPageClientProps) {
  const [actionFilter, setActionFilter] = useState<ActivityAction | null>(null);
  const [actorFilter, setActorFilter] = useState<ActorType | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = logs.filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (actorFilter && log.actor_type !== actorFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <FilterIcon className="h-3.5 w-3.5" />
          Filters:
        </div>
        {actionTypes.map((action) => {
          const config = actionConfig[action];
          return (
            <Button
              key={action}
              variant={actionFilter === action ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActionFilter(actionFilter === action ? null : action)}
            >
              <config.icon className="mr-1 h-3 w-3" />
              {config.label}
            </Button>
          );
        })}
        <div className="w-px bg-border" />
        {actorTypes.map((type) => (
          <Button
            key={type}
            variant={actorFilter === type ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActorFilter(actorFilter === type ? null : type)}
          >
            {type === "agent" ? <BotIcon className="mr-1 h-3 w-3" /> : <UserIcon className="mr-1 h-3 w-3" />}
            {type}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative space-y-0">
        <div className="absolute left-5 top-4 bottom-4 w-px bg-border" />

        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No activity matches your filters
          </div>
        ) : (
          filtered.map((log) => {
            const config = actionConfig[log.action];
            const Icon = config.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="relative flex gap-4 py-3">
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border",
                    config.bgColor
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>

                <Card className="flex-1 border-border/50">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", config.color)}>
                            {config.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {log.collection}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.actor_type === "agent" ? (
                            <BotIcon className="h-3.5 w-3.5 text-info" />
                          ) : (
                            <UserIcon className="h-3.5 w-3.5 text-warning" />
                          )}
                          <span className="text-sm">
                            {log.actor ?? (log.actor_type === "agent" ? "Agent" : "Human")}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>

                    {log.payload && Object.keys(log.payload).length > 0 && (
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          <ChevronDownIcon className={cn("mr-1 h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                          {isExpanded ? "Hide" : "Show"} payload
                        </Button>
                        {isExpanded && (
                          <pre className="mt-2 rounded-md bg-muted/50 p-3 text-xs overflow-x-auto">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
