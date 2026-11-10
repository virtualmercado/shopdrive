import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addressSaveErrorMessage, addressToForm, cepDigits, formatCep, validateAddressForm,
  type AddressField, type CustomerAddressForm, type CustomerAddressRow,
} from "@/lib/customerAddress";

interface CustomerAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Address being edited; null opens the "add" mode. */
  address: CustomerAddressRow | null;
  /** Persists the form; must throw on failure so the dialog stays open with the typed data. */
  onSave: (form: CustomerAddressForm) => Promise<void>;
}

const inputClass = "transition-colors focus:border-primary focus:ring-primary";

/** Same fields, order and CEP lookup as the manual customer registration (Clientes → Incluir cadastro). */
const CustomerAddressDialog = ({ open, onOpenChange, address, onSave }: CustomerAddressDialogProps) => {
  const isEdit = !!address;
  const [form, setForm] = useState<CustomerAddressForm>(() => addressToForm(address));
  const [errors, setErrors] = useState<Partial<Record<AddressField, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (open) {
      setForm(addressToForm(address));
      setErrors({});
      setSaveError(null);
    }
  }, [open, address]);

  const set = (field: AddressField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Existing platform behaviour (manual registration): ViaCEP fills street/bairro/cidade/UF; all stay editable.
  const handleCepLookup = async (cep: string) => {
    const clean = cepDigits(cep);
    if (clean.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {
      // Silent fail - user can fill manually
    }
  };

  const handleSave = async () => {
    if (inFlight.current) return;
    const found = validateAddressForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(form);
    } catch (error) {
      setSaveError(addressSaveErrorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const field = (name: AddressField, label: string, placeholder: string, extra?: { span?: boolean; required?: boolean }) => (
    <div className={`space-y-2${extra?.span ? " sm:col-span-2" : ""}`}>
      <label htmlFor={`address-${name}`} className="text-sm font-medium text-foreground">
        {label}{extra?.required ? " *" : ""}
      </label>
      <Input
        id={`address-${name}`}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!errors[name]}
        className={inputClass}
      />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar endereço" : "Adicionar endereço"}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
          className="py-4 space-y-4"
        >
          <h3 className="text-sm font-semibold text-foreground border-b pb-2">Endereço Principal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("recipient_name", "Nome do destinatário", "Nome para entrega (opcional)")}
            <div className="space-y-2">
              <label htmlFor="address-cep" className="text-sm font-medium text-foreground">CEP *</label>
              <Input
                id="address-cep"
                inputMode="numeric"
                value={form.cep}
                onChange={(e) => {
                  const value = formatCep(e.target.value);
                  set("cep", value);
                  if (cepDigits(value).length === 8) void handleCepLookup(value);
                }}
                placeholder="00000-000"
                aria-invalid={!!errors.cep}
                className={inputClass}
              />
              {errors.cep && <p className="text-xs text-destructive">{errors.cep}</p>}
            </div>
            {field("street", "Rua/Logradouro", "Rua, Avenida, etc.", { span: true, required: true })}
            {field("number", "Número", "123", { required: true })}
            {field("complement", "Complemento", "Apto, Bloco, etc. (opcional)")}
            {field("neighborhood", "Bairro", "Bairro", { required: true })}
            {field("city", "Cidade", "Cidade", { required: true })}
            <div className="space-y-2">
              <label htmlFor="address-state" className="text-sm font-medium text-foreground">Estado *</label>
              <Input
                id="address-state"
                value={form.state}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
                placeholder="UF"
                maxLength={2}
                aria-invalid={!!errors.state}
                className={`${inputClass} uppercase`}
              />
              {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="transition-colors border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="text-primary-foreground bg-primary hover:bg-primary/90">
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar endereço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerAddressDialog;
