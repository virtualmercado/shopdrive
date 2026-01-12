import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { useCoupon } from "@/hooks/useCoupon";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { PixPayment } from "@/components/checkout/PixPayment";
import { OrderSummaryHeader } from "@/components/checkout/OrderSummaryHeader";
import { CustomerColumn } from "@/components/checkout/CustomerColumn";
import { DeliveryColumn } from "@/components/checkout/DeliveryColumn";
import { PaymentColumn, CardTokenData } from "@/components/checkout/PaymentColumn";

type DeliveryMethod = "retirada" | "motoboy" | "sedex" | "pac" | "mini_envios";
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
  delivery_method: DeliveryMethod;
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
  delivery_method: z.enum(["retirada", "motoboy", "sedex", "pac", "mini_envios"]),
  payment_method: z.enum(["cartao_credito", "pix", "boleto", "whatsapp"]),
  notes: z.string().max(1000).optional(),
});

const CheckoutContent = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { cart, getTotal, clearCart, updateQuantity, removeFromCart } = useCart();
  const { user, signIn, signUp } = useCustomerAuth();
  
  const [loading, setLoading] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [motoboyFee, setMotoboyFee] = useState<number | null>(null);
  const [motoboyAvailable, setMotoboyAvailable] = useState(false);
  const [miniEnviosAvailable, setMiniEnviosAvailable] = useState(true);
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingRules, setShippingRules] = useState<any[]>([]);
  const [deliveryOption, setDeliveryOption] = useState<string>("delivery_only");
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [showPixPayment, setShowPixPayment] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [pixGateway, setPixGateway] = useState<"mercadopago" | "pagbank" | null>(null);
  const [cardProcessingError, setCardProcessingError] = useState<string | null>(null);
  
  // Customer data
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  
  // Melhor Envio quotes
  interface MelhorEnvioQuote {
    id: number;
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
  const [melhorEnvioLoading, setMelhorEnvioLoading] = useState(false);
  const [melhorEnvioEnabled, setMelhorEnvioEnabled] = useState(false);

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
    delivery_method: "motoboy",
    payment_method: "pix",
    notes: "",
  });

  // Fetch store data
  useEffect(() => {
    const fetchStoreData = async () => {
      if (!storeSlug) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("store_slug", storeSlug)
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
          if (paySettings.pix_enabled && paySettings.pix_provider) {
            setPixGateway(paySettings.pix_provider === "mercado_pago" ? "mercadopago" : "pagbank");
          } else if (paySettings.mercadopago_enabled && paySettings.mercadopago_accepts_pix) {
            setPixGateway("mercadopago");
          } else if (paySettings.pagbank_enabled && paySettings.pagbank_accepts_pix) {
            setPixGateway("pagbank");
          }
        }

        // Check if Melhor Envio is enabled for this store
        const { data: melhorEnvioSettings } = await supabase
          .from("melhor_envio_settings")
          .select("is_active")
          .eq("user_id", data.id)
          .eq("is_active", true)
          .single();

        if (melhorEnvioSettings) {
          setMelhorEnvioEnabled(true);
        }
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
        return;
      }

      const originCep = storeData.merchant_cep || storeData.pickup_address?.match(/\d{5}-?\d{3}/)?.[0] || "";
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
          weight: item.weight || 0.3,
          insurance_value: (item.promotional_price || item.price) * item.quantity,
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
        } else if (data?.quotes) {
          console.log("Melhor Envio quotes received:", data.quotes);
          setMelhorEnvioQuotes(data.quotes);
        }
      } catch (error) {
        console.error("Error calling Melhor Envio:", error);
        setMelhorEnvioQuotes([]);
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

    // If motoboy was selected but is no longer available, switch to another method
    if (formData.delivery_method === "motoboy" && !available) {
      // Try to find an available delivery method
      if (melhorEnvioEnabled && melhorEnvioQuotes.length > 0) {
        const pacQuote = melhorEnvioQuotes.find(q => [2, 4].includes(q.id));
        if (pacQuote) {
          setFormData(prev => ({ ...prev, delivery_method: "pac" }));
          return;
        }
      }
      // Fallback to pickup if available
      if (deliveryOption === "pickup_only" || deliveryOption === "delivery_and_pickup") {
        setFormData(prev => ({ ...prev, delivery_method: "retirada" }));
      }
    }
  }, [formData.neighborhood, formData.city, formData.cep, shippingRules, storeData]);

  // Mini Envios validation rules based on official Correios specifications
  // Min dimensions: 1cm height, 8cm width, 13cm length
  // Max dimensions: 4cm height, 16cm width, 24cm length
  // Max weight: 300g (0.3kg)
  const validateMiniEnvios = (): boolean => {
    if (cart.length === 0) return false;

    // Calculate consolidated package dimensions
    // For multiple items, we need to estimate package size
    let totalWeight = 0;
    let maxHeight = 0;
    let maxWidth = 0;
    let maxLength = 0;

    for (const item of cart) {
      const itemWeight = (item.weight || 0.3) * item.quantity;
      const itemHeight = item.height || 2;
      const itemWidth = item.width || 11;
      const itemLength = item.length || 16;

      totalWeight += itemWeight;
      
      // For stacked items, we sum heights and take max of width/length
      maxHeight += itemHeight * item.quantity;
      maxWidth = Math.max(maxWidth, itemWidth);
      maxLength = Math.max(maxLength, itemLength);
    }

    // Validate weight (max 300g = 0.3kg)
    if (totalWeight > 0.3) {
      console.log("Mini Envios: Weight exceeds 300g limit", totalWeight);
      return false;
    }

    // Validate minimum dimensions
    if (maxHeight < 1) {
      console.log("Mini Envios: Height below 1cm minimum", maxHeight);
      return false;
    }
    if (maxWidth < 8) {
      console.log("Mini Envios: Width below 8cm minimum", maxWidth);
      return false;
    }
    if (maxLength < 13) {
      console.log("Mini Envios: Length below 13cm minimum", maxLength);
      return false;
    }

    // Validate maximum dimensions
    if (maxHeight > 4) {
      console.log("Mini Envios: Height exceeds 4cm maximum", maxHeight);
      return false;
    }
    if (maxWidth > 16) {
      console.log("Mini Envios: Width exceeds 16cm maximum", maxWidth);
      return false;
    }
    if (maxLength > 24) {
      console.log("Mini Envios: Length exceeds 24cm maximum", maxLength);
      return false;
    }

    return true;
  };

  // Update Mini Envios availability whenever cart changes
  useEffect(() => {
    const isValid = validateMiniEnvios();
    setMiniEnviosAvailable(isValid);
    
    // If Mini Envios was selected but is no longer valid, switch to another method
    if (formData.delivery_method === "mini_envios" && !isValid) {
      // Try PAC first
      if (melhorEnvioEnabled && melhorEnvioQuotes.length > 0) {
        const pacQuote = melhorEnvioQuotes.find(q => q.id === 1 || q.name?.toUpperCase().includes('PAC'));
        if (pacQuote) {
          setFormData(prev => ({ ...prev, delivery_method: "pac" }));
          return;
        }
      }
      // Fallback to motoboy if available
      if (motoboyAvailable) {
        setFormData(prev => ({ ...prev, delivery_method: "motoboy" }));
        return;
      }
      // Fallback to pickup if available
      if (deliveryOption === "pickup_only" || deliveryOption === "delivery_and_pickup") {
        setFormData(prev => ({ ...prev, delivery_method: "retirada" }));
      }
    }
  }, [cart, formData.delivery_method, melhorEnvioEnabled, melhorEnvioQuotes, motoboyAvailable, deliveryOption]);

  const calculateDeliveryFee = () => {
    if (formData.delivery_method === "retirada") {
      setDeliveryFee(0);
      return;
    }
    if (!storeData) return;
    if (checkFreeShippingEligibility()) {
      setDeliveryFee(0);
      return;
    }

    // Motoboy uses custom shipping rules exclusively
    if (formData.delivery_method === "motoboy") {
      if (motoboyFee !== null) {
        setDeliveryFee(motoboyFee);
      } else {
        setDeliveryFee(0);
      }
      return;
    }

    // Check Melhor Envio quotes for SEDEX, PAC, Mini Envios
    if (["sedex", "pac", "mini_envios"].includes(formData.delivery_method)) {
      const serviceMap: Record<string, number[]> = {
        sedex: [1, 3], // SEDEX codes
        pac: [2, 4],   // PAC codes
        mini_envios: [17], // Mini Envios code
      };
      const serviceCodes = serviceMap[formData.delivery_method] || [];
      const quote = melhorEnvioQuotes.find(q => serviceCodes.includes(q.id));
      if (quote) {
        setDeliveryFee(quote.custom_price || quote.price);
        return;
      }
    }

    // Fallback to fixed fee for other cases
    setDeliveryFee(storeData.shipping_fixed_fee || 10);
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
    setCardProcessingError(null);
    
    if (cart.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }

    if (!formData.customer_name || !formData.customer_phone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.delivery_method !== "retirada") {
      if (!formData.cep || !formData.address || !formData.number || !formData.neighborhood || !formData.city || !formData.state) {
        toast.error("Preencha todos os dados de endereço para entrega");
        return;
      }
    }

    try {
      const addressString = formData.delivery_method !== "retirada" 
        ? `${formData.address}, ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
        : storeData?.pickup_address || "Retirada na loja";

      checkoutSchema.parse({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_address: addressString,
        delivery_method: formData.delivery_method,
        payment_method: formData.payment_method,
        notes: formData.notes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      if (!storeData) throw new Error("Dados da loja não encontrados");

      const subtotal = getTotal();
      const couponDiscount = appliedCoupon?.isValid ? appliedCoupon.discount : 0;
      const pixDiscountPercent = (formData.payment_method === "pix" && paymentSettings?.pix_discount_percent > 0) 
        ? paymentSettings.pix_discount_percent : 0;
      const pixDiscountAmount = (subtotal - couponDiscount) * (pixDiscountPercent / 100);
      const total = Math.max(0, subtotal - couponDiscount - pixDiscountAmount + deliveryFee);

      const addressString = formData.delivery_method !== "retirada" 
        ? `${formData.address}, ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
        : storeData.pickup_address || "Retirada na loja";

      const deliveryMethodLabel = formData.delivery_method === "retirada" ? "retirada" : "entrega";

      // CREDIT CARD FLOW - Process payment BEFORE creating order using card token
      if (formData.payment_method === "cartao_credito" && cardTokenData) {
        console.log("Processing credit card payment with token before order creation");
        
        try {
          const paymentResponse = await supabase.functions.invoke("process-credit-card", {
            body: {
              amount: total,
              storeOwnerId: storeData.id,
              customerName: formData.customer_name,
              customerEmail: customerEmail || "",
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

          console.log("Payment response:", paymentResponse);

          // Handle edge function error
          if (paymentResponse.error) {
            console.error("Payment processing error:", paymentResponse.error);
            const errorMessage = typeof paymentResponse.error === 'string' 
              ? paymentResponse.error 
              : paymentResponse.error.message || "Erro ao processar pagamento";
            setCardProcessingError(errorMessage);
            toast.error(errorMessage);
            setLoading(false);
            return;
          }

          const paymentData = paymentResponse.data;

          // Handle rejected payment
          if (paymentData.status === "rejected" || !paymentData.success) {
            console.error("Payment rejected:", paymentData);
            const errorMessage = paymentData.error || "Pagamento recusado pelo banco emissor";
            setCardProcessingError(errorMessage);
            toast.error(errorMessage);
            setLoading(false);
            return;
          }

          // Payment approved or pending - create order with payment info
          const orderStatus = paymentData.status === "approved" ? "confirmed" : "pending";
          
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
              store_owner_id: storeData.id,
              customer_id: user?.id || null,
              customer_name: formData.customer_name,
              customer_email: customerEmail || "",
              customer_phone: formData.customer_phone,
              customer_address: addressString,
              delivery_method: deliveryMethodLabel,
              payment_method: formData.payment_method,
              subtotal,
              delivery_fee: deliveryFee,
              total_amount: total,
              status: orderStatus,
              notes: formData.notes || null,
              order_source: "online",
            })
            .select()
            .single();

          if (orderError || !order) {
            console.error("Order creation error after payment:", orderError);
            throw new Error("Pagamento aprovado, mas houve erro ao criar o pedido. Entre em contato com a loja.");
          }

          // Insert order items
          const orderItems = cart.map((item) => ({
            order_id: order.id,
            product_id: item.id,
            product_name: item.name,
            product_price: item.promotional_price || item.price,
            quantity: item.quantity,
            subtotal: (item.promotional_price || item.price) * item.quantity,
          }));

          const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
          if (itemsError) {
            console.error("Order items error:", itemsError);
          }

          // Record coupon usage
          if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
            await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
          }

          clearCart();
          
          if (paymentData.status === "approved") {
            toast.success("Pagamento aprovado! Pedido confirmado.");
          } else {
            toast.info(paymentData.message || "Pagamento em processamento. Aguarde a confirmação.");
          }
          
          navigate(`/loja/${storeSlug}/pedido-confirmado/${order.id}`);
          return;

        } catch (paymentError: any) {
          console.error("Credit card payment exception:", paymentError);
          const errorMessage = paymentError.message || "Erro ao processar pagamento com cartão";
          setCardProcessingError(errorMessage);
          toast.error(errorMessage);
          setLoading(false);
          return;
        }
      }

      // WhatsApp: abrir o WhatsApp Web imediatamente (sem api.whatsapp.com) enquanto ainda existe gesto do usuário
      if (formData.payment_method === "whatsapp" && storeData.whatsapp_number) {
        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR");
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        const itemsList = cart
          .map(
            (item) =>
              `• ${item.name} (x${item.quantity}) - R$ ${(
                (item.promotional_price || item.price) * item.quantity
              ).toFixed(2)}`
          )
          .join("\n");

        const deliveryText = formData.delivery_method === "retirada" ? "Retirada" : "Entrega";

        const whatsappMessage = `*Novo Pedido - ${storeData.store_name || "Loja"}*

Cliente: ${formData.customer_name}
Contato: ${formData.customer_phone}
Data: ${dateStr} ${timeStr}

Itens:
${itemsList}

Subtotal: R$ ${subtotal.toFixed(2)}
Frete: R$ ${deliveryFee.toFixed(2)}
Total: R$ ${total.toFixed(2)}

Entrega: ${deliveryText}

Olá! Gostaria de confirmar este pedido e combinar o pagamento.`;

        // Normalize phone to E.164 format (55DDDNUMERO)
        let cleanPhone = storeData.whatsapp_number.replace(/\D/g, "");
        if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

        const encodedMessage = encodeURIComponent(whatsappMessage);

        // Link direto do WhatsApp Web (evita redirecionamento para api.whatsapp.com)
        const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}&type=phone_number&app_absent=0`;

        console.log("[Checkout] Opening WhatsApp:", whatsappUrl);

        const link = document.createElement("a");
        link.href = whatsappUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      // For non-credit card payments, create order first
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_owner_id: storeData.id,
          customer_id: user?.id || null,
          customer_name: formData.customer_name,
          customer_email: customerEmail || "",
          customer_phone: formData.customer_phone,
          customer_address: addressString,
          delivery_method: deliveryMethodLabel,
          payment_method: formData.payment_method,
          subtotal,
          delivery_fee: deliveryFee,
          total_amount: total,
          status: "pending",
          notes: formData.notes || null,
          order_source: "online",
        })
        .select()
        .single();

      if (orderError || !order) throw new Error("Erro ao criar pedido");

      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_price: item.promotional_price || item.price,
        quantity: item.quantity,
        subtotal: (item.promotional_price || item.price) * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw new Error("Erro ao adicionar itens ao pedido");

      const isPix = formData.payment_method === "pix";
      const hasPixGateway = pixGateway !== null;

      if (isPix && hasPixGateway) {
        setCreatedOrderId(order.id);
        setShowPixPayment(true);
        setLoading(false);
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
            // Navigate to confirmation page where boleto details will be shown
            navigate(`/loja/${storeSlug}/pedido-confirmado/${order.id}`);
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

      // WhatsApp flow: o WhatsApp Web é aberto antes da criação do pedido (para manter o gesto do usuário).

      if (appliedCoupon?.isValid && appliedCoupon.couponId && customerEmail) {
        await recordCouponUsage(appliedCoupon.couponId, customerEmail, order.id);
      }

      clearCart();
      toast.success("Pedido realizado com sucesso!");
      setTimeout(() => navigate(`/loja/${storeSlug}/pedido-confirmado/${order.id}`), 1000);
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Erro ao finalizar pedido");
    } finally {
      setLoading(false);
    }
  };

  const handlePixPaymentConfirmed = () => {
    clearCart();
    toast.success("Pagamento confirmado!");
    navigate(`/loja/${storeSlug}/pedido-confirmado/${createdOrderId}`);
  };

  const handlePixExpired = () => {
    toast.warning("O QR Code expirou. Clique para gerar um novo.");
  };

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
          <Button onClick={() => navigate(`/loja/${storeSlug}`)}>Voltar para a loja</Button>
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
  
  const isFormValid = !!(formData.customer_name && formData.customer_phone && 
    (formData.delivery_method === "retirada" || 
     (formData.cep && formData.address && formData.number && formData.neighborhood && formData.city && formData.state)));

  // PIX Payment Modal
  if (showPixPayment && createdOrderId && pixGateway && storeData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <PixPayment
                orderId={createdOrderId}
                amount={total}
                storeOwnerId={storeData.id}
                gateway={pixGateway}
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
                  navigate(`/loja/${storeSlug}`);
                }}
              >
                Cancelar e voltar para a loja
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
            onClick={() => navigate(`/loja/${storeSlug}`)}
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
          deliveryDefined={formData.delivery_method === "retirada" || !!(formData.cep && formData.city)}
        />

        {/* 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 - Customer Data */}
          <CustomerColumn
            isLoggedIn={!!user}
            customerProfile={customerProfile}
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
            melhorEnvioQuotes={melhorEnvioQuotes}
            melhorEnvioLoading={melhorEnvioLoading}
            melhorEnvioEnabled={melhorEnvioEnabled}
            motoboyFee={motoboyFee}
            motoboyAvailable={motoboyAvailable}
            miniEnviosAvailable={miniEnviosAvailable}
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
            isFormValid={isFormValid}
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
