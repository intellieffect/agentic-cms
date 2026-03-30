import { Main } from "@/components/layout/main";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, UploadIcon, FileIcon } from "lucide-react";

export default function MediaPage() {
  return (
    <Main>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground">Manage images and files.</p>
        </div>
        <Button variant="outline" className="gap-2" disabled>
          <UploadIcon className="h-4 w-4" />
          Upload
        </Button>
      </div>

      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed border-border">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">No media yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Media items will appear here when registered via the API.
          </p>
        </div>
      </div>
    </Main>
  );
}
