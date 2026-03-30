import { getIdeas } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { truncate, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const ideas = await getIdeas();

  return (
    <>
      <PageHeader
        title="Ideas"
        description="Content ideas captured by agents"
      />

      {ideas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ideas yet.</p>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <CardContent className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{truncate(idea.raw_text, 200)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {idea.source && (
                      <Badge variant="secondary">{idea.source}</Badge>
                    )}
                    {idea.promoted_to && (
                      <Badge variant="success">Promoted</Badge>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(idea.created_at)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
