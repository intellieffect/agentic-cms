// Newsletter HTML template. 브랜딩(발신인 이름, 도메인) 은 env 에서 주입.
//   NEXT_PUBLIC_BRAND_NAME       — 발신인 이름 (예: "Bruce Choe") — 헤더에 노출
//   NEXT_PUBLIC_CONTACT_DOMAIN   — 뉴스레터 도메인 (예: "agenticworkflows.club") — 헤더 + 푸터
// 값이 없으면 generic 문구 사용.

export function newsletterHtml(subject: string, bodyHtml: string, unsubscribeUrl: string) {
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "";
  const contactDomain = process.env.NEXT_PUBLIC_CONTACT_DOMAIN || "";
  const newsletterLabel = contactDomain
    ? `${contactDomain} newsletter`
    : "newsletter";
  const footerLabel = contactDomain
    ? `이 메일은 ${contactDomain} 뉴스레터를 구독하셔서 발송되었습니다.`
    : "이 메일은 뉴스레터를 구독하셔서 발송되었습니다.";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 0 20px;border-bottom:1px solid #2a2a2a;">
              ${brandName ? `<div style="font-size:18px;line-height:1.4;font-weight:700;color:#fafafa;">${brandName}</div>` : ""}
              <div style="margin-top:4px;font-size:13px;line-height:1.5;color:#8a8a8a;">${newsletterLabel}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 12px;font-size:16px;line-height:1.8;color:#f0f0f0;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0;border-top:1px solid #2a2a2a;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#7a7a7a;text-align:center;">
                ${footerLabel}
              </p>
              <p style="margin:0;text-align:center;">
                <a href="${unsubscribeUrl}" style="font-size:12px;line-height:1.6;color:#a3a3a3;text-decoration:underline;">구독 해지</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
