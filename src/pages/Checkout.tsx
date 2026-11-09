import { usePublicStoreIdentity, useStorePath } from "@/contexts/PublicStoreRuntime";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";
import { toast } from "sonner";
import { attemptStorageKey, loadCheckoutAttempt, saveCheckoutAttempt, CARD_MESSAGES, safeCardMessage } from "@/lib/checkoutAttempt";
import type { CheckoutAttempt } from "@/lib/checkoutAttempt";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { trackStoreEvent } from "@/hooks/useStoreEvents";
import { useCoupon } from "@/hooks/useCoupon";
import { getCheckoutPendingRequirements, getCheckoutPendingMessage, canDeferDelivery, isDeliveryDeferred, DELIVERY_TO_BE_AGREED_LABEL } from "@/lib/checkoutValidation";

import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { PixPayment } from "@/components/checkout/PixPayment";
import { OrderSummaryHeader } from "@/components/checkout/OrderSummaryHeader";
import { CustomerColumn } from "@/components/checkout/CustomerColumn";
import { DeliveryColumn } from "@/components/checkout/DeliveryColumn";
import { findQuote, type CorreiosServiceKey, type ServiceStatus } from "@/lib/shippingQuotes";
import { PaymentColumn, CardTokenData } from "@/components/checkout/PaymentColumn";

type DeliveryMethod = "retirada" | "entrega" | "motoboy" | "sedex" | "pac" | "mini_envios";
type PaymentMethod = "cartao_credito" | "pix" | "boleto" | "whatsapp";

interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  // "" = nenhuma modalidade selecionada (nenhum frete aplicado)
  delivery_method: DeliveryMethod | "";
  payment_method: PaymentMethod;
  notes: string;
}

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
}

interface CustomerAddress {
  id: string;
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
}

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  customer_phone: z.string().trim().min(10, "Telefone inválido").max(20),
  customer_address: z.string().trim().max(500).optional(),
  // Opcional apenas porque a exceção visitante + WhatsApp já é verificada antes do parse.
  delivery_method: z.enum(["retirada", "entrega", "motoboy", "sedex", "pac", "mini_envios"]).optional(),
  payment_method: z.enum(["cartao_credito", "pix", "boleto", "whatsapp"]),
  notes: z.string().max(1000).optional(),
});

const CheckoutContent = () => {
  const { storeSlug, storeId } = usePublicStoreIdentity();
  const storePath = useStorePath();
  const navigate = useNavigate();
  const { cart, getTotal, clearCart, updateQuantity, removeFromCart } = useCart();
  const { user, signIn, signUp } = useCustomerAuth();
  
  const [loading, setLoading] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  // Indica se o frete possui origem legítima (cotação, regra, retirada ou taxa configurada).
  const [deliveryFeeDefined, setDeliveryFeeDefined] = useState(false);
  const [motoboyFee, setMotoboyFee] = useState<number | null>(null);
  const [motoboyAvailable, setMotoboyAvailable] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingRules, setShippingRules] = useState<any[]>([]);
  const [deliveryOption, setDeliveryOption] = useState<string>("delivery_only");
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [showPixPayment, setShowPixPayment] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [pixGateway, setPixGateway] = useState<"mercadopago" | "pagbank" | "infinitepay" | null>(null);
  const [creditCardGateway, setCreditCardGateway] = useState<"mercadopago" | "pagbank" | "infinitepay" | null>(null);
  const [cardProcessingError, setCardProcessingError] = useState<string | null>(null);
  const finalizingRef = useRef(false);
  const [paymentAttempt, setPaymentAttempt] = useState<CheckoutAttempt | null>(null);
  const [paymentUnresolved, setPaymentUnresolved] = useState(false);
  const [paymentTerminal, setPaymentTerminal] = useState(false);
  const attemptKey = storeData?.id ? attemptStorageKey(storeData.id, user?.id || null) : null;
  useEffect(() => {
    let saved: CheckoutAttempt | null = null;
    try { saved = attemptKey ? loadCheckoutAttempt(attemptKey) : null; }
    catch { setPaymentUnresolved(true); setCardProcessingError('Não foi possível recuperar sua tentativa anterior. Entre em contato com a loja antes de pagar novamente.'); return; }
    setPaymentAttempt(saved);
    setPaymentUnresolved(saved?.state === 'unknown');
    setPaymentTerminal(saved?.state === 'terminal');
    if (saved?.state === 'unknown') setCardProcessingError(CARD_MESSAGES.unknown);
    if (saved?.orderId && saved.state !== 'terminal') {
      setCreatedOrderId(saved.orderId);
    }
  }, [attemptKey]);
  const finishAttempt = () => {
    if (attemptKey) sessionStorage.removeItem(attemptKey);
    setPaymentAttempt(null);
    setPaymentUnresolved(false);
    setPaymentTerminal(false);
  };
  const checkCardResult = async () => {
    let saved: CheckoutAttempt | null = null;
    try { saved = attemptKey ? loadCheckoutAttempt(attemptKey) : null; } catch { return; }
    if (!saved?.orderId || finalizingRef.current) return;
    finalizingRef.current = true; setLoading(true);
    try {
      const result = await supabase.functions.invoke('process-credit-card', { body: { orderId: saved.orderId, guestPaymentToken: saved.guestPaymentToken, action: 'status' } });
      const data = result.data;
      if (!result.error && data?.status === 'approved') {
        if (data.orderConfirmed === false) {
          setCardProcessingError(CARD_MESSAGES.approvedPending);
          return;
        }
        finishAttempt(); clearCart();
        toast.info(data.orderConfirmed === false ? CARD_MESSAGES.approvedPending : 'Pagamento aprovado! Pedido confirmado.');
        navigate(storePath(`/pedido-confirmado/${saved.orderId}`));
      } else if (!result.error && ['rejected','cancelled','expired'].includes(data?.status)) {
        const terminal = { ...saved, state: 'terminal' as const };
        if (attemptKey) saveCheckoutAttempt(attemptKey, terminal);
        setPaymentAttempt(terminal); setPaymentUnresolved(false); setPaymentTerminal(true);
        setCardProcessingError(safeCardMessage(data.status));
      } else {
        setCardProcessingError(CARD_MESSAGES.unknown);
      }
    } catch { setCardProcessingError(CARD_MESSAGES.unknown); }
    finally { finalizingRef.current = false; setLoading(false); }
  };
  const startNewAttempt = async () => {
    if (!attemptKey || finalizingRef.current) return;
    const saved = loadCheckoutAttempt(attemptKey);
    if (!saved) return;
    finalizingRef.current = true; setLoading(true);
    try {
      const { error } = await supabase.rpc('close_checkout_attempt', { p_attempt_id: saved.attemptId, p_guest_payment_token: saved.guestPaymentToken });
      if (error) { toast.error('O pedido anterior ainda precisa ser conciliado ou encerrado.'); return; }
      finishAttempt(); setCardProcessingError(null);
    } finally { finalizingRef.current = false; setLoading(false); }
  };
  
  // Customer data
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  
  // Melhor Envio quotes
  interface MelhorEnvioQuote {
    id: number;
    service_key?: CorreiosServiceKey;
    name: string;
    company: string;
    price: number;
    custom_price: number;
    discount: number;
    delivery_time: number;
    delivery_range: { min: number; max: number };
    currency: string;
    error: string | null;
  }
  const [melhorEnvioQuotes, setMelhorEnvioQuotes] = useState<MelhorEnvioQuote[]>([]);
  const [melhorEnvioServices, setMelhorEnvioServices] = useState<ServiceStatus[]>([]);
  const [melhorEnvioLoading, setMelhorEnvioLoading] = useState(false);
  const [melhorEnvioEnabled, setMelhorEnvioEnabled] = useState(false);

  // Capacidades de recebimento independentes (entrega / retirada)
  const deliveryEnabled = deliveryOption !== "pickup_only";
  const pickupEnabled = deliveryOption !== "delivery_only";
  // Quando a loja não possui transportadora/regras configuradas, a entrega
  // continua disponível usando a taxa fixa da loja (mesmo mecanismo já existente).
  const hasCarrierOptions = shippingRules.length > 0 || melhorEnvioEnabled;
  const genericDeliveryAvailable = deliveryEnabled && !hasCarrierOptions;

  const {
    couponCode,
    setCouponCode,
    appliedCoupon,
    loading: couponLoading,
    applyCoupon,
    removeCoupon,
    recordCouponUsage,
  } = useCoupon(storeData?.id || null);

  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: "",
    customer_phone: "",
    cep: "",
    address: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    delivery_method: "",
    payment_method: "pix",
    notes: "",
  });

  // Fetch store data
  useEffect(() => {
    const fetchStoreData = async () => {
      if (!storeSlug) return;

      const { data } = await (supabase as any)
        .from("public_store_profiles")
        .select("*")
        .eq(storeId ? "id" : "store_slug", storeId || storeSlug)
        .single();

      if (data) {
        setStoreData(data);
        setDeliveryOption(data.delivery_option || "delivery_only");
        
        if (data.delivery_option === "pickup_only") {
          setFormData(prev => ({ ...prev, delivery_method: "retirada" }));
        }

        const { data: rules } = await supabase
          .from("shipping_rules")
          .select("*")
          .eq("user_id", data.id)
          .eq("is_active", true);

        if (rules) {
          setShippingRules(rules);
        }

        // Use the public view that doesn't expose sensitive credentials
        const { data: paySettings } = await supabase
          .from("payment_settings_public")
          .select("*")
          .eq("user_id", data.id)
          .single();

        if (paySettings) {
          setPaymentSettings(paySettings);
          // PIX gateway resolution
          if (paySettings.pix_enabled && paySettings.pix_provider === "infinitepay" && paySettings.infinitepay_handle) {
            setPixGateway("infinitepay");
          } else if (paySettings.pix_enabled && paySettings.pix_provider === "mercado_pago") {
            setPixGateway("mercadopago");
          } else if (paySettings.pix_enabled && paySettings.pix_provider === "pagbank") {
            setPixGateway("pagbank");
          } else if (paySettings.mercadopago_enabled && paySettings.mercadopago_accepts_pix) {
            setPixGateway("mercadopago");
          } else if (paySettings.pagbank_enabled && paySettings.pagbank_accepts_pix) {
            setPixGateway("pagbank");
          }
          // Credit card gateway resolution
          if (paySettings.credit_card_enabled && paySettings.credit_card_provider === "infinitepay" && paySettings.infinitepay_handle) {
            setCreditCardGateway("infinitepay");
          } else if (paySettings.credit_card_enabled && paySettings.credit_card_provider === "mercado_pago") {
            setCreditCardGateway("mercadopago");
          } else if (paySettings.credit_card_enabled && paySettings.credit_card_provider === "pagbank") {
            setCreditCardGateway("pagbank");
          } else if (paySettings.mercadopago_enabled && paySettings.mercadopago_accepts_credit) {
            setCreditCardGateway("mercadopago");
          } else if (paySettings.pagbank_enabled && paySettings.pagbank_accepts_credit) {
            setCreditCardGateway("pagbank");
          }
        }

        // Check if Melhor Envio is enabled without exposing private credentials.
        const { data: melhorEnvioSettings } = await supabase.rpc("get_melhor_envio_status", {
          p_user_id: data.id,
        });
        setMelhorEnvioEnabled(Boolean(melhorEnvioSettings?.[0]?.is_active));
      }
    };

    fetchStoreData();
  }, [storeSlug]);

  // Fetch customer data when logged in
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!user) {
        setCustomerProfile(null);
        setCustomerAddresses([]);
        return;
      }

      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCustomerProfile(profile as CustomerProfile);
        setCustomerEmail(profile.email);
        setFormData(prev => ({
          ...prev,
          customer_name: profile.full_name,
          customer_phone: profile.phone || "",
        }));
      }

      const { data: addresses } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", user.id)
        .order("is_default", { ascending: false });

      if (addresses) {
        setCustomerAddresses(addresses as CustomerAddress[]);
        const defaultAddress = addresses.find((a: any) => a.is_default);
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          applyAddress(defaultAddress as CustomerAddress);
        }
      }
    };

    fetchCustomerData();
  }, [user]);

  const applyAddress = (address: CustomerAddress) => {
    setFormData(prev => ({
      ...prev,
      cep: address.cep,
      address: address.street,
      number: address.number,
      complement: address.complement || "",
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
    }));
  };

  useEffect(() => {
    if (selectedAddressId) {
      const address = customerAddresses.find(a => a.id === selectedAddressId);
      if (address) {
        applyAddress(address);
      }
    }
  }, [selectedAddressId, customerAddresses]);

  // Calculate delivery fee
  useEffect(() => {
    calculateDeliveryFee();
  }, [formData.delivery_method, formData.neighborhood, formData.city, formData.cep, cart, storeData, shippingRules, melhorEnvioQuotes, motoboyFee]);

  // Fetch Melhor Envio quotes when CEP changes
  useEffect(() => {
    const fetchMelhorEnvioQuotes = async () => {
      const cepClean = formData.cep.replace(/\D/g, "");
      if (!melhorEnvioEnabled || !storeData || cepClean.length !== 8) {
        setMelhorEnvioQuotes([]);
        setMelhorEnvioServices([]);
        return;
      }

      const originCep = storeData.merchant_reference_cep || storeData.pickup_address?.match(/\d{5}-?\d{3}/)?.[0] || "";
      const originCepClean = originCep.replace(/\D/g, "");
      
      if (originCepClean.length !== 8) {
        console.log("Origin CEP not configured for Melhor Envio");
        return;
      }

      setMelhorEnvioLoading(true);
      try {
        const products = cart.map((item, index) => ({
          id: item.id || `product-${index}`,
          width: item.width || 11,
          height: item.height || 2,
          length: item.length || 16,
          weight: (item.shipping_weight && item.shipping_weight > 0 ? item.shipping_weight : item.weight) || 0.3,
          // Valor segurado por unidade: o Melhor Envio multiplica pela quantidade.
          insurance_value: item.promotional_price || item.price,
          quantity: item.quantity,
        }));

        const { data, error } = await supabase.functions.invoke("calculate-melhor-envio", {
          body: {
            store_user_id: storeData.id,
            from_postal_code: originCepClean,
            to_postal_code: cepClean,
            products,
          },
        });

        if (error) {
          console.error("Error fetching Melhor Envio quotes:", error);
          setMelhorEnvioQuotes([]);
          setMelhorEnvioServices([]);
        } else if (data?.quotes) {
          setMelhorEnvioQuotes(data.quotes);
          setMelhorEnvioServices(Array.isArray(data.services) ? data.services : []);
        }
      } catch (error) {
        console.error("Error calling Melhor Envio:", error);
        setMelhorEnvioQuotes([]);
        setMelhorEnvioServices([]);
      } finally {
        setMelhorEnvioLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchMelhorEnvioQuotes, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData.cep, storeData, cart, melhorEnvioEnabled]);

  const checkFreeShippingEligibility = () => {
    if (!storeData?.free_shipping_minimum) return false;
    const subtotal = getTotal();
    if (subtotal < storeData.free_shipping_minimum) return false;
    const scope = storeData.free_shipping_scope || "ALL";
    
    if (scope === "ALL") return true;
    if (scope === "CITY") {
      return formData.city.trim().toLowerCase() === (storeData.merchant_city || "").trim().toLowerCase();
    }
    if (scope === "STATE") {
      return formData.state.trim().toUpperCase() === (storeData.merchant_state || "").trim().toUpperCase();
    }
    return false;
  };

  // Calculate Motoboy fee based on custom shipping rules only
  const calculateMotoboyFee = (): { fee: number | null; available: boolean } => {
    if (!storeData || shippingRules.length === 0) {
      return { fee: null, available: false };
    }

    const storeMerchantCity = (storeData.merchant_city || storeData.address_city || "").trim().toLowerCase();
    const customerCity = formData.city.trim().toLowerCase();

    // Motoboy is only available if customer is in the same city as the store
    if (!storeMerchantCity || !customerCity || storeMerchantCity !== customerCity) {
      return { fee: null, available: false };
    }

    // Check for neighborhood-specific rule first
    if (formData.neighborhood) {
      const neighborhoodRule = shippingRules.find(
        rule => rule.scope_type === "neighborhood" && 
        rule.scope_value.toLowerCase().trim() === formData.neighborhood.toLowerCase().trim()
      );
      if (neighborhoodRule) {
        return { fee: neighborhoodRule.shipping_fee, available: true };
      }
    }

    // Check for city-wide rule (single price for entire city)
    const cityRule = shippingRules.find(
      rule => rule.scope_type === "city" && 
      rule.scope_value.toLowerCase().trim() === customerCity
    );
    if (cityRule) {
      return { fee: cityRule.shipping_fee, available: true };
    }

    // Check for CEP-based rule
    const cepClean = formData.cep.replace(/\D/g, "");
    if (cepClean.length === 8) {
      const zipcodeRule = shippingRules.find(
        rule => rule.scope_type === "zipcode" && 
        rule.scope_value.replace(/\D/g, "") === cepClean
      );
      if (zipcodeRule) {
        return { fee: zipcodeRule.shipping_fee, available: true };
      }
    }

    // No matching rule found - motoboy not available
    return { fee: null, available: false };
  };

  // Update motoboy availability whenever address changes
  useEffect(() => {
    const { fee, available } = calculateMotoboyFee();
    setMotoboyFee(fee);
    setMotoboyAvailable(available);

    // Se o motoboy deixou de estar disponível, limpar a seleção e o frete
    // (sem escolher outra modalidade automaticamente).
    if (formData.delivery_method === "motoboy" && !available) {
      setFormData(prev => ({ ...prev, delivery_method: "" }));
    }
  }, [formData.neighborhood, formData.city, formData.cep, shippingRules, storeData]);

  // Mini Envios: a elegibilidade (peso, dimensões, valor segurado e trecho) é
  // decidida exclusivamente pela cotação real do provedor. Se a cotação atual
  // não trouxer Mini Envios, limpar a seleção sem escolher outra modalidade.
  useEffect(() => {
    if (melhorEnvioLoading) return;
    if (formData.delivery_method === "mini_envios" && !findQuote(melhorEnvioQuotes, "mini_envios")) {
      setFormData(prev => ({ ...prev, delivery_method: "" }));
    }
  }, [formData.delivery_method, melhorEnvioQuotes, melhorEnvioLoading]);

  // Loja apenas com retirada: única situação em que a modalidade é definida
  // automaticamente, pois não existe alternativa.
  useEffect(() => {
    if (!storeData) return;
    if (deliveryOption === "pickup_only" && formData.delivery_method !== "retirada") {
      setFormData(prev => ({ ...prev, delivery_method: "retirada" }));
    }
  }, [storeData, deliveryOption, formData.delivery_method]);

  // Exceção única: visitante sem cadastro + "Combinar via WhatsApp" → entrega opcional.
  const deliveryCanBeDeferred = canDeferDelivery({
    isAuthenticated: !!user || !!customerProfile,
    paymentMethod: formData.payment_method,
  });
  const deliveryDeferred = isDeliveryDeferred(formData, { deliveryCanBeDeferred });

  const calculateDeliveryFee = () => {
    // Nenhuma modalidade escolhida => nenhum frete aplicado (estado "a calcular").
    if (!formData.delivery_method) {
      setDeliveryFee(0);
      setDeliveryFeeDefined(false);
      return;
    }
    if (formData.delivery_method === "retirada") {
      setDeliveryFee(0);
      setDeliveryFeeDefined(true);
      return;
    }
    if (!storeData) return;
    if (checkFreeShippingEligibility()) {
      setDeliveryFee(0);
      setDeliveryFeeDefined(true);
      return;
    }

    // Motoboy uses custom shipping rules exclusively
    if (formData.delivery_method === "motoboy") {
      if (motoboyFee !== null) {
        setDeliveryFee(motoboyFee);
        setDeliveryFeeDefined(true);
      } else {
        setDeliveryFee(0);
        setDeliveryFeeDefined(false);
      }
      return;
    }

    // Cotações SEDEX, PAC e Mini Envios: mesma classificação do backend.
    if (["sedex", "pac", "mini_envios"].includes(formData.delivery_method)) {
      const quote = findQuote(melhorEnvioQuotes, formData.delivery_method as CorreiosServiceKey);

      if (quote) {
        setDeliveryFee(quote.custom_price || quote.price);
        setDeliveryFeeDefined(true);
      } else {
        // Sem cotação válida não existe frete legítimo: não aplicar valor algum.
        setDeliveryFee(0);
        setDeliveryFeeDefined(false);
      }
      return;
    }

    // Entrega padrão: usar exclusivamente a taxa fixa configurada pela loja.
    const fixedFee = typeof storeData.shipping_fixed_fee === "number" ? storeData.shipping_fixed_fee : null;
    if (formData.delivery_method === "entrega" && fixedFee !== null) {
      setDeliveryFee(fixedFee);
      setDeliveryFeeDefined(true);
      return;
    }

    setDeliveryFee(0);
    setDeliveryFeeDefined(false);
  };

  const handleLogin = async (email: string, password: string) => {
    await signIn(email, password);
  };

  const handleRegister = async (data: { 
    full_name: string; 
    email: string; 
    password: string; 
    phone: string;
    birth_date?: string;
    person_type?: string;
    gender?: string;
    cpf?: string;
    // Address fields
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }) => {
    await signUp(data.email, data.password, data.full_name, storeSlug || "", {
      phone: data.phone,
      birth_date: data.birth_date,
      person_type: data.person_type,
      gender: data.gender,
      cpf: data.cpf,
      cep: data.cep,
      street: data.street,
      number: data.number,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
    }, storeData?.id);
  };

  const handleAddAddress = async (address: Omit<CustomerAddress, "id" | "is_default">) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: user.id,
        ...address,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao salvar endereço");
      return;
    }

    toast.success("Endereço salvo!");
    setCustomerAddresses(prev => [...prev, data as CustomerAddress]);
    setSelectedAddressId(data.id);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user) return;

    // Find the address to check if it's default
    const addressToDelete = customerAddresses.find(a => a.id === addressId);
    if (!addressToDelete) return;

    // Prevent deletion of default address
    if (addressToDelete.is_default) {
      toast.error("Não é possível excluir o endereço principal");
      return;
    }

    const { error } = await supabase
      .from("customer_addresses")
      .delete()
      .eq("id", addressId)
      .eq("customer_id", user.id);

    if (error) {
      toast.error("Erro ao excluir endereço");
      return;
    }

    toast.success("Endereço excluído!");
    setCustomerAddresses(prev => prev.filter(a => a.id !== addressId));
    
    // If deleted address was selected, select the default one
    if (selectedAddressId === addressId) {
      const defaultAddress = customerAddresses.find(a => a.is_default && a.id !== addressId);
      setSelectedAddressId(defaultAddress?.id || null);
    }
  };

  const handleFinalize = async (cardTokenData?: CardTokenData) => {
    if (paymentUnresolved || paymentTerminal) return;
    setCardProcessingError(null);
    if (finalizingRef.current) {
      console.warn("[Checkout] Finalização ignorada: pedido já está em processamento");
      return;
    }
    
    if (cart.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }

    if (!formData.customer_name || !formData.customer_phone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (formData.payment_method === 'cartao_credito' && !z.string().email().safeParse(customerEmail).success) {
      toast.error('Informe um e-mail válido para o pagamento.');
      return;
    }

    if (!formData.delivery_method && !deliveryDeferred) {
      toast.error("Escolha como deseja receber seu pedido");
      return;
    }

    if (!deliveryDeferred && formData.delivery_method !== "retirada") {
      if (!formData.cep || !formData.address || !formData.number || !formData.neighborhood || !formData.city || !formData.state) {
        toast.error("Preencha todos os dados de endereço para entrega");
        return;
      }
    }

    try {
      const addressString = deliveryDeferred
        ? DELIVERY_TO_BE_AGREED_LABEL
        : formData.delivery_method !== "retirada" 
        ? `${formData.address}, ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
        : storeData?.pickup_address || "Retirada na loja";

      checkoutSchema.parse({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_address: addressString,
        delivery_method: deliveryDeferred ? undefined : formData.delivery_method,
        payment_method: formData.payment_method,
        notes: formData.notes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    finalizingRef.current = true;
    setLoading(true);

    let whatsappWindow: Window | null = null;

    try {
      if (!storeData) throw new Error("Dados da loja não encontrados");

      const subtotal = getTotal();
      const couponDiscount = appliedCoupon?.isValid ? appliedCoupon.discount : 0;
      const pixDiscountPercent = (formData.payment_method === "pix" && paymentSettings?.pix_discount_percent > 0) 
        ? paymentSettings.pix_discount_percent : 0;
      const pixDiscountAmount = (subtotal - couponDiscount) * (pixDiscountPercent / 100);
      const total = Math.max(0, subtotal - couponDiscount - pixDiscountAmount + deliveryFee);

      const addressString = deliveryDeferred
        ? DELIVERY_TO_BE_AGREED_LABEL
        : formData.delivery_method !== "retirada" 
        ? `${formData.address}, ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
        : storeData.pickup_address || "Retirada na loja";

      // Entrega a combinar: nenhuma modalidade é gravada (NULL), sem valor artificial.
      const deliveryMethodLabel = deliveryDeferred ? null : formData.delivery_method === "retirada" ? "retirada" : "entrega";
      const checkoutCustomerId = user?.id || null;
      const isGuestOrder = !checkoutCustomerId;
      const orderItemsPayload = cart.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        product_price: item.promotional_price || item.price,
        quantity: item.quantity,
        subtotal: (item.promotional_price || item.price) * item.quantity,
        variations: item.variations || null,
        variant_id: item.variantId || null,
      }));
      const orderSource = sessionStorage.getItem('order_origin_catalog') ? 'catalog' : 'store';
      const getPaymentStatus = (method: PaymentMethod, gatewayStatus?: string) => {
        if (method === "whatsapp") return "aguardando_combinar";
        if (method === "cartao_credito") return gatewayStatus === "approved" ? "approved" : "pending";
        return "pending";
      };
      const buildCheckoutOrderPayload = (status: string, paymentStatus = getPaymentStatus(formData.payment_method)) => ({
        p_store_owner_id: storeData.id,
        p_customer_id: checkoutCustomerId,
        p_customer_name: formData.customer_name,
        p_customer_email: customerEmail || "",
        p_customer_phone: formData.customer_phone,
        p_customer_address: addressString,
        p_delivery_method: deliveryMethodLabel,
        p_payment_method: formData.payment_method,
        p_subtotal: subtotal,
        p_delivery_fee: deliveryFee,
        p_total_amount: total,
        p_status: status,
        p_payment_status: paymentStatus,
        p_notes: formData.notes || null,
        p_order_source: orderSource,
        p_checkout_origin: isGuestOrder ? "checkout_guest" : "checkout_customer",
        p_is_guest_order: isGuestOrder,
        p_items: orderItemsPayload as any,
      });
      let activeAttempt: CheckoutAttempt | null = null;
      const securePaymentFlow = (formData.payment_method === 'cartao_credito' && creditCardGateway === 'mercadopago') || (formData.payment_method === 'pix' && (pixGateway === 'mercadopago' || pixGateway === 'pagbank'));
      const createCheckoutOrder = async (status: string, paymentStatus = getPaymentStatus(formData.payment_method)) => {
        const payload = buildCheckoutOrderPayload(status, paymentStatus);
        // Resume the same capability after errors/refresh; never persist a card token.
        const saved = attemptKey ? loadCheckoutAttempt(attemptKey) : null;
        if (saved || securePaymentFlow) {
          if (!attemptKey) throw new Error('Não foi possível preservar esta tentativa de pagamento.');
          activeAttempt = saved;
          if (!activeAttempt) {
            const { data, error } = await supabase.rpc('begin_checkout_attempt', { p_store_owner_id: storeData.id, p_customer_id: checkoutCustomerId });
            if (error || !data) throw new Error('Não foi possível iniciar seu pedido.');
            activeAttempt = data as unknown as CheckoutAttempt;
            saveCheckoutAttempt(attemptKey, activeAttempt);
          }
          setPaymentAttempt(activeAttempt);
        }
        const response = activeAttempt
          ? await supabase.rpc('create_checkout_order_once', { p_attempt_id: activeAttempt.attemptId, p_guest_payment_token: activeAttempt.guestPaymentToken, p_order: payload })
          : await supabase.rpc('create_checkout_order' as any, payload);
        const createdOrder = response.data;
        const createOrderError = response.error;

        if (createOrderError || !createdOrder) {

          const rawMsg = String((createOrderError as any)?.message || "");
          if (rawMsg.includes('checkout_content_changed')) {
            toast.error('Seu pedido anterior ainda está pendente. Reconcilie ou cancele esse pedido antes de alterar o carrinho.');
            throw new Error('checkout_content_changed');
          }
          if (rawMsg.includes("valores do carrinho foram atualizados")) {
            throw new Error("Os preços de alguns produtos mudaram. Remova e adicione novamente os itens do carrinho e tente de novo.");
          }
          if (rawMsg.includes("Combinação indisponível") || rawMsg.includes("Selecione as opções") || rawMsg.includes("Estoque insuficiente")) {
            throw new Error(`${rawMsg} Revise o carrinho e tente novamente.`);
          }
          throw new Error("Não foi possível registrar seu pedido. Tente novamente.");
        }

        if (activeAttempt && attemptKey) {
          activeAttempt = { ...activeAttempt, orderId: (createdOrder as any).id };
          saveCheckoutAttempt(attemptKey, activeAttempt);
          setPaymentAttempt(activeAttempt);
        }
        try {
          sessionStorage.setItem(
            `shopdrive_checkout_order:${(createdOrder as any).id}`,
            JSON.stringify({
              order: createdOrder,
              items: orderItemsPayload,
              store: {
                primary_color: storeData.primary_color || null,
                address: storeData.address || null,
                address_number: storeData.address_number || null,
                address_neighborhood: storeData.address_neighborhood || null,
                address_city: storeData.address_city || null,
                address_state: storeData.address_state || null,
                address_zip_code: storeData.address_zip_code || null,
              },
            })
          );
        } catch (storageError) {
          // Confirmation cache is optional; the payment capability was already saved.
        }

        return createdOrder as any;
      };

      // CREDIT CARD FLOW - Create the order FIRST (pending), then charge the card.
      // The charge only confirms the pre-created order, so an approved payment
      // can never end up without an order, and retries reuse the same order.
      if (formData.payment_method === "cartao_credito" && cardTokenData) {
        console.log("[Checkout] criando pedido pendente antes da cobrança do cartão");

        const order = await createCheckoutOrder("pending", "pending");

        try {
          const paymentResponse = await supabase.functions.invoke("process-credit-card", {
            body: {
              orderId: order.id,
              guestPaymentToken: activeAttempt?.guestPaymentToken,
              customerCpf: customerProfile?.cpf || "",
              customerPhone: formData.customer_phone,
              customerAddress: {
                zipCode: formData.cep,
                street: formData.address,
                number: formData.number,
                neighborhood: formData.neighborhood,
                city: formData.city,
                state: formData.state,
              },
              cardToken: cardTokenData.token,
              paymentMethodId: cardTokenData.paymentMethodId,
              installments: cardTokenData.installments,
              description: `Pedido na loja ${storeData.store_name || storeSlug}`,
            },
          });

          let paymentData = paymentResponse.data;
          // Non-2xx server responses are safe structured failures; transport loss remains ambiguous.
          if (paymentResponse.error && (paymentResponse.error as any).context instanceof Response) {
            try { paymentData = await (paymentResponse.error as any).context.json(); } catch { /* unknown */ }
          }
          if (paymentData?.status !== 'approved') {
            const status = paymentData?.status || 'unknown';
            const unknown = !['not_started','rejected','cancelled','expired'].includes(status);
            const terminal = ['rejected','cancelled','expired'].includes(status);
            if (activeAttempt && attemptKey) {
              const next = { ...activeAttempt, state: unknown ? 'unknown' as const : terminal ? 'terminal' as const : 'ready' as const };
              saveCheckoutAttempt(attemptKey, next); setPaymentAttempt(next);
            }
            setPaymentUnresolved(unknown); setPaymentTerminal(terminal);
            const message = safeCardMessage(status, paymentData?.statusDetail);
            setCardProcessingError(message); toast.error(message);
            return;
          }
          if (paymentData.orderConfirmed === false) {
            if (activeAttempt && attemptKey) {
              const next = { ...activeAttempt, state: 'unknown' as const };
              saveCheckoutAttempt(attemptKey, next); setPaymentAttempt(next);
            }
            setPaymentUnresolved(true); setCardProcessingError(CARD_MESSAGES.approvedPending);
            toast.info(CARD_MESSAGES.approvedPending);
            return;
          }
          // Approval updates the local receipt too; guest order reads may use the private session cache.
          try {
            const cacheKey = `shopdrive_checkout_order:${order.id}`;
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) || '{}');
            if (cached.order) {
              cached.order.payment_status = 'approved'; cached.order.status = 'confirmed';
              sessionStorage.setItem(cacheKey, JSON.stringify(cached));
            }
          } catch { /* optional receipt cache */ }
          finishAttempt();

          logAuditEvent({
            action: "order_created",
            entityType: "order",
            entityId: order.id,
            description: "Novo pedido registrado na loja",
          });

          // Record coupon usage
          if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
            await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
          }

          clearCart();
          sessionStorage.removeItem('order_origin_catalog');

          // Track purchase event for conversion funnel
          if (storeData?.id) {
            trackStoreEvent(storeData.id, "purchase");
          }

          if (paymentData.status === "approved") {
            if (paymentData.orderConfirmed === false) {
              // Gateway approved but the local confirmation failed: safe state,
              // never a generic "payment failed" message.
              toast.info("Pagamento aprovado. Estamos confirmando seu pedido.");
            } else {
              toast.success("Pagamento aprovado! Pedido confirmado.");
            }
          } else {
            toast.info(paymentData.message || "Pagamento em processamento. Aguarde a confirmação.");
          }

          navigate(storePath(`/pedido-confirmado/${order.id}`));
          return;

        } catch {
          if (activeAttempt && attemptKey) {
            const next = { ...activeAttempt, state: 'unknown' as const };
            saveCheckoutAttempt(attemptKey, next); setPaymentAttempt(next);
          }
          setPaymentUnresolved(true);
          const errorMessage = CARD_MESSAGES.unknown;
          setCardProcessingError(errorMessage);
          toast.error(errorMessage);
          setLoading(false);
          finalizingRef.current = false;
          return;
        }
      }

      // WhatsApp order persistence happens after order + items are created (see below).

      // For non-credit card payments, create order and items first in a single secure backend routine
      const order = await createCheckoutOrder("pending");

      logAuditEvent({
        action: "order_created",
        entityType: "order",
        entityId: order.id,
        description: "Novo pedido registrado na loja",
      });

      // WhatsApp flow: order + items already persisted. Now open WhatsApp with the order number.
      if (formData.payment_method === "whatsapp" && storeData.whatsapp_number) {
        const { buildItemizedWhatsAppMessage } = await import("@/lib/whatsappOrderMessage");
        const itemsForWa = cart.map((item) => ({
          product_name: item.name,
          quantity: item.quantity,
          product_price: item.promotional_price || item.price,
          subtotal: (item.promotional_price || item.price) * item.quantity,
          variations: item.variations || null,
        }));
        const whatsappMessage = buildItemizedWhatsAppMessage(
          {
            order_number: (order as any).order_number ?? null,
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            created_at: (order as any).created_at || new Date(),
            subtotal,
            delivery_fee: deliveryFee,
            total_amount: total,
            delivery_method: deliveryDeferred ? "a_combinar" : formData.delivery_method,
            payment_method: "whatsapp",
            notes: formData.notes || null,
          },
          itemsForWa,
          storeData.store_name || "Loja"
        );

        let cleanPhone = storeData.whatsapp_number.replace(/\D/g, "");
        if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        console.log("[Checkout] abertura do WhatsApp", { order_id: order.id, order_number: (order as any).order_number ?? null });

        if (whatsappWindow && !whatsappWindow.closed) {
          try {
            whatsappWindow.location.href = whatsappUrl;
          } catch {
            window.open(whatsappUrl, "_blank", "noopener,noreferrer");
          }
        } else {
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
        whatsappWindow = null;
      }


      // InfinitePay flow (PIX or Cartão) — redirect to InfinitePay-hosted checkout
      const isInfinitepayFlow =
        (formData.payment_method === "pix" && pixGateway === "infinitepay") ||
        (formData.payment_method === "cartao_credito" && creditCardGateway === "infinitepay" && !cardTokenData);

      if (isInfinitepayFlow) {
        try {
          toast.info("Você será direcionado para o checkout seguro da InfinitePay para concluir o pagamento.");

          const redirectUrl = `${window.location.origin}${storePath(`/pedido-confirmado/${order.id}`)}`;

          const ipResp = await supabase.functions.invoke("create-infinitepay-checkout", {
            body: {
              store_owner_id: storeData.id,
              order_id: order.id,
              order_number: (order as any).order_number ?? null,
              items: cart.map((it) => ({
                name: it.name,
                quantity: it.quantity,
                price: it.promotional_price || it.price,
              })),
              customer: {
                name: formData.customer_name,
                email: customerEmail || undefined,
                phone_number: formData.customer_phone,
              },
              redirect_url: redirectUrl,
            },
          });

          if (ipResp.error || !ipResp.data?.checkout_url) {
            console.error("InfinitePay error:", ipResp.error, ipResp.data);
            toast.error("Não foi possível iniciar o pagamento pela InfinitePay. Tente novamente ou escolha outro método.");
            setLoading(false);
            finalizingRef.current = false;
            return;
          }

          if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
            await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
          }
          clearCart();
          sessionStorage.removeItem("order_origin_catalog");
          if (storeData?.id) trackStoreEvent(storeData.id, "purchase");

          window.location.href = ipResp.data.checkout_url;
          return;
        } catch (ipErr: any) {
          console.error("InfinitePay exception:", ipErr);
          toast.error("Não foi possível iniciar o pagamento pela InfinitePay. Tente novamente ou escolha outro método.");
          setLoading(false);
          finalizingRef.current = false;
          return;
        }
      }

      const isPix = formData.payment_method === "pix";
      const hasPixGateway = pixGateway !== null && pixGateway !== "infinitepay";

      if (isPix && hasPixGateway) {
        setCreatedOrderId(order.id);
        setShowPixPayment(true);
        setLoading(false);
        finalizingRef.current = false;
        return;
      }

      // Boleto flow - generate boleto via Mercado Pago
      if (formData.payment_method === "boleto" && paymentSettings?.boleto_enabled) {
        try {
          console.log("Generating boleto for order:", order.id);
          
          const boletoResponse = await supabase.functions.invoke("generate-boleto", {
            body: {
              orderId: order.id,
              amount: total,
              storeOwnerId: storeData.id,
              customerName: formData.customer_name,
              customerEmail: customerEmail,
              customerCpf: customerProfile?.cpf || "",
              customerPhone: formData.customer_phone,
              customerAddress: {
                zipCode: formData.cep,
                street: formData.address,
                number: formData.number,
                neighborhood: formData.neighborhood,
                city: formData.city,
                state: formData.state,
              },
              description: `Pedido ${order.order_number || order.id.substring(0, 8)}`,
            },
          });

          if (boletoResponse.error) {
            console.error("Boleto generation error:", boletoResponse.error);
            toast.error("Erro ao gerar boleto. O pedido foi criado, mas o boleto não foi gerado.");
          } else if (boletoResponse.data?.success) {
            console.log("Boleto generated successfully:", boletoResponse.data);
            toast.success("Boleto gerado com sucesso!");
            
            // Record coupon usage if applicable
            if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
              await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
            }
            
            clearCart();
            // Track purchase event for conversion funnel
            if (storeData?.id) trackStoreEvent(storeData.id, "purchase");
            // Navigate to confirmation page where boleto details will be shown
            navigate(storePath(`/pedido-confirmado/${order.id}`));
            return;
          } else {
            console.error("Boleto generation failed:", boletoResponse.data);
            toast.error(boletoResponse.data?.error || "Erro ao gerar boleto");
          }
        } catch (boletoError: any) {
          console.error("Boleto generation exception:", boletoError);
          toast.error("Erro ao processar boleto. Tente novamente.");
        }
        
        setLoading(false);
        return;
      }

      // WhatsApp flow: WhatsApp is opened only after the order and items are saved.

      if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
        await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
      }

      clearCart();
      sessionStorage.removeItem('order_origin_catalog');
      // Track purchase event for conversion funnel
      if (storeData?.id) trackStoreEvent(storeData.id, "purchase");
      toast.success("Pedido realizado com sucesso!");
      setTimeout(() => navigate(storePath(`/pedido-confirmado/${order.id}`)), 1000);
    } catch (error: any) {

      if (whatsappWindow && !whatsappWindow.closed) {
        try { whatsappWindow.close(); } catch { /* noop */ }
      }
      const msg = String(error?.message || "");
      toast.error(
        msg.includes("Combinação indisponível") || msg.includes("Selecione as opções")
          ? msg
          : "Não foi possível registrar seu pedido. Tente novamente.",
      );
    } finally {
      setLoading(false);
      finalizingRef.current = false;
    }

  };

  const handlePixPaymentConfirmed = useCallback(() => {
    finishAttempt();
    clearCart();
    // Track purchase event for conversion funnel
    if (storeData?.id) trackStoreEvent(storeData.id, "purchase");
    toast.success("Pagamento confirmado!");
    navigate(storePath(`/pedido-confirmado/${createdOrderId}`));
  }, [attemptKey, clearCart, storeData?.id, createdOrderId, navigate, storePath]);

  const handlePixExpired = useCallback(() => {
    toast.warning("Verifique o resultado do PIX antes de iniciar outro pagamento.");
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Digite o código do cupom");
      return;
    }
    const result = await applyCoupon(couponCode, getTotal(), customerEmail);
    if (result.isValid) {
      toast.success("Cupom aplicado com sucesso!");
    } else {
      toast.error(result.errorMessage || "Cupom inválido");
    }
  };

  const primaryColor = storeData?.primary_color || "#6a1b9a";

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Carrinho vazio</h1>
          <p className="text-muted-foreground">Adicione produtos ao carrinho para continuar</p>
          <Button onClick={() => navigate(storePath())}>Voltar para a loja</Button>
        </div>
      </div>
    );
  }

  const subtotal = getTotal();
  const couponDiscount = appliedCoupon?.isValid ? appliedCoupon.discount : 0;
  const pixDiscountPercent = (formData.payment_method === "pix" && paymentSettings?.pix_discount_percent > 0) 
    ? paymentSettings.pix_discount_percent : 0;
  const pixDiscountAmount = (subtotal - couponDiscount) * (pixDiscountPercent / 100);
  const total = Math.max(0, subtotal - couponDiscount - pixDiscountAmount + deliveryFee);
  
  // Fonte única de validação: define o estado do botão E orienta a interface.
  const pendingRequirements = getCheckoutPendingRequirements(formData, { deliveryCanBeDeferred });
  const pendingMessage = getCheckoutPendingMessage(pendingRequirements);
  const pendingFieldKeys = pendingRequirements.map((p) => p.key);
  const isFormValid = pendingRequirements.length === 0;


  // PIX Payment Modal
  if (showPixPayment && createdOrderId && pixGateway && pixGateway !== "infinitepay" && storeData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <PixPayment
                orderId={createdOrderId}
                guestPaymentToken={paymentAttempt?.guestPaymentToken}
                amount={total}
                storeOwnerId={storeData.id}
                gateway={pixGateway as "mercadopago" | "pagbank"}
                primaryColor={primaryColor}
                onPaymentConfirmed={handlePixPaymentConfirmed}
                onExpired={handlePixExpired}
              />
            </div>
            <div className="border-t p-4">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowPixPayment(false);
                  navigate(storePath());
                }}
              >
                Voltar para a loja
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Back button */}
        <div className="mb-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(storePath())}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </Button>
        </div>

        {/* Order Summary Header */}
        <OrderSummaryHeader
          cart={cart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          appliedCoupon={appliedCoupon}
          couponLoading={couponLoading}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={removeCoupon}
          subtotal={subtotal}
          couponDiscount={couponDiscount}
          pixDiscountAmount={pixDiscountAmount}
          pixDiscountPercent={pixDiscountPercent}
          deliveryFee={deliveryFee}
          total={total}
          primaryColor={primaryColor}
          deliveryDefined={deliveryFeeDefined}
        />

        {/* 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 - Customer Data */}
          <CustomerColumn
            isLoggedIn={!!user}
            customerProfile={customerProfile}
            guestEmail={customerEmail}
            onGuestEmailChange={setCustomerEmail}
            guestPaymentDetailsRequired={formData.payment_method === 'cartao_credito'}
            customerAddresses={customerAddresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onAddAddress={handleAddAddress}
            onDeleteAddress={handleDeleteAddress}
            formData={formData}
            setFormData={setFormData}
            primaryColor={primaryColor}
            storeSlug={storeSlug || ""}
            pendingRequirements={pendingRequirements}

          />

          {/* Column 2 - Delivery */}
          <DeliveryColumn
            deliveryMethod={formData.delivery_method}
            onDeliveryMethodChange={(method) => setFormData({ ...formData, delivery_method: method })}
            deliveryOption={deliveryOption}
            deliveryFee={deliveryFee}
            storeData={storeData}
            shippingRules={shippingRules}
            formData={formData}
            setFormData={setFormData}
            primaryColor={primaryColor}
            hasSelectedAddress={!!selectedAddressId}
            pendingRequirements={pendingRequirements}
            deliveryCanBeDeferred={deliveryCanBeDeferred}

            melhorEnvioQuotes={melhorEnvioQuotes}
            melhorEnvioLoading={melhorEnvioLoading}
            melhorEnvioEnabled={melhorEnvioEnabled}
            motoboyFee={motoboyFee}
            motoboyAvailable={motoboyAvailable}
            melhorEnvioServices={melhorEnvioServices}
            genericDeliveryAvailable={genericDeliveryAvailable}
            genericDeliveryFee={checkFreeShippingEligibility() ? 0 : (storeData?.shipping_fixed_fee ?? 0)}
          />

          {/* Column 3 - Payment */}
          <PaymentColumn
            paymentMethod={formData.payment_method}
            onPaymentMethodChange={(method) => setFormData({ ...formData, payment_method: method })}
            paymentSettings={paymentSettings}
            total={total}
            subtotal={subtotal}
            pixDiscountAmount={pixDiscountAmount}
            primaryColor={primaryColor}
            loading={loading}
            onFinalize={handleFinalize}
            isFormValid={isFormValid && !paymentUnresolved && !paymentTerminal && (formData.payment_method !== 'cartao_credito' || z.string().email().safeParse(customerEmail).success)}
            paymentUnresolved={paymentUnresolved}
            paymentTerminal={paymentTerminal}
            onCheckPayment={checkCardResult}
            onNewAttempt={startNewAttempt}
            pendingMessage={pendingMessage}

            cardProcessingError={cardProcessingError}
            customerCpf={customerProfile?.cpf || ""}
          />
        </div>

        {/* Notes */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <Label htmlFor="notes" className="font-medium">Observações do pedido</Label>
          <Textarea
            id="notes"
            placeholder="Alguma observação sobre seu pedido?"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );
};

const Checkout = () => {
  return (
    <CartProvider>
      <CheckoutContent />
    </CartProvider>
  );
};

export default Checkout;
