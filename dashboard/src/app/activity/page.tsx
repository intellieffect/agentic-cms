import { getContents } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, truncate } from "@/lib/utils";
import { PlusCircle, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

interface ActivityEvent {
  id: string;
  contentId: string;
  title: string;
  type: "created" | "updated";
  timestamp: string;
  status: string;
}

function deriveActivityEvents(
  contents: { id: string; title: string; status: string; created_at: string; updated_at: string }[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const content of contents) {
    events.push({
      id: `${content.id}-created`,
      contentId: content.id,
      title: content.title,
      type: "created",
      timestamp: content.created_at,
      status: content.status,
    });

    // Only add update event if it differs from creation
    if (content.updated_at !== content.created_at) {
      events.push({
        id: `${content.id}-updated`,
        contentId: content.id,
        title: content.title,
        type: "updated",
        timestamp: content.updated_at,
        status: content.status,
      });
    }
  }

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}

export default async function ActivityPage() {
  const contents = await getContents();
  const events = deriveActivityEvents(contents);

  return (
    <>
      <PageHeader
        title="Agent Activity"
        description="Timeline of content mutations by agents"
      />

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {events.map((event) => (
              <div key={event.id} className="relative flex gap-4 pb-6">
                {/* Timeline dot */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  {event.type === "created" ? (
                    <PlusCircle className="h-4 w-4 text-success" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-info" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {truncate(event.title, 50)}
                    </span>
                    <Badge
                      variant={event.type === "created" ? "success" : "default"}
                    >
                      {event.type}
                    </Badge>
                    <Badge variant="secondary">{event.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(event.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
