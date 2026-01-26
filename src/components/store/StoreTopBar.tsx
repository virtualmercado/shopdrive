import { useNavigate } from "react-router-dom";

interface StoreTopBarProps {
  text: string;
  bgColor: string;
  textColor: string;
  linkType: "none" | "content_page" | "category" | "sale" | "section" | "external";
  linkTarget: string | null;
  storeSlug: string;
}

const StoreTopBar = ({
  text,
  bgColor,
  textColor,
  linkType,
  linkTarget,
  storeSlug,
}: StoreTopBarProps) => {
  const navigate = useNavigate();

  const isClickable = linkType !== "none" && linkTarget;

  const handleClick = () => {
    if (!isClickable) return;

    switch (linkType) {
      case "content_page":
        // Navigate to content pages
        const pageRoutes: Record<string, string> = {
          sobre: `/loja/${storeSlug}/sobre`,
          trocas: `/loja/${storeSlug}/trocas`,
          contato: `/loja/${storeSlug}/contato`,
          termos: `/loja/${storeSlug}/termos`,
          privacidade: `/loja/${storeSlug}/privacidade`,
        };
        const pageRoute = pageRoutes[linkTarget] || `/loja/${storeSlug}`;
        navigate(pageRoute);
        break;

      case "category":
        navigate(`/loja/${storeSlug}/categoria/${linkTarget}`);
        break;

      case "sale":
        navigate(`/loja/${storeSlug}/promocoes`);
        break;

      case "section":
        // Scroll to section on the page
        const element = document.getElementById(linkTarget);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
        break;

      case "external":
        if (linkTarget.startsWith("http")) {
          window.open(linkTarget, "_blank", "noopener,noreferrer");
        }
        break;
    }
  };

  if (!text) return null;

  return (
    <div
      className={`w-full py-2 px-4 text-center text-sm font-medium transition-opacity ${
        isClickable ? "cursor-pointer hover:opacity-90" : ""
      }`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
      onClick={handleClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <span className="truncate block md:inline">{text}</span>
    </div>
  );
};

export default StoreTopBar;
