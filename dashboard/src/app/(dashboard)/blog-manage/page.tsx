"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  view_count: number;
  reading_time: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  categories: { id: string; name: string; slug: string }[];
  newsletter_status: "sending" | "sent" | "partial_failed" | "failed" | null;
  newsletter_last_sent_at: string | null;
  newsletter_sent_to_count: number;
  newsletter_attempted_count: number;
  newsletter_failed_count: number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "초안", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  published: { label: "게시됨", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  archived: { label: "보관됨", className: "bg-[#333] text-[#888] border-[#444]" },
};

const NEWSLETTER_BADGE: Record<string, { label: string; className: string }> = {
  sending: { label: "발송 중", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  sent: { label: "발송됨", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  partial_failed: { label: "일부 실패", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  failed: { label: "실패", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

type StatusFilter = "all" | "draft" | "published" | "archived";
type SortBy = "created_at" | "updated_at";

function renderNewsletterSummary(post: BlogPost) {
  if (!post.newsletter_status) {
    return <span className="text-[#555] text-xs">미발송</span>;
  }

  const badge = NEWSLETTER_BADGE[post.newsletter_status];
  const sentDate = post.newsletter_last_sent_at
    ? new Date(post.newsletter_last_sent_at).toLocaleDateString("ko-KR")
    : "-";

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="outline" className={badge.className}>
        {badge.label}
      </Badge>
      <span className="text-[11px] text-[#666]">
        {sentDate}
        {post.newsletter_status !== "sending" && post.newsletter_attempted_count > 0
          ? ` · ${post.newsletter_sent_to_count}/${post.newsletter_attempted_count}`
          : ""}
        {post.newsletter_failed_count > 0 ? ` · 실패 ${post.newsletter_failed_count}` : ""}
      </span>
    </div>
  );
}

export default function BlogManagePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        params.set("sort", sortBy);
        params.set("order", "desc");

        const res = await fetch(`/api/blog-manage?${params}`);
        const data = await res.json();
        setPosts(data.posts || []);
      } catch (e) {
        console.error("Failed to fetch posts", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [statusFilter, sortBy]);

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "draft", label: "초안" },
    { value: "published", label: "게시됨" },
    { value: "archived", label: "보관됨" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">블로그 관리</h1>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg border border-[#333] overflow-hidden">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 text-xs border-none cursor-pointer transition-colors ${
                statusFilter === f.value
                  ? "bg-[#FF6B35] text-white"
                  : "bg-[#0a0a0a] text-[#888] hover:text-[#fafafa]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="px-3 py-2 rounded-lg border border-[#333] bg-[#0a0a0a] text-sm text-[#fafafa] outline-none"
        >
          <option value="created_at">작성일순</option>
          <option value="updated_at">수정일순</option>
        </select>
      </div>

      {loading ? (
        <div className="text-[#666] text-sm py-8">로딩 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-[#666] text-sm py-8">아직 작성된 글이 없습니다.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#333] text-[#666] text-xs text-left">
              <th className="py-2 px-3">제목</th>
              <th className="py-2 px-3 w-20">상태</th>
              <th className="py-2 px-3 w-36">뉴스레터</th>
              <th className="py-2 px-3 w-32">카테고리</th>
              <th className="py-2 px-3 w-24">작성일</th>
              <th className="py-2 px-3 w-16 text-right">조회수</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
              return (
                <tr
                  key={post.id}
                  onClick={() => router.push(`/blog-manage/${post.id}`)}
                  className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 text-[#fafafa]">{post.title}</td>
                  <td className="py-3 px-3">
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">{renderNewsletterSummary(post)}</td>
                  <td className="py-3 px-3 text-[#888] text-xs">
                    {post.categories.map((c) => c.name).join(", ") || "-"}
                  </td>
                  <td className="py-3 px-3 text-[#555] text-xs">
                    {new Date(post.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="py-3 px-3 text-[#555] text-xs text-right">{post.view_count ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
