import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        merchant: "bg-transparent data-[state=on]:bg-[var(--merchant-primary)] data-[state=on]:text-[var(--merchant-button-text)]",
        merchantOutline: "border border-[var(--merchant-primary)] bg-transparent hover:bg-[var(--merchant-primary-light)] data-[state=on]:bg-[var(--merchant-primary)] data-[state=on]:text-[var(--merchant-button-text)]",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ToggleProps 
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {
  merchantStyled?: boolean;
}

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  ToggleProps
>(({ className, variant, size, merchantStyled = false, ...props }, ref) => {
  // If merchantStyled is true and variant is default, switch to merchant variant
  const effectiveVariant = merchantStyled && variant === "default" ? "merchant" : variant;
  return (
    <TogglePrimitive.Root 
      ref={ref} 
      className={cn(toggleVariants({ variant: effectiveVariant, size, className }))} 
      data-merchant-styled={merchantStyled ? "toggle" : undefined}
      {...props} 
    />
  );
});

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
