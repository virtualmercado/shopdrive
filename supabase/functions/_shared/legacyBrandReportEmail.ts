// Renderer do relatório legado (send-brand-reports). Extraído sem alterações.
// Compartilhado pelo envio real e pelo envio de teste do Painel Master.
export function buildReportHtml(tpl: Record<string, unknown>, reportType: string, monthKey: string, usedFallback: boolean): string {
  const clicks = (tpl.link_clicks as number) || 0;
  const accounts = (tpl.stores_created as number) || 0;
  const conversion = clicks > 0 ? Math.round((accounts / clicks) * 100) : 0;
  const productsCount = (tpl.products_count as number) || 0;
  const status = (tpl.status as string) || "—";
  const templateSlug = (tpl.template_slug as string) || "—";
  const isLinkActive = tpl.is_link_active ? "Sim" : "Não";
  const updatedAt = tpl.updated_at ? new Date(tpl.updated_at as string).toLocaleDateString("pt-BR") : "—";

  const maxBar = Math.max(clicks, accounts, 1);
  const clicksBar = "\u2588".repeat(Math.max(1, Math.round((clicks / maxBar) * 20)));
  const accountsBar = "\u2588".repeat(Math.max(1, Math.round((accounts / maxBar) * 20)));

  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head><meta charset="utf-8"></head>',
    '<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">',
    '  <div style="text-align: center; margin-bottom: 30px;">',
    `    <h1 style="color: #111; font-size: 24px; margin-bottom: 4px;">Relatório mensal — ${tpl.name}</h1>`,
    `    <p style="color: #666; font-size: 14px;">Período: ${monthKey}</p>`,
    reportType === "manual_test" ? '    <p style="color: #e67e22; font-size: 13px; font-weight: bold;">⚠️ Este é um envio de teste</p>' : '',
    usedFallback ? '    <p style="color: #e67e22; font-size: 13px;">📧 Enviado para email administrativo (marca sem email configurado)</p>' : '',
    '  </div>',
    '  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">',
    '    <table style="width: 100%; border-collapse: collapse;">',
    '      <tr>',
    '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #666; font-size: 14px;">Status</span></td>',
    `        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong style="font-size: 18px; color: #111;">${status}</strong></td>`,
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #666; font-size: 14px;">Produtos</span></td>',
    `        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong style="font-size: 18px; color: #111;">${productsCount}</strong></td>`,
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #666; font-size: 14px;">Cliques no link</span></td>',
    `        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong style="font-size: 24px; color: #111;">${clicks}</strong></td>`,
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #666; font-size: 14px;">Contas criadas</span></td>',
    `        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong style="font-size: 24px; color: #111;">${accounts}</strong></td>`,
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #666; font-size: 14px;">Taxa de conversão</span></td>',
    `        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong style="font-size: 24px; color: #111;">${conversion}%</strong></td>`,
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #666; font-size: 14px;">Link ativo</span></td>',
    `        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong style="font-size: 18px; color: #111;">${isLinkActive}</strong></td>`,
    '      </tr>',
    '      <tr>',
    '        <td style="padding: 12px 0;"><span style="color: #666; font-size: 14px;">Última atualização</span></td>',
    `        <td style="padding: 12px 0; text-align: right;"><strong style="font-size: 18px; color: #111;">${updatedAt}</strong></td>`,
    '      </tr>',
    '    </table>',
    '  </div>',
    '  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">',
    `    <p style="color: #666; font-size: 13px; margin: 0 0 4px;">Template: <strong>${templateSlug}</strong></p>`,
    `    <p style="color: #666; font-size: 13px; margin: 0 0 8px 0;">Cliques &nbsp; <span style="font-family: monospace; color: #5B9BD5;">${clicksBar}</span> &nbsp; ${clicks}</p>`,
    `    <p style="color: #666; font-size: 13px; margin: 0;">Contas &nbsp;&nbsp; <span style="font-family: monospace; color: #70AD47;">${accountsBar}</span> &nbsp; ${accounts}</p>`,
    '  </div>',
    '  <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">',
    '    <p style="color: #999; font-size: 12px;">Este relatório é gerado automaticamente pela ShopDrive.</p>',
    '  </div>',
    '</body>',
    '</html>',
  ].join('\n');
}
