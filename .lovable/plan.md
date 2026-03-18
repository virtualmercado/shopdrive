

## Refatoração Multi-Tenant do Módulo de E-mails

### Situação Atual

O sistema atual possui:
- **`platform_email_settings`** — config global com provider "resend" ou "smtp"
- **`tenant_email_settings`** — focado em domínio/DNS (SPF, DKIM, DMARC), sem SMTP próprio do lojista
- **`email_templates`** — templates globais da plataforma (sem personalização por tenant)
- **`email_queue`** — fila de envio processada por `process-email-queue`
- **`email_logs`** — logs de envio
- **`email_send_logs`** — logs secundários (usado pelo hook `useEmailTemplates`)
- Dependência de **Resend** em 3 edge functions: `process-email-queue`, `send-order-notifications`, `send-landing-ticket-response`

### Plano de Implementação

---

#### 1. Migrações de Banco de Dados

**1a. Atualizar `platform_email_settings`** — adicionar coluna `allow_tenant_custom_smtp` (boolean, default true)

**1b. Reestruturar `tenant_email_settings`** — adicionar colunas para SMTP próprio do lojista:
- `smtp_mode` (text, default 'platform') — valores: 'platform' | 'custom'
- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_security`
- `is_smtp_validated` (boolean, default false)
- `last_tested_at` (timestamptz)
- `last_test_status` (text)
- `last_test_error` (text)

**1c. Criar tabela `tenant_email_templates`** — personalização de templates por lojista:
- `id`, `tenant_id` (ref profiles), `event_key`, `subject`, `html_body`, `text_body`, `is_enabled`, `created_at`, `updated_at`
- Unique constraint em `(tenant_id, event_key)`
- RLS: lojista acessa apenas seus próprios templates

**1d. Atualizar `email_logs`** — adicionar coluna `provider_source` (text, 'platform' | 'tenant_custom')

---

#### 2. Edge Function: `test-tenant-smtp`

Nova edge function para testar conexão SMTP do lojista:
- Recebe `tenant_id`, credenciais SMTP
- Tenta handshake SMTP (EHLO + AUTH)
- Retorna sucesso/falha
- Atualiza `tenant_email_settings` com `is_smtp_validated`, `last_tested_at`, `last_test_status`, `last_test_error`

---

#### 3. Refatorar `process-email-queue` (EmailService Central)

Modificar a lógica de resolução de SMTP:
1. Carregar `platform_email_settings` (global)
2. Se `email.tenant_id` existe:
   - Carregar `tenant_email_settings` do lojista
   - Se `smtp_mode = 'custom'` E `is_smtp_validated = true` E `allow_tenant_custom_smtp = true` → usar SMTP do lojista
   - Caso contrário → usar SMTP da plataforma
3. Carregar template personalizado do tenant (`tenant_email_templates`) se existir; senão usar template global
4. Remover toda referência a Resend — usar apenas SMTP
5. Registrar `provider_source` nos logs

---

#### 4. Remover Resend de todas as Edge Functions

- **`process-email-queue`** — remover `sendViaResend`, usar apenas `sendViaSMTP`
- **`send-order-notifications`** — refatorar para enfileirar na `email_queue` em vez de chamar Resend diretamente
- **`send-landing-ticket-response`** — refatorar para enfileirar na `email_queue` em vez de chamar Resend diretamente

---

#### 5. Painel do Administrador — Atualizar `EmailTemplatesTab`

Na aba "Configuração de Envio":
- Remover opção "Resend (API)" do seletor de provedor
- Manter apenas "SMTP" como provedor
- Adicionar switch "Permitir SMTP próprio por lojista" (`allow_tenant_custom_smtp`)

---

#### 6. Painel do Lojista — Nova Seção de E-mail

Refatorar `TenantEmailSettingsSection` para incluir:

**6a. Seletor de Modo de Envio:**
- Radio: "Usar e-mail padrão da plataforma" / "Usar meu próprio SMTP"
- Condicionalmente exibir formulário SMTP quando modo = custom

**6b. Formulário SMTP Próprio** (quando modo = custom):
- Campos: host, porta, usuário, senha (mascarada), segurança (TLS/SSL/None)
- Campos: sender_name, sender_email, reply_to
- Botão "Testar Conexão" → chama `test-tenant-smtp`
- Badge de status visual (Validado/Não validado/Erro)

**6c. Templates Personalizados:**
- Lista de eventos disponíveis com templates editáveis
- Editor de subject + html_body + text_body por evento
- Toggle de ativação por template
- Preview do template

---

#### 7. Hooks Atualizados

- **`useTenantEmailSettings`** — adicionar campos SMTP, modo, validação, funções `testSmtp()` e `saveSmtpConfig()`
- **`useTenantEmailTemplates`** (novo) — CRUD de `tenant_email_templates`
- **`useEmailSettings`** — adicionar `allow_tenant_custom_smtp`

---

#### 8. Segurança

- Senha SMTP mascarada na UI (exibir apenas `••••••••`)
- No update, só enviar senha se o campo foi alterado (não reenviar máscara)
- RLS em `tenant_email_templates` e `tenant_email_settings` por `tenant_id = auth.uid()`
- Edge function `test-tenant-smtp` com validação JWT

---

### Arquivos Impactados

| Área | Arquivos |
|------|----------|
| Migrações | Nova migração SQL (4 alterações) |
| Edge Functions | `process-email-queue/index.ts`, `send-order-notifications/index.ts`, `send-landing-ticket-response/index.ts`, novo `test-tenant-smtp/index.ts` |
| Admin UI | `EmailTemplatesTab.tsx`, `useEmailSettings.tsx` |
| Lojista UI | `TenantEmailSettingsSection.tsx`, `useTenantEmailSettings.tsx` |
| Novo hook | `useTenantEmailTemplates.tsx` |
| Referências Resend | `AdminCommandCenter.tsx` (texto "Resend") |
| Config | `supabase/config.toml` (adicionar `test-tenant-smtp`) |

