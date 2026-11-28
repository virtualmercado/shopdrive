# Fase 5.1 — SQL revisado para aprovação

**Proposta apenas: não aplicada ao banco de produção.**

O SQL completo está no arquivo entregue **asaas-fase51-migration-revisada.sql**.

## Quatro pontos verificados

- **Exclusão comercial:** o vínculo pode ficar vazio somente quando o cliente comercial anterior realmente deixou de existir, respeitando `ON DELETE SET NULL`. A troca para outro cliente, a desvinculação manual de um cliente existente e a associação posterior de um vínculo vazio são bloqueadas. Pagador, documento, referência externa, ID Asaas e cobrança permanecem intactos.
- **Subconta obrigatória:** os registros são vinculados pela correspondência existente de loja/ambiente. Qualquer vínculo não resolvido interrompe a proposta antes de definir `NOT NULL`; nada é inventado ou excluído. A chave estrangeira composta permanece. A conferência real encontrou zero pagadores existentes.
- **Cliente da mesma loja:** a reserva e o banco conferem `store_customers` pela loja e cliente, conforme a arquitetura existente. Clientes de outra loja são rejeitados. Visitantes continuam possíveis com vínculo comercial vazio.
- **Conflitos:** a consulta examina e bloqueia todas as correspondências, sem `LIMIT 1`; duas identidades distintas resultam em conflito sem nova reserva.

## Validação

81 verificações em PostgreSQL descartável, incluindo oito tentativas simultâneas, perda de resposta, falha transacional, exclusão comercial e preservação de histórico. Regressões da Fase 1 e complementar aprovadas (48 assertivas e fluxo dos handlers reais com transporte simulado). Nenhum teste acessou o banco hospedado, usou credenciais reais ou chamou a API Asaas.

## Limites preservados

Sem nova tabela, sem alterações em `store_charges`, pedidos, checkout, frontend, gateways ou lojas comerciais. Master, RLS, referência imutável, concorrência e bloqueio de Production preservados. Nenhuma autorização visual ou operacional foi alterada. Não existe função de liberação de envio externo nesta proposta. Fases 5.2 e 6 continuam bloqueadas.

## Aprovação ainda necessária

Para representar uma reserva antes da resposta externa, o SQL mantém a mudança pontual originalmente proposta: `asaas_customer_id` deixa de ser obrigatório apenas nos estados anteriores à conclusão, com uma regra de ciclo de vida substituindo a exigência incondicional anterior. O estado concluído continua exigindo ID externo válido. Nenhuma coluna ou tabela é excluída ou renomeada, mas essa alteração de exigência não é puramente aditiva e pode exigir aprovação de compatibilidade na aplicação. Este arquivo não aplica nem contorna essa proteção.

A aprovação deste SQL não autoriza chamadas Asaas, criação real de pagadores ou liberação da Fase 5.2.
