import { getContents } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard } from "./pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const contents = await getContents();

  const drafts = contents.filter((c) => c.status === "draft");
  const inReview = contents.filter((c) => c.status === "review");
  const published = contents.filter((c) => c.status === "published");

  return (
    <>
      <PageHeader
        title="Content Pipeline"
        description="Kanban view of your content workflow"
      />
      <PipelineBoard
        drafts={drafts}
        inReview={inReview}
        published={published}
      />
    </>
  );
}
