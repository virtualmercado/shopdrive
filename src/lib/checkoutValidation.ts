/**
 * Fonte única de validação dos requisitos obrigatórios do checkout público.
 *
 * IMPORTANTE: a regra aqui é EXATAMENTE a mesma que já habilitava/desabilitava
 * o botão "Finalizar compra" em src/pages/Checkout.tsx. Nada foi adicionado nem
 * removido — apenas foi extraída para poder também informar à interface QUAIS
 * requisitos ainda estão pendentes.
 */

export type CheckoutPendingKey =
  | "customer_name"
  | "customer_phone"
  | "cep"
  | "address"
  | "number"
  | "neighborhood"
  | "city"
  | "state";

export interface CheckoutPendingRequirement {
  key: CheckoutPendingKey;
  /** Rótulo do campo, como exibido no formulário. */
  label: string;
  /** Mensagem auxiliar exibida abaixo do campo. */
  message: string;
}

interface CheckoutValidationInput {
  customer_name?: string;
  customer_phone?: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  delivery_method?: string;
}

const isFilled = (value?: string) => !!value && value.trim().length > 0;

export const getCheckoutPendingRequirements = (
  formData: CheckoutValidationInput
): CheckoutPendingRequirement[] => {
  const pending: CheckoutPendingRequirement[] = [];

  if (!isFilled(formData.customer_name)) {
    pending.push({ key: "customer_name", label: "Nome completo", message: "Informe seu nome completo." });
  }
  if (!isFilled(formData.customer_phone)) {
    pending.push({ key: "customer_phone", label: "Telefone/WhatsApp", message: "Informe um telefone válido." });
  }

  // Retirada não exige endereço de entrega (regra atual preservada).
  if (formData.delivery_method !== "retirada") {
    if (!isFilled(formData.cep)) {
      pending.push({ key: "cep", label: "CEP", message: "Informe o CEP." });
    }
    if (!isFilled(formData.address)) {
      pending.push({ key: "address", label: "Endereço", message: "Campo obrigatório." });
    }
    if (!isFilled(formData.number)) {
      pending.push({ key: "number", label: "Número", message: "Informe um número válido." });
    }
    if (!isFilled(formData.neighborhood)) {
      pending.push({ key: "neighborhood", label: "Bairro", message: "Campo obrigatório." });
    }
    if (!isFilled(formData.city)) {
      pending.push({ key: "city", label: "Cidade", message: "Campo obrigatório." });
    }
    if (!isFilled(formData.state)) {
      pending.push({ key: "state", label: "Estado", message: "Campo obrigatório." });
    }
  }

  return pending;
};

/** Mensagem contextual exibida próxima ao botão "Finalizar compra". */
export const getCheckoutPendingMessage = (pending: CheckoutPendingRequirement[]): string | null => {
  if (pending.length === 0) return null;
  if (pending.length === 1) {
    return `Falta 1 campo obrigatório: ${pending[0].label}. Preencha para finalizar sua compra.`;
  }
  return `Faltam ${pending.length} campos obrigatórios (*) para finalizar sua compra.`;
};
