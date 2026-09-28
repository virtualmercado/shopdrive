// Relatório mensal MARCA — renderização HTML a partir do SNAPSHOT (nunca recalcula).
export interface ReportTemplateSnap {
  name: string; status: string; productsCount: number; linkAvailable: boolean; templateSlug: string | null;
  validClicks: number; validActivations: number; conversionPercent: number;
  totalValidActivations: number; operationalTotal: number;
}
export interface ReportMetricsSnap {
  periodLabel: string; validClicks: number; validActivations: number; conversionPercent: number;
  totalValidActivations: number; operationalTotal: number; generatedAt: string;
}

const APP_ORIGIN = "https://shopdrive.com.br";
export const MINHA_REDE_URL = `${APP_ORIGIN}/lojista/minha-rede`;
export const templateLink = (slug: string) => `${APP_ORIGIN}/criar-conta?template=${slug}`;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const int = (n: unknown) => new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));
const pct = (n: unknown) => `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0))}%`;
const statusLabel = (s: string) => s === "active" ? "Ativo" : s === "draft" ? "Em preparação" : s === "inactive" ? "Inativo" : s;
const dateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }) + " (UTC)";

const card = (label: string, value: string) =>
  `<td class="c" style="padding:6px;width:33%;vertical-align:top"><div style="background:#f5f5f4;border-radius:10px;padding:14px;text-align:center">` +
  `<div style="font-size:22px;font-weight:bold;color:#111">${value}</div><div style="font-size:12px;color:#555;margin-top:4px">${label}</div></div></td>`;

export function renderBrandNetworkReportHtml(brandName: string, m: ReportMetricsSnap, templates: ReportTemplateSnap[]): string {
  const rows = templates.map((t) => {
    const link = t.linkAvailable && t.templateSlug
      ? `<a href="${esc(templateLink(t.templateSlug))}" style="color:#c2410c">Link do template</a>` : "Link indisponível";
    return `<div style="border:1px solid #e7e5e4;border-radius:10px;padding:14px;margin-bottom:10px">
<div style="font-weight:bold;font-size:15px;color:#111">${esc(t.name)}</div>
<div style="font-size:12px;color:#666;margin:2px 0 8px">${esc(statusLabel(t.status))} · ${int(t.productsCount)} produtos · ${link}</div>
<table role="presentation" width="100%" style="font-size:13px;color:#333;border-collapse:collapse">
<tr><td>Cliques no mês</td><td align="right"><b>${int(t.validClicks)}</b></td></tr>
<tr><td>Lojas criadas no mês</td><td align="right"><b>${int(t.validActivations)}</b></td></tr>
<tr><td>Conversão no mês</td><td align="right"><b>${pct(t.conversionPercent)}</b></td></tr>
<tr><td>Total de lojas atuais</td><td align="right"><b>${int(t.totalValidActivations)}</b></td></tr>
<tr><td>Lojas prontas atuais</td><td align="right"><b>${int(t.operationalTotal)}</b></td></tr>
</table></div>`;
  }).join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media (max-width:480px){.c{display:block!important;width:100%!important}}</style></head>
<body style="margin:0;background:#ffffff;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="text-align:center;margin-bottom:20px">
<h1 style="font-size:22px;color:#111;margin:0 0 4px">Relatório mensal da sua rede</h1>
<div style="font-size:13px;color:#666">Plano MARCA — ShopDrive</div>
<div style="font-size:15px;color:#111;margin-top:10px"><b>${esc(brandName)}</b></div>
<div style="font-size:13px;color:#666">Período: ${esc(m.periodLabel)}</div>
</div>
<h2 style="font-size:15px;color:#111;margin:16px 0 6px">Resumo do mês</h2>
<table role="presentation" width="100%" style="border-collapse:collapse"><tr>
${card("Cliques", int(m.validClicks))}${card("Lojas criadas", int(m.validActivations))}${card("Conversão", pct(m.conversionPercent))}
</tr></table>
<h2 style="font-size:15px;color:#111;margin:20px 0 6px">Situação atual da rede na data de geração</h2>
<table role="presentation" width="100%" style="border-collapse:collapse"><tr>
${card("Total de lojas da rede", int(m.totalValidActivations))}${card("Lojas prontas", int(m.operationalTotal))}
</tr></table>
<p style="font-size:12px;color:#666;margin:6px 0 0">Lojas prontas são aquelas que concluíram os requisitos mínimos de configuração da ShopDrive. Dados gerados em ${esc(dateTime(m.generatedAt))}.</p>
<h2 style="font-size:15px;color:#111;margin:20px 0 8px">Desempenho por template</h2>
${rows}
<div style="text-align:center;margin:24px 0">
<a href="${MINHA_REDE_URL}" style="background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">Acessar Minha Rede</a>
</div>
<p style="font-size:11px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:14px">Este relatório é gerado automaticamente pela ShopDrive. Período em UTC.</p>
</div></body></html>`;
}
