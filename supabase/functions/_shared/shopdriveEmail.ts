// Template base ShopDrive para e-mails futuros (marketing em especial).
// Transacionais existentes NÃO foram migrados para cá.

export type ShopDriveEmailCategory = "transactional" | "marketing";

export interface ShopDriveEmailInput {
  title: string;
  bodyHtml: string;
  category: ShopDriveEmailCategory;
  /** Obrigatório para marketing: link /descadastro?token=... (nunca o e-mail). */
  unsubscribeUrl?: string;
  preheader?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function marketingFooter(unsubscribeUrl: string): string {
  if (!/^https:\/\/[^?]+\?token=[A-Za-z0-9_-]{20,}$/.test(unsubscribeUrl) || /@/.test(unsubscribeUrl)) {
    throw new Error("invalid_unsubscribe_url");
  }
  return `<p style="margin:0 0 8px">Você está recebendo esta mensagem porque possui uma conta/relacionamento com a ShopDrive.</p>
<p style="margin:0"><a href="${esc(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline">Não quero receber comunicações comerciais</a></p>`;
}

export function renderShopDriveEmail(input: ShopDriveEmailInput): string {
  if (input.category === "marketing" && !input.unsubscribeUrl) throw new Error("marketing_requires_unsubscribe_url");
  const footer = input.category === "marketing"
    ? marketingFooter(input.unsubscribeUrl!)
    : `<p style="margin:0">ShopDrive · shopdrive.com.br</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111827">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(input.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;font-size:20px;font-weight:bold">ShopDrive</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">${input.bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}
