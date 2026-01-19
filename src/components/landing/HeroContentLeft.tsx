import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface HeroContentLeftProps {
  badge: string;
  title: string;
  subtitle: string;
  buttonPrimary: string;
  buttonSecondary: string;
  infoText: string;
}

const HeroContentLeft = ({
  badge,
  title,
  subtitle,
  buttonPrimary,
  buttonSecondary,
  infoText,
}: HeroContentLeftProps) => {
  return (
    <div className="space-y-6 text-left">
      {/* Badge */}
      <Badge 
        variant="secondary" 
        className="text-sm px-4 py-2 bg-primary text-white border-none rounded-md"
      >
        {badge}
      </Badge>

      {/* Title */}
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
        {title}
      </h1>

      {/* Subtitle */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
        {subtitle}
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <Button asChild size="lg" className="text-lg px-8 w-full sm:w-auto">
          <Link to="/register">{buttonPrimary}</Link>
        </Button>
        <Button 
          asChild 
          variant="outline" 
          size="lg" 
          className="text-lg px-8 w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Link to="/login">{buttonSecondary}</Link>
        </Button>
      </div>

      {/* Info Text */}
      <p className="text-sm text-muted-foreground pt-2">
        {infoText}
      </p>
    </div>
  );
};

export default HeroContentLeft;
