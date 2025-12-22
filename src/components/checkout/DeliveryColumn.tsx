import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Truck, Store, Package } from "lucide-react";

type DeliveryMethod = "retirada" | "motoboy" | "sedex" | "pac" | "mini_envios";

interface DeliveryColumnProps {
  deliveryMethod: DeliveryMethod;
  onDeliveryMethodChange: (method: DeliveryMethod) => void;
  deliveryOption: string;
  deliveryFee: number;
  storeData: {
    pickup_address?: string;
    pickup_hours_weekday_start?: string;
    pickup_hours_weekday_end?: string;
    pickup_hours_saturday_start?: string;
    pickup_hours_saturday_end?: string;
  } | null;
  shippingRules: any[];
  formData: {
    cep: string;
    address: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  setFormData: (data: any) => void;
  primaryColor: string;
  hasSelectedAddress: boolean;
}

export const DeliveryColumn = ({
  deliveryMethod,
  onDeliveryMethodChange,
  deliveryOption,
  deliveryFee,
  storeData,
  shippingRules,
  formData,
  setFormData,
  primaryColor,
  hasSelectedAddress,
}: DeliveryColumnProps) => {
  const showDeliveryOptions = deliveryOption === "delivery_only" || deliveryOption === "delivery_and_pickup";
  const showPickupOption = deliveryOption === "pickup_only" || deliveryOption === "delivery_and_pickup";

  const fetchAddressFromCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData({
            ...formData,
            address: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
            cep: cep,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  const formatPickupHours = () => {
    if (!storeData) return null;
    
    const weekdayStart = storeData.pickup_hours_weekday_start;
    const weekdayEnd = storeData.pickup_hours_weekday_end;
    const saturdayStart = storeData.pickup_hours_saturday_start;
    const saturdayEnd = storeData.pickup_hours_saturday_end;
    
    const parts = [];
    if (weekdayStart && weekdayEnd) {
      parts.push(`Seg-Sex: ${weekdayStart} às ${weekdayEnd}`);
    }
    if (saturdayStart && saturdayEnd) {
      parts.push(`Sáb: ${saturdayStart} às ${saturdayEnd}`);
    }
    
    return parts.length > 0 ? parts.join(" | ") : null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2 mb-1">
          <Truck className="h-5 w-5" style={{ color: primaryColor }} />
          Entrega
        </h3>
        <p className="text-xs text-muted-foreground">
          Cálculo baseado no endereço de entrega informado
        </p>
      </div>

      <div className="border-t pt-4">
        <RadioGroup
          value={deliveryMethod}
          onValueChange={(value) => onDeliveryMethodChange(value as DeliveryMethod)}
          className="space-y-3"
        >
          {/* Motoboy Option */}
          {showDeliveryOptions && shippingRules.length > 0 && (
            <div 
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                deliveryMethod === "motoboy" ? "border-2" : "border-border"
              }`}
              style={deliveryMethod === "motoboy" ? { borderColor: primaryColor } : {}}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="motoboy" id="motoboy" />
                <div>
                  <Label htmlFor="motoboy" className="font-medium cursor-pointer">
                    🏍️ Motoboy
                  </Label>
                  <p className="text-xs text-muted-foreground">De 01 a 02 dias</p>
                </div>
              </div>
              <span className="font-semibold text-sm">
                R$ {deliveryFee.toFixed(2)}
              </span>
            </div>
          )}

          {/* Correios SEDEX */}
          {showDeliveryOptions && (
            <div 
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all opacity-50 ${
                deliveryMethod === "sedex" ? "border-2" : "border-border"
              }`}
              style={deliveryMethod === "sedex" ? { borderColor: primaryColor } : {}}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="sedex" id="sedex" disabled />
                <div>
                  <Label htmlFor="sedex" className="font-medium cursor-pointer">
                    📦 Correios SEDEX
                  </Label>
                  <p className="text-xs text-muted-foreground">Em breve (Melhor Envio)</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">--</span>
            </div>
          )}

          {/* Correios PAC */}
          {showDeliveryOptions && (
            <div 
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all opacity-50 ${
                deliveryMethod === "pac" ? "border-2" : "border-border"
              }`}
              style={deliveryMethod === "pac" ? { borderColor: primaryColor } : {}}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="pac" id="pac" disabled />
                <div>
                  <Label htmlFor="pac" className="font-medium cursor-pointer">
                    📦 Correios PAC
                  </Label>
                  <p className="text-xs text-muted-foreground">Em breve (Melhor Envio)</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">--</span>
            </div>
          )}

          {/* Correios Mini Envios */}
          {showDeliveryOptions && (
            <div 
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all opacity-50 ${
                deliveryMethod === "mini_envios" ? "border-2" : "border-border"
              }`}
              style={deliveryMethod === "mini_envios" ? { borderColor: primaryColor } : {}}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="mini_envios" id="mini_envios" disabled />
                <div>
                  <Label htmlFor="mini_envios" className="font-medium cursor-pointer">
                    📦 Correios Mini Envios
                  </Label>
                  <p className="text-xs text-muted-foreground">Em breve (Melhor Envio)</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">--</span>
            </div>
          )}

          {/* Pickup Option */}
          {showPickupOption && (
            <>
              <div 
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                  deliveryMethod === "retirada" ? "border-2" : "border-border"
                }`}
                style={deliveryMethod === "retirada" ? { borderColor: primaryColor } : {}}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="retirada" id="retirada" />
                  <div>
                    <Label htmlFor="retirada" className="font-medium cursor-pointer">
                      🏪 Retirada
                    </Label>
                    <p className="text-xs text-muted-foreground">De 01 a 02 dias</p>
                  </div>
                </div>
                <span className="font-semibold text-sm text-green-600">
                  Grátis
                </span>
              </div>

              {/* Pickup Address and Hours */}
              {deliveryMethod === "retirada" && storeData && (
                <div className="ml-6 p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Store className="h-4 w-4" style={{ color: primaryColor }} />
                    Endereço de retirada:
                  </p>
                  {storeData.pickup_address && (
                    <p className="text-sm text-muted-foreground">{storeData.pickup_address}</p>
                  )}
                  {formatPickupHours() && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground">Horário de atendimento:</p>
                      <p className="text-xs text-muted-foreground">{formatPickupHours()}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </RadioGroup>
      </div>

      {/* Address Fields for delivery */}
      {deliveryMethod !== "retirada" && !hasSelectedAddress && (
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Endereço de entrega:</p>
          <div>
            <Label className="text-xs">CEP *</Label>
            <Input
              placeholder="00000-000"
              value={formData.cep}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, cep: value });
                fetchAddressFromCep(value);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Endereço *</Label>
            <Input
              placeholder="Rua, Avenida..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Número *</Label>
              <Input
                placeholder="123"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Complemento</Label>
              <Input
                placeholder="Apto, Bloco..."
                value={formData.complement}
                onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Bairro *</Label>
            <Input
              placeholder="Bairro"
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cidade *</Label>
              <Input
                placeholder="Cidade"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Estado *</Label>
              <Input
                placeholder="UF"
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
