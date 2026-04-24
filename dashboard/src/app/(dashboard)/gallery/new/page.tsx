import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";
import { NewGalleryForm } from "./new-form";

export default function NewGalleryItemPage() {
  return (
    <Main>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/gallery">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Gallery Item</h1>
          <p className="text-muted-foreground">
            커버 1장 업로드 + 메타 입력 → 즉시 등록. 추가 미디어는 등록 후 상세 화면에서.
          </p>
        </div>
      </div>

      <NewGalleryForm />
    </Main>
  );
}
