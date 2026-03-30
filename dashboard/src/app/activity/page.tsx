import { getActivityLogs } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, truncate } from "@/lib/utils";
import type { ActivityAction, ActorType } from "@/lib/types";
import {
  PlusCircle,
  RefreshCw,
  Trash2,
  Globe,
  RotateCcw,
  ArrowUpCircle,
  Bot,
  User,
} from "lucide-react";

export const dynamic = "force-dynamic";

const actionConfig: Record<
  ActivityAction,
  { icon: typeof PlusCircle; color: string; label: string }
> = {
  create: { icon: PlusCircle, color: "text-success", label: "Created" },
  update: { icon: RefreshCw, color: "text-info", label: "Updated" },
  delete: { icon: Trash2, color: "text-red-500", label: "Deleted" },
  publish: { icon: Globe, color: "text-primary", label: "Published" },
  revert: { icon: RotateCcw, color: "text-warning", label: "Reverted" },
  promote: { icon: ArrowUpCircle, color: "text-success", label: "Promoted" },
};

function ActorIcon({ type }: { type: ActorType }) {
  if (type === "agent") {
    return <Bot className="h-3 w-3 text-primary" />;
  }
  return <User className="h-3 w-3 text-muted-foreground" />;
}

export default async function ActivityPage() {
  const logs = await getActivityLogs({ limit: 100 });

  return (
    <>
      <PageHeader
        title="Agent Activity"
        description="Real-time audit trail of all CMS mutations"
      />

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {logs.map((log) => {
              const config = actionConfig[log.action] ?? actionConfig.update;
              const Icon = config.icon;
              const payloadTitle =
                (log.payload as Record<string, unknown> | null)?.title as string | undefined;

              return (
                <div key={log.id} className="relative flex gap-4 pb-6">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={log.action === "create" || log.action === "promote" ? "success" : "default"}>
                        {config.label}
                      </Badge>
                      <Badge variant="secondary">{log.collection}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ActorIcon type={log.actor_type} />
                        {log.actor || log.actor_type}
                      </span>
                    </div>
                    {payloadTitle && (
                      <p className="text-sm font-medium mt-1">
                        {truncate(payloadTitle, 60)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
