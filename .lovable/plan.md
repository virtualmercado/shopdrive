

## Plano: Corrigir Centralização do Slider de Zoom

### Problema Identificado

O slider de Zoom está configurado com `min={-40}` e `max={60}`, mas o Radix Slider posiciona o thumb **proporcionalmente ao range numérico**. Como o range é assimétrico, o valor `0` (representando 100%) aparece em **40% do track** ao invés de 50%.

### Solução

Implementar um **mapeamento bipolar** onde:
- O slider interno usa um range simétrico (-100 a +100)
- A posição central (0) sempre representa 100%
- Funções de conversão mapeiam a posição para o valor real de scale

### Mudanças Técnicas

**Arquivo:** `src/components/ImageEditor/ImageEditor.tsx`

1. **Adicionar estado para posição do slider:**
   ```tsx
   const [scaleSliderPos, setScaleSliderPos] = useState(0);
   ```

2. **Criar funções de mapeamento:**
   ```tsx
   // Converte posição do slider (-100 a +100) para scale (60% a 160%)
   const sliderPosToScale = (pos: number): number => {
     if (pos <= 0) {
       // -100 → 60%, 0 → 100%
       return 100 + (pos / 100) * 40;
     } else {
       // 0 → 100%, +100 → 160%
       return 100 + (pos / 100) * 60;
     }
   };

   // Converte scale (60% a 160%) para posição do slider (-100 a +100)
   const scaleToSliderPos = (s: number): number => {
     if (s <= 100) {
       // 60% → -100, 100% → 0
       return ((s - 100) / 40) * 100;
     } else {
       // 100% → 0, 160% → +100
       return ((s - 100) / 60) * 100;
     }
   };
   ```

3. **Atualizar handler do slider:**
   ```tsx
   const handleScaleSliderChange = useCallback((pos: number) => {
     if (isAnimatingReset) return;
     
     const newScale = sliderPosToScale(pos);
     // Aplicar soft-clamp existente
     const visibility = calculateVisibilityFactor(newScale, offsetX);
     const clampMultiplier = getSoftClampMultiplier(visibility);
     
     const delta = newScale - scale;
     const softDelta = delta * clampMultiplier;
     const finalScale = Math.max(60, Math.min(160, scale + softDelta));
     
     setScale(finalScale);
     setScaleSliderPos(scaleToSliderPos(finalScale));
     setScaleInput(Math.round(finalScale).toString());
     setHasChanges(true);
   }, [/* deps */]);
   ```

4. **Atualizar o componente Slider:**
   ```tsx
   <Slider
     value={[scaleSliderPos]}
     onValueChange={([pos]) => handleScaleSliderChange(pos)}
     min={-100}
     max={100}
     step={1}
     className="w-full"
   />
   ```

5. **Sincronizar estados existentes:**
   - Quando `handleScaleInputChange` altera o scale, também atualizar `scaleSliderPos`
   - Na animação de reset, animar `scaleSliderPos` junto com `scale`
   - No `handleUndo`, restaurar a posição do slider

### Diagrama Visual

```text
    Slider Visual Track
    ┌────────────────────────────────────────────────┐
    │         ◀── Zoom Out    Zoom In ──▶           │
    │    60%        80%    [100%]   130%       160% │
    │     │          │       │        │          │  │
    │   -100       -50       0       +50       +100 │
    │              (posição interna do slider)      │
    └────────────────────────────────────────────────┘
                           ↑
                    Centro Visual = 100%
```

### Resultado Esperado

- O thumb do slider fica **exatamente no centro** quando o zoom é 100%
- Arrastar para esquerda reduz o zoom (até 60%)
- Arrastar para direita aumenta o zoom (até 160%)
- Comportamento consistente com os controles de Rotação e Posição X

