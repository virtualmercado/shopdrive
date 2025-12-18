import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Merchant styled variants
        merchantPrimary: "merchant-btn-primary bg-[var(--merchant-button-bg)] text-[var(--merchant-button-text)] hover:bg-[var(--merchant-button-hover)]",
        merchantSecondary: "merchant-btn-secondary border border-[var(--merchant-primary)] text-[var(--merchant-primary)] bg-transparent hover:bg-[var(--merchant-primary-light)]",
        merchantOutline: "border border-[var(--merchant-primary)] bg-background text-[var(--merchant-primary)] hover:bg-[var(--merchant-primary-light)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  merchantStyled?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, merchantStyled = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // If merchantStyled is true and variant is default, switch to merchantPrimary
    const effectiveVariant = merchantStyled && variant === "default" ? "merchantPrimary" : variant;
    return (
      <Comp 
        className={cn(buttonVariants({ variant: effectiveVariant, size, className }))} 
        ref={ref} 
        data-merchant-styled={merchantStyled ? "btn-primary" : undefined}
        {...props} 
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
