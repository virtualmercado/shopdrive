import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Truck, Package, Zap, Gift, MapPin } from "lucide-react";
import CustomShippingModal from "@/components/shipping/CustomShippingModal";
import CorreiosModal from "@/components/shipping/CorreiosModal";
import MelhorEnvioModal from "@/components/shipping/MelhorEnvioModal";
import FreeShippingModal from "@/components/shipping/FreeShippingModal";

type DeliveryOption = "delivery_only" | "delivery_and_pickup" | "pickup_only";

const Shipping = () => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor, primaryColor } = useTheme();
  
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>("delivery_only");
  const [useAccountAddress, setUseAccountAddress] = useState(true);
  const [pickupAddress, setPickupAddress] = useState("");
  const [accountAddress, setAccountAddress] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Pickup hours state
  const [pickupHoursWeekdayStart, setPickupHoursWeekdayStart] = useState("");
  const [pickupHoursWeekdayEnd, setPickupHoursWeekdayEnd] = useState("");
  const [pickupHoursSaturdayStart, setPickupHoursSaturdayStart] = useState("");
  const [pickupHoursSaturdayEnd, setPickupHoursSaturdayEnd] = useState("");
  
  // Modal states
  const [customShippingOpen, setCustomShippingOpen] = useState(false);
  const [correiosOpen, setCorreiosOpen] = useState(false);
  const [melhorEnvioOpen, setMelhorEnvioOpen] = useState(false);
  const [freeShippingOpen, setFreeShippingOpen] = useState(false);

  // Integration status
  const [correiosActive, setCorreiosActive] = useState(false);
  const [melhorEnvioActive, setMelhorEnvioActive] = useState(false);
  const [freeShippingMinimum, setFreeShippingMinimum] = useState<number | null>(null);
  const [customRulesCount, setCustomRulesCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      // Fetch profile settings
      const { data: profile } = await supabase
        .from("profiles")
        .select("delivery_option, pickup_address, use_account_address_for_pickup, address, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip_code, free_shipping_minimum, pickup_hours_weekday_start, pickup_hours_weekday_end, pickup_hours_saturday_start, pickup_hours_saturday_end")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDeliveryOption((profile.delivery_option as DeliveryOption) || "delivery_only");
        setPickupAddress(profile.pickup_address || "");
        setUseAccountAddress(profile.use_account_address_for_pickup ?? true);
        setFreeShippingMinimum(profile.free_shipping_minimum);
        
        // Pickup hours
        setPickupHoursWeekdayStart(profile.pickup_hours_weekday_start || "");
        setPickupHoursWeekdayEnd(profile.pickup_hours_weekday_end || "");
        setPickupHoursSaturdayStart(profile.pickup_hours_saturday_start || "");
        setPickupHoursSaturdayEnd(profile.pickup_hours_saturday_end || "");
        
        // Build account address
        if (profile.address) {
          const parts = [
            profile.address,
            profile.address_number,
            profile.address_complement,
            profile.address_neighborhood,
            profile.address_city,
            profile.address_state,
            profile.address_zip_code ? `CEP: ${profile.address_zip_code}` : ""
          ].filter(Boolean);
          setAccountAddress(parts.join(", "));
        }
      }

      // Check Correios integration
      const { data: correios } = await supabase
        .from("correios_settings")
        .select("is_active")
        .eq("user_id", user.id)
        .single();
      setCorreiosActive(correios?.is_active || false);

      // Check Melhor Envio integration
      const { data: melhorEnvio } = await supabase
        .from("melhor_envio_settings")
        .select("is_active")
        .eq("user_id", user.id)
        .single();
      setMelhorEnvioActive(melhorEnvio?.is_active || false);

      // Count custom shipping rules
      const { count } = await supabase
        .from("shipping_rules")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);
      setCustomRulesCount(count || 0);

    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveDeliverySettings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const finalPickupAddress = useAccountAddress ? accountAddress : pickupAddress;

      const { error } = await supabase
        .from("profiles")
        .update({
          delivery_option: deliveryOption,
          pickup_address: finalPickupAddress,
          use_account_address_for_pickup: useAccountAddress,
          pickup_hours_weekday_start: pickupHoursWeekdayStart || null,
          pickup_hours_weekday_end: pickupHoursWeekdayEnd || null,
          pickup_hours_saturday_start: pickupHoursSaturdayStart || null,
          pickup_hours_saturday_end: pickupHoursSaturdayEnd || null,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  const shippingMethods = [
    {
      id: "custom",
      title: "Frete Personalizado",
      description: customRulesCount > 0 ? `${customRulesCount} regra(s) ativa(s)` : "Configure regras de frete por bairro, cidade ou CEP",
      icon: Truck,
      action: "Editar",
      onClick: () => setCustomShippingOpen(true),
      active: customRulesCount > 0,
    },
    {
      id: "correios",
      title: "Correios",
      description: correiosActive ? "Integração ativa" : "Calcule automaticamente PAC, SEDEX e Mini Envios",
      icon: Package,
      action: correiosActive ? "Editar" : "Integrar",
      onClick: () => setCorreiosOpen(true),
      active: correiosActive,
    },
    {
      id: "melhor_envio",
      title: "Melhor Envio",
      description: melhorEnvioActive ? "Integração ativa" : "Múltiplas transportadoras em um só lugar",
      icon: Zap,
      action: melhorEnvioActive ? "Editar" : "Integrar",
      onClick: () => setMelhorEnvioOpen(true),
      active: melhorEnvioActive,
    },
    {
      id: "free_shipping",
      title: "Frete Grátis",
      description: freeShippingMinimum ? `Acima de R$ ${freeShippingMinimum.toFixed(2)}` : "Configure o valor mínimo para frete grátis",
      icon: Gift,
      action: "Editar",
      onClick: () => setFreeShippingOpen(true),
      active: freeShippingMinimum !== null,
    },
  ];

  return (
    <DashboardLayout>
      <style>{`
        .delivery-radio[data-state="checked"] {
          border-color: ${primaryColor} !important;
          background-color: ${primaryColor}15 !important;
        }
        .delivery-radio:hover {
          border-color: ${primaryColor}60 !important;
        }
        /* Force radio button styling */
        [data-radix-collection-item].border-2 {
          background-color: #FFFFFF !important;
        }
        [data-radix-collection-item].border-2[data-state="checked"] {
          background-color: #FFFFFF !important;
        }
        [data-radix-collection-item].border-2 span svg {
          fill: ${primaryColor} !important;
          color: ${primaryColor} !important;
        }
      `}</style>
      
      <div className="space-y-8">
        {/* Shipping Methods Cards */}
        <div className="space-y-4">
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <Truck className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Métodos de Frete</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shippingMethods.map((method) => (
              <div
                key={method.id}
                className="bg-white rounded-lg border p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                  <div 
                    className="p-2 md:p-3 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <method.icon 
                      className="h-5 w-5 md:h-6 md:w-6" 
                      style={{ color: primaryColor }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                      <span className="truncate">{method.title}</span>
                      {method.active && (
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Ativo
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground break-words">{method.description}</p>
                  </div>
                </div>
                <Button
                  onClick={method.onClick}
                  style={{ 
                    backgroundColor: buttonBgColor, 
                    color: buttonTextColor,
                    borderColor: buttonBgColor 
                  }}
                  className="hover:opacity-90 transition-opacity w-full sm:w-auto flex-shrink-0"
                >
                  {method.action}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Options */}
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <Package className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Como seus clientes podem receber seus produtos?
              </h2>
            </div>
          </div>
          
          <RadioGroup
            value={deliveryOption}
            onValueChange={(value) => setDeliveryOption(value as DeliveryOption)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <div 
                className="relative"
                style={{
                  '--radio-primary': primaryColor,
                } as React.CSSProperties}
              >
                <RadioGroupItem 
                  value="delivery_only" 
                  id="delivery_only"
                  className="border-2 bg-white data-[state=checked]:bg-white data-[state=unchecked]:bg-white"
                  style={{
                    borderColor: primaryColor,
                    backgroundColor: '#FFFFFF',
                    color: primaryColor,
                  }}
                />
              </div>
              <Label htmlFor="delivery_only" className="cursor-pointer font-medium">
                Somente entrega
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <div 
                className="relative"
                style={{
                  '--radio-primary': primaryColor,
                } as React.CSSProperties}
              >
                <RadioGroupItem 
                  value="delivery_and_pickup" 
                  id="delivery_and_pickup"
                  className="border-2 bg-white data-[state=checked]:bg-white data-[state=unchecked]:bg-white"
                  style={{
                    borderColor: primaryColor,
                    backgroundColor: '#FFFFFF',
                    color: primaryColor,
                  }}
                />
              </div>
              <Label htmlFor="delivery_and_pickup" className="cursor-pointer font-medium">
                Entrega e retirada no local
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <div 
                className="relative"
                style={{
                  '--radio-primary': primaryColor,
                } as React.CSSProperties}
              >
                <RadioGroupItem 
                  value="pickup_only" 
                  id="pickup_only"
                  className="border-2 bg-white data-[state=checked]:bg-white data-[state=unchecked]:bg-white"
                  style={{
                    borderColor: primaryColor,
                    backgroundColor: '#FFFFFF',
                    color: primaryColor,
                  }}
                />
              </div>
              <Label htmlFor="pickup_only" className="cursor-pointer font-medium">
                Somente retirada no local
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Pickup Address */}
        {(deliveryOption === "delivery_and_pickup" || deliveryOption === "pickup_only") && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                  <MapPin className="h-4 w-4 text-gray-600" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Endereço de Retirada</h2>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use_account_address"
                checked={useAccountAddress}
                onCheckedChange={(checked) => setUseAccountAddress(checked as boolean)}
                style={{
                  borderColor: useAccountAddress ? primaryColor : undefined,
                  backgroundColor: useAccountAddress ? primaryColor : undefined,
                }}
              />
              <Label htmlFor="use_account_address" className="cursor-pointer">
                Usar o endereço da Minha Conta
              </Label>
            </div>

            {useAccountAddress && accountAddress && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Endereço cadastrado:</p>
                <p className="text-sm font-medium mt-1">{accountAddress}</p>
              </div>
            )}

            {!useAccountAddress && (
              <div className="space-y-2">
                <Label htmlFor="pickup_address">Endereço de retirada diferente</Label>
                <Input
                  id="pickup_address"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Digite o endereço completo para retirada"
                  className="focus-visible:ring-offset-0"
                  style={{
                    borderColor: `${primaryColor}40`,
                  }}
                />
              </div>
            )}

            {/* Pickup Hours Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-foreground">Horário de Entrega</h3>
              
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-shrink-0">De segunda a sexta, das</span>
                  <Input
                    type="time"
                    value={pickupHoursWeekdayStart}
                    onChange={(e) => setPickupHoursWeekdayStart(e.target.value)}
                    className="w-24 h-8 text-center focus-visible:ring-offset-0"
                    style={{ borderColor: `${primaryColor}40` }}
                  />
                  <span>às</span>
                  <Input
                    type="time"
                    value={pickupHoursWeekdayEnd}
                    onChange={(e) => setPickupHoursWeekdayEnd(e.target.value)}
                    className="w-24 h-8 text-center focus-visible:ring-offset-0"
                    style={{ borderColor: `${primaryColor}40` }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-shrink-0">E aos sábados das</span>
                  <Input
                    type="time"
                    value={pickupHoursSaturdayStart}
                    onChange={(e) => setPickupHoursSaturdayStart(e.target.value)}
                    className="w-24 h-8 text-center focus-visible:ring-offset-0"
                    style={{ borderColor: `${primaryColor}40` }}
                  />
                  <span>às</span>
                  <Input
                    type="time"
                    value={pickupHoursSaturdayEnd}
                    onChange={(e) => setPickupHoursSaturdayEnd(e.target.value)}
                    className="w-24 h-8 text-center focus-visible:ring-offset-0"
                    style={{ borderColor: `${primaryColor}40` }}
                  />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Os horários serão exibidos no checkout da sua loja virtual quando o cliente escolher a opção "Retirada".
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveDeliverySettings}
            disabled={loading}
            style={{ 
              backgroundColor: buttonBgColor, 
              color: buttonTextColor,
              borderColor: buttonBgColor 
            }}
            className="hover:opacity-90 transition-opacity"
          >
            {loading ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Modals */}
      <CustomShippingModal 
        open={customShippingOpen} 
        onOpenChange={setCustomShippingOpen}
        onSuccess={fetchSettings}
      />
      <CorreiosModal 
        open={correiosOpen} 
        onOpenChange={setCorreiosOpen}
        onSuccess={fetchSettings}
      />
      <MelhorEnvioModal 
        open={melhorEnvioOpen} 
        onOpenChange={setMelhorEnvioOpen}
        onSuccess={fetchSettings}
      />
      <FreeShippingModal 
        open={freeShippingOpen} 
        onOpenChange={setFreeShippingOpen}
        onSuccess={fetchSettings}
      />
    </DashboardLayout>
  );
};

export default Shipping;
