-- Update suporte_lojista template
UPDATE landing_response_templates 
SET 
  assunto = 'SD — Atendimento {protocolo}',
  mensagem = 'Olá, {nome} 👋

Recebemos sua solicitação de suporte na ShopDrive e ela já foi registrada sob o protocolo {protocolo}.

Nossa equipe está analisando o seu caso relacionado à sua loja e retornará o mais breve possível.

Se necessário, poderemos solicitar informações adicionais para agilizar a solução.

Atenciosamente,
Equipe de Suporte ShopDrive
https://shopdrive.com.br',
  updated_at = now()
WHERE categoria = 'suporte_lojista';

-- Update financeiro_cobrancas template
UPDATE landing_response_templates 
SET 
  assunto = 'SD — Financeiro | Protocolo {protocolo}',
  mensagem = 'Olá, {nome},

Recebemos sua solicitação relacionada a cobranças ou assinatura na ShopDrive.

Seu atendimento foi registrado sob o protocolo {protocolo}.

Nossa equipe financeira está analisando as informações e retornará assim que possível.

Caso seja necessário, poderemos solicitar dados adicionais para validação.

Atenciosamente,
Equipe Financeira ShopDrive
https://shopdrive.com.br',
  updated_at = now()
WHERE categoria = 'financeiro_cobrancas';

-- Update lgpd_privacidade template
UPDATE landing_response_templates 
SET 
  assunto = 'SD — Privacidade e Dados | Protocolo {protocolo}',
  mensagem = 'Olá, {nome},

Confirmamos o recebimento da sua solicitação relacionada à privacidade e proteção de dados pessoais.

Seu pedido foi registrado sob o protocolo {protocolo}.

A ShopDrive trata dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD).

Sua solicitação será analisada dentro dos prazos legais e você receberá retorno por este canal.

Atenciosamente,
Encarregado de Dados (DPO)
ShopDrive
https://shopdrive.com.br',
  updated_at = now()
WHERE categoria = 'lgpd_privacidade';

-- Update comercial_parcerias template
UPDATE landing_response_templates 
SET 
  assunto = 'SD — Comercial e Parcerias | Protocolo {protocolo}',
  mensagem = 'Olá, {nome},

Obrigado por entrar em contato com a ShopDrive.

Recebemos sua mensagem sobre parcerias ou assuntos comerciais e ela foi registrada sob o protocolo {protocolo}.

Nossa equipe comercial analisará sua proposta e retornará em breve.

Atenciosamente,
Equipe Comercial ShopDrive
https://shopdrive.com.br',
  updated_at = now()
WHERE categoria = 'comercial_parcerias';