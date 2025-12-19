/**
 * Normaliza um número de telefone brasileiro para o formato internacional do WhatsApp.
 * Remove caracteres não numéricos e adiciona o DDI 55 se necessário.
 *
 * @param phone - Número de telefone em qualquer formato
 * @returns Número normalizado apenas com dígitos, incluindo DDI 55
 */
export function normalizeWhatsAppNumber(phone: string): string {
  if (!phone) return "";

  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, "");

  // Se vazio, retorna vazio
  if (!digits) return "";

  // Se já começa com 55 e tem tamanho adequado (12-13 dígitos), mantém
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  // Se tem 10-11 dígitos (DDD + número), adiciona 55
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }

  // Se tem mais de 13 dígitos e começa com 55, trunca para 13
  if (digits.startsWith("55") && digits.length > 13) {
    return digits.slice(0, 13);
  }

  // Retorna os dígitos como estão se não se encaixar em nenhum padrão
  return digits;
}

/**
 * Formata um número de telefone para exibição no formato brasileiro.
 *
 * @param phone - Número de telefone
 * @returns Número formatado para exibição (ex: (11) 99999-9999)
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Remove DDI 55 se presente para formatação de exibição
  const localDigits = digits.startsWith("55") ? digits.slice(2) : digits;

  if (localDigits.length === 11) {
    return localDigits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (localDigits.length === 10) {
    return localDigits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return phone;
}
