"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Mail, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlatePreview } from "@/components/blog/PlatePreview";
import dynamic from "next/dynamic";

const BlogManageEditor = dynamic(
  () => import("@/components/blog/BlogManageEditor").then(mod => mod.BlogManageEditor),
  { ssr: false, loading: () => <div className="text-[#666] text-sm py-4">에디터 로딩 중...</div> }
);

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  excerpt: string | null;
  content: any[];
  view_count: number;
  reading_time: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  thumbnail_url: string | null;
  categories: { id: string; name: string; slug: string }[];
  tags: { id: string; name: string; slug: string }[];
}

interface Subscriber {
  id: string;
  email: string;
  status: string;
  subscribed_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "초안", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  published: { label: "게시됨", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  archived: { label: "보관됨", className: "bg-[#333] text-[#888] border-[#444]" },
};

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Newsletter states
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [newsletterResult, setNewsletterResult] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastSendStatus, setLastSendStatus] = useState<string | null>(null);
  const [lastSentCount, setLastSentCount] = useState(0);
  const [lastFailedCount, setLastFailedCount] = useState(0);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [recipientMode, setRecipientMode] = useState<"all" | "selected">("all");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscriberLoadError, setSubscriberLoadError] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/blog-manage/${id}`);
      const data = await res.json();
      setPost(data.post);

      // Check newsletter send history (via server API to avoid RLS issues)
      try {
        const logRes = await fetch(`/api/newsletter/send-history?postId=${id}`);
        if (logRes.ok) {
          const logData = await logRes.json();
          setLastSentAt(logData.lastSentAt || null);
          setLastSendStatus(logData.lastStatus || null);
          setLastSentCount(logData.sentToCount || 0);
          setLastFailedCount(logData.failedCount || 0);
        }
      } catch { /* ignore */ }
    } catch (e) {
      console.error("Failed to fetch post", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [id]);

  const updateStatus = async (status: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/blog-manage/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchPost();
    } catch (e) {
      console.error("Failed to update status", e);
    } finally {
      setActionLoading(false);
    }
  };

  const deletePost = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/blog-manage/${id}`, { method: "DELETE" });
      router.push("/blog-manage");
    } catch (e) {
      console.error("Failed to delete post", e);
      setActionLoading(false);
    }
  };

  const loadSubscribers = async () => {
    setLoadingSubscribers(true);
    setSubscriberLoadError("");
    try {
      const res = await fetch("/api/newsletter/subscribers?status=subscribed");
      const data = await res.json();
      if (!res.ok) {
        setSubscriberLoadError(data.error || "구독자 목록을 불러오지 못했습니다.");
        return;
      }
      setSubscribers(data.subscribers || []);
    } catch {
      setSubscriberLoadError("구독자 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleNewsletterClick = async () => {
    if (!post) return;

    setLoadingPreview(true);
    setShowSendModal(true);
    setNewsletterResult("");
    setRecipientMode("all");
    setRecipientSearch("");
    setSelectedRecipientIds([]);
    try {
      const [previewRes] = await Promise.all([
        fetch("/api/newsletter/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id, preview: true }),
        }),
        subscribers.length === 0 ? loadSubscribers() : Promise.resolve(),
      ]);
      const data = await previewRes.json();
      if (previewRes.ok && data.previewHtml) {
        setPreviewHtml(data.previewHtml);
      } else {
        toast.error(data.error || "미리보기 생성 실패");
        setShowSendModal(false);
      }
    } catch {
      toast.error("미리보기 로드 중 오류");
      setShowSendModal(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleNewsletterSend = async (options: { force?: boolean } = {}) => {
    if (!post) return;
    if (recipientMode === "selected" && selectedRecipientIds.length === 0) return;

    setSendingNewsletter(true);
    setNewsletterResult("");
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          recipientIds: recipientMode === "selected" ? selectedRecipientIds : undefined,
          force: options.force === true ? true : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && !options.force) {
        const confirmed = window.confirm(
          `${data.error || "이미 이 게시글에 대한 발송 이력이 있습니다."}\n\n그래도 다시 발송할까요?`,
        );
        if (confirmed) {
          setSendingNewsletter(false);
          await handleNewsletterSend({ force: true });
          return;
        }
        setNewsletterResult("발송이 취소되었습니다.");
        return;
      }
      if (res.ok) {
        const status = data.finalStatus || (data.sentCount === 0 ? "failed" : data.failedCount > 0 ? "partial_failed" : "sent");
        const msg = status === "failed"
          ? `❌ ${data.total}명 중 전체 발송 실패`
          : status === "partial_failed"
            ? `⚠️ ${data.sentCount}/${data.total}명 발송, 실패 ${data.failedCount}건`
            : `✅ ${data.sentCount}명에게 발송 완료`;
        setNewsletterResult(msg);
        if (status === "failed") {
          toast.error(msg);
        } else if (status === "partial_failed") {
          toast.warning(msg);
        } else {
          toast.success(msg);
        }
        setLastSentAt(new Date().toISOString());
        setLastSendStatus(status);
        setLastSentCount(data.sentCount || 0);
        setLastFailedCount(data.failedCount || 0);
        setTimeout(() => setShowSendModal(false), 2000);
      } else {
        const msg = `❌ ${data.error}`;
        setNewsletterResult(msg);
        toast.error(data.error);
      }
    } catch {
      setNewsletterResult("❌ 네트워크 오류");
      toast.error("네트워크 오류");
    } finally {
      setSendingNewsletter(false);
    }
  };

  if (loading) {
    return <div className="text-[#666] text-sm py-8">로딩 중...</div>;
  }

  if (!post) {
    return <div className="text-[#666] text-sm py-8">글을 찾을 수 없습니다.</div>;
  }

  const filteredSubscribers = subscribers.filter((subscriber) =>
    !recipientSearch || subscriber.email.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  const isAllFilteredSelected = filteredSubscribers.length > 0
    && filteredSubscribers.every((subscriber) => selectedRecipientIds.includes(subscriber.id));

  const sendTargetCount = recipientMode === "selected" ? selectedRecipientIds.length : subscribers.length;

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipientIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId]
    );
  };

  const toggleAllFilteredRecipients = () => {
    if (isAllFilteredSelected) {
      setSelectedRecipientIds((current) => current.filter((id) => !filteredSubscribers.some((subscriber) => subscriber.id === id)));
      return;
    }

    setSelectedRecipientIds((current) => Array.from(new Set([...current, ...filteredSubscribers.map((subscriber) => subscriber.id)])));
  };

  const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;

  return (
    <div>
      {/* Header */}
      <button
        onClick={() => router.push("/blog-manage")}
        className="flex items-center gap-1 text-sm text-[#888] hover:text-[#fafafa] transition-colors mb-4 bg-transparent border-none cursor-pointer"
      >
        <ArrowLeft className="size-4" />
        목록으로
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#fafafa] mb-3">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 flex-wrap text-xs text-[#666]">
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
            <span>작성: {new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
            <span>수정: {new Date(post.updated_at).toLocaleDateString("ko-KR")}</span>
            <span>조회 {post.view_count ?? 0}</span>
            {post.reading_time && <span>{post.reading_time}분 읽기</span>}
            {lastSentAt && (
              <span className={lastSendStatus === "partial_failed" || lastSendStatus === "failed" ? "text-amber-300" : "text-green-400"}>
                📧 {new Date(lastSentAt).toLocaleDateString("ko-KR")} {lastSendStatus === "partial_failed" ? `일부 실패 (${lastSentCount}명 발송 / 실패 ${lastFailedCount}건)` : lastSendStatus === "failed" ? `실패 (${lastFailedCount}건)` : `발송됨${lastSentCount > 0 ? ` (${lastSentCount}명)` : ""}`}
              </span>
            )}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {post.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-[10px] bg-[#1a1a1a] text-[#888]"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Slug */}
          {post.slug && (
            <div className="mt-3">
              <a
                href={`/blog/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#4ECDC4] hover:text-[#5ff] transition-colors"
              >
                /blog/{post.slug}
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleNewsletterClick}
            disabled={actionLoading || sendingNewsletter}
            className="bg-[#fafafa] text-[#0a0a0a] hover:bg-[#e0e0e0]"
          >
            <Mail className="size-4 mr-1" />
            뉴스레터 발송
          </Button>
          {post.status === "draft" && (
            <Button
              size="sm"
              onClick={() => updateStatus("published")}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              게시
            </Button>
          )}
          {post.status === "published" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus("draft")}
              disabled={actionLoading}
            >
              비공개
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={actionLoading}>
                삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>글을 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 되돌릴 수 없습니다. 글과 관련된 카테고리, 태그 연결도 함께 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deletePost}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Newsletter Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#141414] border border-[#333] rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h2 className="text-lg font-bold text-[#fafafa]">뉴스레터 미리보기</h2>
              <button
                onClick={() => { setShowSendModal(false); setNewsletterResult(""); setPreviewHtml(""); }}
                className="text-[#888] hover:text-[#fafafa] bg-transparent border-none cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-0 flex-1 min-h-0">
              <div className="border-r border-[#222] p-4 overflow-auto">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setRecipientMode("all")}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${recipientMode === "all" ? "border-[#fafafa] text-[#fafafa] bg-[#fafafa]/10" : "border-[#333] text-[#888] hover:text-[#fafafa]"}`}
                  >
                    전체 발송
                  </button>
                  <button
                    onClick={() => {
                      setRecipientMode("selected");
                      if (subscribers.length === 0 && !loadingSubscribers) {
                        void loadSubscribers();
                      }
                    }}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${recipientMode === "selected" ? "border-[#fafafa] text-[#fafafa] bg-[#fafafa]/10" : "border-[#333] text-[#888] hover:text-[#fafafa]"}`}
                  >
                    선택 발송
                  </button>
                </div>

                <div className="text-xs text-[#666] mb-4">
                  {recipientMode === "all"
                    ? `현재 구독 중인 전체 ${subscribers.length}명에게 발송합니다.`
                    : `선택된 ${selectedRecipientIds.length}명에게만 발송합니다.`}
                </div>

                {recipientMode === "selected" && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#666]" />
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="이메일 검색"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#333] bg-[#0a0a0a] text-sm text-[#fafafa] outline-none"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-[#fafafa] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleAllFilteredRecipients}
                      />
                      검색 결과 전체 선택 ({filteredSubscribers.length}명)
                    </label>

                    <div className="rounded-lg border border-[#222] overflow-hidden max-h-[360px] overflow-y-auto">
                      {loadingSubscribers ? (
                        <div className="p-4 text-sm text-[#666]">구독자 불러오는 중...</div>
                      ) : subscriberLoadError ? (
                        <div className="p-4 space-y-2">
                          <div className="text-sm text-red-400">{subscriberLoadError}</div>
                          <button
                            onClick={() => void loadSubscribers()}
                            className="px-3 py-2 text-sm rounded-lg border border-[#333] text-[#fafafa] hover:bg-[#222]"
                          >
                            다시 불러오기
                          </button>
                        </div>
                      ) : filteredSubscribers.length === 0 ? (
                        <div className="p-4 text-sm text-[#666]">선택 가능한 구독자가 없습니다.</div>
                      ) : (
                        filteredSubscribers.map((subscriber) => (
                          <label
                            key={subscriber.id}
                            className="flex items-center gap-3 px-3 py-2 border-b border-[#1a1a1a] last:border-b-0 cursor-pointer hover:bg-[#111]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRecipientIds.includes(subscriber.id)}
                              onChange={() => toggleRecipient(subscriber.id)}
                            />
                            <div className="min-w-0">
                              <div className="text-sm text-[#fafafa] truncate">{subscriber.email}</div>
                              <div className="text-[11px] text-[#666]">{new Date(subscriber.subscribed_at).toLocaleDateString("ko-KR")}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4">
                {loadingPreview ? (
                  <div className="text-[#666] text-sm text-center py-12">미리보기 로드 중...</div>
                ) : (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full rounded-lg border border-[#222]"
                    style={{ height: "500px", background: "#0a0a0a" }}
                    sandbox=""
                    title="뉴스레터 미리보기"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-[#222]">
              {newsletterResult ? (
                <span className="text-sm">{newsletterResult}</span>
              ) : (
                <span className="text-xs text-[#666]">
                  {lastSentAt
                    ? `⚠️ ${new Date(lastSentAt).toLocaleDateString("ko-KR")}에 ${lastSentCount || 0}명 기준으로 발송됨 — 재발송 주의`
                    : "발송 대상과 내용을 확인하세요"}
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowSendModal(false); setNewsletterResult(""); setPreviewHtml(""); }}
                  className="px-4 py-2 text-sm rounded-lg border border-[#333] bg-transparent text-[#fafafa] hover:bg-[#222] cursor-pointer transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleNewsletterSend()}
                  disabled={sendingNewsletter || !!newsletterResult || (recipientMode === "selected" && selectedRecipientIds.length === 0) || loadingSubscribers || !!subscriberLoadError}
                  className="px-4 py-2 text-sm rounded-lg bg-[#fafafa] text-[#0a0a0a] font-semibold hover:bg-[#e0e0e0] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingNewsletter ? "발송 중..." : `${recipientMode === "selected" ? `선택 ${sendTargetCount}명` : `전체 ${sendTargetCount}명`} 발송 확인`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <hr className="border-[#222] mb-8" />

      {/* Thumbnail */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-[#888] mb-3">썸네일</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) {
              toast.error("이미지 파일만 업로드 가능합니다.");
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              toast.error("파일 크기는 5MB 이하여야 합니다.");
              return;
            }
            setUploading(true);
            try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("postId", id);
              const res = await fetch("/api/blog-manage/upload-thumbnail", {
                method: "POST",
                body: formData,
              });
              if (!res.ok) {
                const data = await res.json();
                toast.error("업로드 실패: " + (data.error || "알 수 없는 오류"));
                return;
              }
              toast.success("썸네일이 업로드되었습니다.");
              await fetchPost();
            } catch (error) {
              toast.error("업로드 중 오류가 발생했습니다.");
            } finally {
              setUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }
          }}
        />
        {post.thumbnail_url ? (
          <div>
            <div className="relative aspect-[16/9] max-w-md rounded-lg overflow-hidden bg-[#111]">
              <Image
                src={post.thumbnail_url}
                alt="썸네일"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                변경
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={async () => {
                  setUploading(true);
                  try {
                    await fetch(`/api/blog-manage/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ thumbnail_url: null, skipPublishedAt: true }),
                    });
                    await fetchPost();
                  } catch (error) {
                    toast.error("삭제 중 오류가 발생했습니다.");
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                삭제
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full max-w-md aspect-[16/9] rounded-lg border border-dashed border-[#333] bg-[#111] hover:border-[#555] transition-colors flex items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <span className="text-sm text-[#666]">
              {uploading ? "업로드 중..." : "썸네일 추가"}
            </span>
          </button>
        )}
      </div>

      {/* Content */}
      {editMode ? (
        <BlogManageEditor
          postId={id}
          initialContent={post.content || []}
          onSave={() => { setEditMode(false); fetchPost(); }}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <div>
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              편집
            </Button>
          </div>
          <PlatePreview content={post.content || []} />
        </div>
      )}
    </div>
  );
}
