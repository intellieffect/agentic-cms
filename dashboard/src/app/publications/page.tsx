import { getPublications } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PublicationsTable } from "./publications-table";

export const dynamic = "force-dynamic";

export default async function PublicationsPage() {
  const publications = await getPublications();

  return (
    <>
      <PageHeader
        title="Publications"
        description="Track where your content has been published"
      />
      <PublicationsTable publications={publications} />
    </>
  );
}
