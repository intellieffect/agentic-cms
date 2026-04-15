import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { newsletterHtml } from "@/lib/blog/newsletter-template";
import { plateToEmailHtml } from "@/lib/blog/plateToEmail";
import { resolveImageUrl } from "@/lib/blog/resolveImageUrl";

export const maxDuration = 60; // seconds

type SubscriberRow = {
  id: string;
  email: string;
};

type DeliveryInsert = {
  email_log_id: string;
  post_id: string | null;
  subscriber_id: string | null;
  recipient_email: string;
  status: "sent" | "failed";
  provider_message_id: string | null;
  error_message: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  if (typeof record.error === "string" && record.error.trim()) return record.error;

  return fallback;
}

const MIN_INTERVAL_MS = 350; // ~2.8 req/s, Resend limit is 5/s

async function sendWithRateLimit<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);

  for (let i = 0; i < items.length; i++) {
    const start = Date.now();
    results[i] = await worker(items[i], i);
    if (i < items.length - 1) {
      const elapsed = Date.now() - start;
      const wait = MIN_INTERVAL_MS - elapsed;
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();

    const { subject, bodyHtml, postId, preview, recipientIds, force } = await req.json();

    let effectiveSubject = "";
    let effectiveBodyHtml = "";

    if (postId) {
      const { data: post } = await sb
        .from("blog_posts")
        .select("title, content, slug, thumbnail_url, status")
        .eq("id", postId)
        .single();

      if (!post) {
        return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 400 });
      }

      if (!post.title?.trim()) {
        return NextResponse.json({ error: "게시글 제목이 비어 있습니다." }, { status: 400 });
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://agenticworkflows.club";
      const supabaseStorageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/blog-images`;

      let thumbnailHtml = "";
      const thumbSrc = post.thumbnail_url;
      if (thumbSrc) {
        const imgUrl = resolveImageUrl(thumbSrc, supabaseStorageUrl);
        const escapeAttr = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        const safeImgUrl = escapeAttr(imgUrl);
        const safeTitle = escapeAttr(post.title);
        thumbnailHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 28px;"><img src="${safeImgUrl}" alt="${safeTitle}" style="width:100%;max-width:600px;height:auto;border-radius:10px;display:block;" /></td></tr></table>`;
      }

      const html = thumbnailHtml + plateToEmailHtml(post.content || [], siteUrl, supabaseStorageUrl);
      if (!html.trim()) {
        return NextResponse.json({ error: "게시글 내용이 비어있습니다." }, { status: 400 });
      }

      const viewLink = post.status === "published" && post.slug?.trim()
        ? `<p style="margin:24px 0 0;"><a href="${siteUrl}/blog/${post.slug}" style="color:#888;text-decoration:underline;font-size:13px;">원문 보기 →</a></p>`
        : "";

      effectiveSubject = post.title;
      effectiveBodyHtml = html + viewLink;

      if (preview) {
        const previewHtml = newsletterHtml(effectiveSubject, effectiveBodyHtml, "#");
        return NextResponse.json({ ok: true, previewHtml, subject: effectiveSubject });
      }
    } else {
      if (!subject || !bodyHtml) {
        return NextResponse.json({ error: "제목과 본문을 입력하세요." }, { status: 400 });
      }

      effectiveSubject = subject;
      effectiveBodyHtml = bodyHtml;
    }

    const recipientIdsProvided = recipientIds !== undefined;
    const requestedRecipientIds = Array.isArray(recipientIds)
      ? Array.from(new Set(recipientIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
      : null;

    if (recipientIdsProvided && !Array.isArray(recipientIds)) {
      return NextResponse.json({ error: "recipientIds 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (recipientIdsProvided && requestedRecipientIds && requestedRecipientIds.length === 0) {
      return NextResponse.json({ error: "선택된 수신자가 없습니다." }, { status: 400 });
    }

    let subscribersQuery = sb
      .from("subscribers")
      .select("id, email")
      .eq("status", "subscribed");

    if (requestedRecipientIds && requestedRecipientIds.length > 0) {
      subscribersQuery = subscribersQuery.in("id", requestedRecipientIds);
    }

    const { data: subscribers } = await subscribersQuery;

    const uniqueSubscribers = Array.from(
      new Map(
        (subscribers || [])
          .map((subscriber) => ({
            id: subscriber.id,
            email: normalizeEmail(subscriber.email),
          }))
          .filter((subscriber): subscriber is SubscriberRow => Boolean(subscriber.email))
          .map((subscriber) => [subscriber.email, subscriber])
      ).values()
    );

    if (uniqueSubscribers.length === 0) {
      return NextResponse.json({ error: "구독자가 없습니다." }, { status: 400 });
    }

    if (postId && !preview && !force) {
      const { data: existingLogs, error: existingLogsError } = await sb
        .from("email_logs")
        .select("id, status, sent_at")
        .eq("post_id", postId)
        .in("status", ["sending", "sent", "partial_failed"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingLogsError) {
        return NextResponse.json(
          { error: "기존 발송 이력 확인에 실패했습니다." },
          { status: 500 },
        );
      }

      const existing = existingLogs?.[0];
      if (existing) {
        return NextResponse.json(
          {
            error: "이미 이 게시글에 대한 발송이 진행 중이거나 완료되었습니다. 재발송하려면 force 플래그가 필요합니다.",
            existingEmailLogId: existing.id,
            existingStatus: existing.status,
            existingSentAt: existing.sent_at,
          },
          { status: 409 },
        );
      }
    }

    const { data: emailLog, error: emailLogInsertError } = await sb
      .from("email_logs")
      .insert({
        subject: effectiveSubject,
        body_html: effectiveBodyHtml,
        sent_to_count: 0,
        attempted_count: uniqueSubscribers.length,
        failed_count: 0,
        status: "sending",
        post_id: postId || null,
      })
      .select("id")
      .single();

    if (emailLogInsertError || !emailLog) {
      return NextResponse.json({ error: "발송 작업 생성에 실패했습니다." }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://agenticworkflows.club";
    let sentCount = 0;
    let failedCount = 0;
    let trackingErrorCount = 0;
    let aggregateFailedCount = 0;
    const errors: string[] = [];

    await sendWithRateLimit(uniqueSubscribers, async (subscriber) => {
      const token = Buffer.from(subscriber.email, "utf-8").toString("base64url");
      const unsubUrl = `${baseUrl}/newsletter/unsubscribe?token=${token}`;
      const html = newsletterHtml(effectiveSubject, effectiveBodyHtml, unsubUrl);

      let delivery: DeliveryInsert;

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Bruce Choe <newsletter@brxce.ai>",
            to: [subscriber.email],
            subject: effectiveSubject,
            html,
          }),
        });

        const payload = await resendResponse.json().catch(() => null);

        if (resendResponse.ok) {
          sentCount += 1;
          delivery = {
            email_log_id: emailLog.id,
            post_id: postId || null,
            subscriber_id: subscriber.id,
            recipient_email: subscriber.email,
            status: "sent",
            provider_message_id:
              payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).id === "string"
                ? ((payload as Record<string, unknown>).id as string)
                : null,
            error_message: null,
          };
        } else {
          failedCount += 1;
          aggregateFailedCount += 1;
          const message = extractErrorMessage(payload, `HTTP ${resendResponse.status}`);
          errors.push(`${subscriber.email}: ${message}`);
          delivery = {
            email_log_id: emailLog.id,
            post_id: postId || null,
            subscriber_id: subscriber.id,
            recipient_email: subscriber.email,
            status: "failed",
            provider_message_id: null,
            error_message: message,
          };
        }
      } catch (error) {
        failedCount += 1;
        aggregateFailedCount += 1;
        const message = error instanceof Error ? error.message : "네트워크 오류";
        errors.push(`${subscriber.email}: ${message}`);
        delivery = {
          email_log_id: emailLog.id,
          post_id: postId || null,
          subscriber_id: subscriber.id,
          recipient_email: subscriber.email,
          status: "failed",
          provider_message_id: null,
          error_message: message,
        };
      }

      const { error: deliveryInsertError } = await sb.from("newsletter_deliveries").insert(delivery);
      if (deliveryInsertError) {
        trackingErrorCount += 1;
        if (delivery.status === "sent") {
          aggregateFailedCount += 1;
        }
        errors.push(`${subscriber.email}: delivery log insert failed (${deliveryInsertError.message})`);
      }
    });

    const finalStatus =
      sentCount === 0
        ? "failed"
        : aggregateFailedCount === 0 && trackingErrorCount === 0
          ? "sent"
          : "partial_failed";

    await sb
      .from("email_logs")
      .update({
        sent_to_count: sentCount,
        attempted_count: uniqueSubscribers.length,
        failed_count: aggregateFailedCount,
        sent_at: new Date().toISOString(),
        status: finalStatus,
      })
      .eq("id", emailLog.id);

    return NextResponse.json({
      ok: true,
      emailLogId: emailLog.id,
      sentCount,
      failedCount: aggregateFailedCount,
      providerFailedCount: failedCount,
      trackingErrorCount,
      finalStatus,
      total: uniqueSubscribers.length,
      errors,
    });
  } catch (error) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
