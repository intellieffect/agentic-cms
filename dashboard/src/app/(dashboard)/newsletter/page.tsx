"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Trash2, Plus, Search, X } from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  status: string;
  subscribed_at: string;
}

interface EmailLog {
  id: string;
  subject: string;
  sent_to_count: number;
  attempted_count: number;
  failed_count: number;
  sent_at: string | null;
  status: string;
  created_at: string;
  post_id: string | null;
}

interface Delivery {
  id: string;
  recipient_email: string;
  status: "sent" | "failed";
  error_message: string | null;
  provider_message_id: string | null;
  attempted_at: string;
  subscriber_id: string | null;
}

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [tab, setTab] = useState<"compose" | "subscribers" | "logs">("compose");

  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [retryResult, setRetryResult] = useState("");

  // Subscriber management states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [addingSubscriber, setAddingSubscriber] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [subsRes, logsRes] = await Promise.all([
        fetch("/api/newsletter/subscribers"),
        fetch("/api/newsletter/send-history"),
      ]);
      const subsData = await subsRes.json();
      const logsData = await logsRes.json();
      if (subsData.subscribers) setSubscribers(subsData.subscribers);
      if (logsData.logs) setLogs(logsData.logs);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = subscribers.filter((s) => s.status === "subscribed").length;

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((s) => {
      const matchesSearch = !searchQuery || s.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscribers, searchQuery, statusFilter]);

  async function handleSend() {
    if (!subject || !bodyHtml) { setResult("제목과 본문을 입력하세요."); return; }
    if (!confirm(`구독자 ${activeCount}명에게 발송하시겠습니까?`)) return;
    setSending(true);
    setResult("");
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyHtml }),
      });
      const data = await res.json();
      if (res.ok) {
        const status = data.finalStatus || (data.sentCount === 0 ? "failed" : data.failedCount > 0 ? "partial_failed" : "sent");
        const message = status === "failed"
          ? `${data.total}명 중 전체 발송 실패`
          : status === "partial_failed"
            ? `${data.sentCount}/${data.total}명 발송 / 실패 ${data.failedCount}건`
            : `${data.sentCount}/${data.total}명 발송 완료`;
        setResult(message);
        setSubject("");
        setBodyHtml("");
        load();
      } else {
        setResult(`오류: ${data.error}`);
      }
    } catch {
      setResult("네트워크 오류");
    }
    setSending(false);
  }

  const closeModal = () => {
    setSelectedLog(null);
    setDeliveries([]);
    setRetryResult("");
  };

  const handleLogClick = async (log: EmailLog) => {
    setSelectedLog(log);
    setDeliveries([]);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/newsletter/deliveries?emailLogId=${log.id}`);
      const data = await res.json();
      if (res.ok) {
        setDeliveries(data.deliveries || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!selectedLog) return;

    if (!selectedLog.post_id) {
      setRetryResult("직접 작성 발송 건은 재전송을 지원하지 않습니다.");
      return;
    }

    const failedSubscriberIds = deliveries
      .filter((d) => d.status === "failed" && d.subscriber_id)
      .map((d) => d.subscriber_id as string);

    if (failedSubscriberIds.length === 0) return;
    if (!confirm(`실패한 ${failedSubscriberIds.length}명에게 재전송하시겠습니까?`)) return;

    setRetryingFailed(true);
    setRetryResult("");
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedLog.post_id,
          recipientIds: failedSubscriberIds,
          force: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.failedCount > 0
          ? `${data.sentCount}/${data.total}명 재발송 완료, 실패 ${data.failedCount}건`
          : `${data.sentCount}명 재발송 완료`;
        setRetryResult(msg);
        load();
        if (data.emailLogId) {
          const newLog: EmailLog = {
            id: data.emailLogId,
            subject: selectedLog.subject,
            sent_to_count: data.sentCount ?? 0,
            attempted_count: data.total ?? 0,
            failed_count: data.failedCount ?? 0,
            sent_at: new Date().toISOString(),
            status: data.finalStatus ?? "sent",
            created_at: new Date().toISOString(),
            post_id: selectedLog.post_id,
          };
          setSelectedLog(newLog);
          await handleLogClick(newLog);
        }
      } else {
        setRetryResult(`오류: ${data.error}`);
      }
    } catch {
      setRetryResult("네트워크 오류");
    } finally {
      setRetryingFailed(false);
    }
  };

  async function handleAddSubscriber() {
    if (!newEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      alert("유효한 이메일을 입력하세요.");
      return;
    }
    setAddingSubscriber(true);
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewEmail("");
        setShowAddForm(false);
        load();
      } else {
        alert(data.error || "추가 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setAddingSubscriber(false);
    }
  }

  async function handleUnsubscribe(id: string) {
    if (!confirm("이 구독자를 구독 해지하시겠습니까?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/newsletter/subscribers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "unsubscribed" }),
      });
      if (res.ok) {
        load();
      } else {
        alert("처리 실패");
      }
    } catch {
      alert("처리 실패");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">뉴스레터</h1>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        {[
          { label: "전체 구독자", value: subscribers.length },
          { label: "활성 구독자", value: activeCount },
          { label: "발송 이력", value: logs.length },
        ].map((s) => (
          <div key={s.label} className="flex-1 p-4 rounded-xl border border-border bg-card">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["compose", "subscribers", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors bg-transparent cursor-pointer ${
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "compose" ? "작성" : t === "subscribers" ? "구독자" : "발송 이력"}
          </button>
        ))}
      </div>

      {/* Compose */}
      {tab === "compose" && (
        <div className="space-y-4">
          {/* Note about blog-based sending */}
          <div className="p-3 rounded-lg border border-border bg-card text-sm text-muted-foreground">
            게시글을 뉴스레터로 발송하려면{" "}
            <a href="/publications" className="text-foreground underline hover:text-muted-foreground">
              Publications
            </a>{" "}
            페이지에서 해당 글의 &quot;뉴스레터 발송&quot; 버튼을 사용하세요.
          </div>

          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="뉴스레터 제목"
            className="w-full p-3 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-ring"
          />
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="본문 (HTML)"
            rows={12}
            className="w-full p-3 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-ring font-mono resize-y"
          />
          <div className="flex items-center gap-4">
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? "발송 중..." : `${activeCount}명에게 발송`}
            </button>
            {result && <span className="text-sm">{result}</span>}
          </div>
        </div>
      )}

      {/* Subscribers */}
      {tab === "subscribers" && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이메일 검색..."
                className="w-full pl-10 pr-8 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-ring"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Status filters */}
            <div className="flex gap-1">
              {([
                { key: "all", label: "전체" },
                { key: "subscribed", label: "구독중" },
                { key: "unsubscribed", label: "해지됨" },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
                    statusFilter === f.key
                      ? "border-foreground text-foreground bg-accent"
                      : "border-input text-muted-foreground bg-transparent hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Add subscriber button */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3" />
              구독자 추가
            </button>
          </div>

          {/* Add subscriber inline form */}
          {showAddForm && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-input bg-card">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="이메일 입력"
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-ring"
                onKeyDown={(e) => e.key === "Enter" && handleAddSubscriber()}
              />
              <button
                onClick={handleAddSubscriber}
                disabled={addingSubscriber}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold cursor-pointer hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {addingSubscriber ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewEmail(""); }}
                className="px-3 py-2 text-sm rounded-lg border border-input text-muted-foreground bg-transparent hover:text-foreground cursor-pointer transition-colors"
              >
                취소
              </button>
            </div>
          )}

          {/* Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left p-3 text-muted-foreground font-medium">이메일</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">상태</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">구독일</th>
                  <th className="text-right p-3 text-muted-foreground font-medium w-16">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((s) => (
                  <tr key={s.id} className="border-b border-border">
                    <td className="p-3">{s.email}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        s.status === "subscribed" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
                      }`}>
                        {s.status === "subscribed" ? "구독중" : "해지됨"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(s.subscribed_at).toLocaleDateString("ko")}</td>
                    <td className="p-3 text-right">
                      {s.status === "subscribed" && (
                        <button
                          onClick={() => handleUnsubscribe(s.id)}
                          disabled={deletingId === s.id}
                          className="text-muted-foreground hover:text-red-400 bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50"
                          title="구독 해지"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSubscribers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      {searchQuery || statusFilter !== "all" ? "검색 결과가 없습니다." : "구독자가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Count */}
          {filteredSubscribers.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              {filteredSubscribers.length}명 표시 / 전체 {subscribers.length}명
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {tab === "logs" && (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left p-3 text-muted-foreground font-medium">제목</th>
                <th className="text-left p-3 text-muted-foreground font-medium">발송수</th>
                <th className="text-left p-3 text-muted-foreground font-medium">실패수</th>
                <th className="text-left p-3 text-muted-foreground font-medium">상태</th>
                <th className="text-left p-3 text-muted-foreground font-medium">발송일</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setRetryResult(""); handleLogClick(l); }}
                >
                  <td className="p-3">
                    {l.subject}
                    {l.post_id && (
                      <a
                        href={`/publications/${l.post_id}`}
                        className="ml-2 text-xs text-muted-foreground hover:text-foreground underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        게시글 보기
                      </a>
                    )}
                  </td>
                  <td className="p-3">{l.sent_to_count}/{l.attempted_count || l.sent_to_count}</td>
                  <td className="p-3">{l.failed_count || 0}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      l.status === "sent"
                        ? "bg-green-900/30 text-green-400"
                        : l.status === "partial_failed"
                          ? "bg-amber-900/30 text-amber-300"
                          : l.status === "failed"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-blue-900/30 text-blue-300"
                    }`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{l.sent_at ? new Date(l.sent_at).toLocaleDateString("ko") : "-"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">발송 이력이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delivery Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">{selectedLog.subject}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedLog.sent_at ? new Date(selectedLog.sent_at).toLocaleString("ko-KR") : "-"}
                  {" / "}성공 {selectedLog.sent_to_count} / 실패 {selectedLog.failed_count}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
              {loadingDeliveries ? (
                <div className="p-6 text-center text-sm text-muted-foreground">불러오는 중...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted sticky top-0">
                      <th className="text-left p-3 text-muted-foreground font-medium">이메일</th>
                      <th className="text-left p-3 text-muted-foreground font-medium w-20">상태</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">실패 사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id} className="border-b border-border">
                        <td className="p-3 font-mono text-xs">{d.recipient_email}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                            d.status === "sent"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-red-900/30 text-red-400"
                          }`}>
                            {d.status === "sent" ? "성공" : "실패"}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{d.error_message || "-"}</td>
                      </tr>
                    ))}
                    {deliveries.length === 0 && !loadingDeliveries && (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-muted-foreground">상세 이력 없음</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {(() => {
              const failedCount = deliveries.filter((d) => d.status === "failed").length;
              return (
                <div className="flex items-center justify-between p-4 border-t border-border">
                  {retryResult ? (
                    <span className="text-sm">{retryResult}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {failedCount > 0 ? `실패 ${failedCount}건 재전송 가능` : ""}
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-sm rounded-lg border border-input bg-transparent text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      닫기
                    </button>
                    {selectedLog.post_id && deliveries.some((d) => d.status === "failed" && d.subscriber_id) && (
                      <button
                        onClick={handleRetryFailed}
                        disabled={retryingFailed}
                        className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {retryingFailed ? "재전송 중..." : `실패 ${failedCount}건 재전송`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
