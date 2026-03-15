import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Link, Image, RemoveFormatting, Code,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "del",
  "ul", "ol", "li", "h2", "h3", "a", "img", "div", "span",
];

function sanitizeHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) {
      return Array.from(el.childNodes).map(clean).join("");
    }
    let attrs = "";
    if (tag === "a") {
      const href = el.getAttribute("href");
      if (href) attrs = ` href="${href}" target="_blank" rel="noopener noreferrer"`;
    }
    if (tag === "img") {
      const src = el.getAttribute("src");
      const alt = el.getAttribute("alt") || "";
      if (src) return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;" />`;
      return "";
    }
    const children = Array.from(el.childNodes).map(clean).join("");
    if (tag === "br") return "<br />";
    return `<${tag}${attrs}>${children}</${tag}>`;
  };
  return Array.from(doc.body.childNodes).map(clean).join("");
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}

const ToolbarButton = ({ icon, title, onClick, active }: ToolbarButtonProps) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={cn(
      "h-8 w-8 flex items-center justify-center rounded transition-colors shrink-0",
      "hover:bg-muted text-foreground/70 hover:text-foreground",
      active && "bg-muted text-foreground font-bold"
    )}
  >
    {icon}
  </button>
);

const ToolbarSep = () => <div className="w-px h-5 bg-border shrink-0" />;

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export function RichTextEditor({ value, onChange, placeholder, maxLength = 4000 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState("");
  const isInternalUpdate = useRef(false);

  // Sync external value → editor
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current && !htmlMode) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value, htmlMode]);

  // When switching to HTML mode
  useEffect(() => {
    if (htmlMode) {
      setHtmlSource(value || "");
    } else if (editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
  }, [htmlMode]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    const html = editorRef.current.innerHTML;
    const sanitized = sanitizeHTML(html);
    onChange(sanitized);
  }, [onChange]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  };

  const handleInsertLink = () => {
    const url = prompt("Digite a URL do link:");
    if (url) exec("createLink", url);
  };

  const handleInsertImage = () => {
    const url = prompt("Digite a URL da imagem:");
    if (url) exec("insertHTML", `<img src="${url}" alt="" style="max-width:100%;height:auto;" />`);
  };

  const handleClearFormatting = () => {
    exec("removeFormat");
    // Also remove block-level formatting
    exec("formatBlock", "p");
  };

  const toggleHtmlMode = () => {
    if (htmlMode) {
      // Switching back to visual
      const sanitized = sanitizeHTML(htmlSource);
      onChange(sanitized);
    }
    setHtmlMode(!htmlMode);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) {
      const clean = sanitizeHTML(html);
      document.execCommand("insertHTML", false, clean);
    } else {
      document.execCommand("insertText", false, text);
    }
    emitChange();
  };

  const charCount = (value || "").replace(/<[^>]*>/g, "").length;

  return (
    <div className="border border-input rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-muted/50 border-b border-input overflow-x-auto">
        <ToolbarButton icon={<Bold className="h-4 w-4" />} title="Negrito" onClick={() => exec("bold")} />
        <ToolbarButton icon={<Italic className="h-4 w-4" />} title="Itálico" onClick={() => exec("italic")} />
        <ToolbarButton icon={<Underline className="h-4 w-4" />} title="Sublinhado" onClick={() => exec("underline")} />
        <ToolbarButton icon={<Strikethrough className="h-4 w-4" />} title="Riscado" onClick={() => exec("strikeThrough")} />

        <ToolbarSep />

        <ToolbarButton icon={<Heading2 className="h-4 w-4" />} title="Título H2" onClick={() => exec("formatBlock", "h2")} />
        <ToolbarButton icon={<Heading3 className="h-4 w-4" />} title="Título H3" onClick={() => exec("formatBlock", "h3")} />

        <ToolbarSep />

        <ToolbarButton icon={<List className="h-4 w-4" />} title="Lista com marcadores" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton icon={<ListOrdered className="h-4 w-4" />} title="Lista numerada" onClick={() => exec("insertOrderedList")} />

        <ToolbarSep />

        <ToolbarButton icon={<Link className="h-4 w-4" />} title="Inserir link" onClick={handleInsertLink} />
        <ToolbarButton icon={<Image className="h-4 w-4" />} title="Inserir imagem" onClick={handleInsertImage} />

        <ToolbarSep />

        <ToolbarButton icon={<RemoveFormatting className="h-4 w-4" />} title="Limpar formatação" onClick={handleClearFormatting} />
        <ToolbarButton
          icon={<Code className="h-4 w-4" />}
          title="Modo HTML"
          onClick={toggleHtmlMode}
          active={htmlMode}
        />
      </div>

      {/* Editor / HTML Source */}
      {htmlMode ? (
        <textarea
          className="w-full min-h-[160px] max-h-[300px] p-3 text-sm font-mono bg-background text-foreground outline-none resize-y"
          value={htmlSource}
          onChange={(e) => setHtmlSource(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={cn(
            "w-full min-h-[160px] max-h-[300px] overflow-y-auto p-3 text-sm leading-relaxed outline-none",
            "prose prose-sm max-w-none",
            "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1",
            "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_a]:text-primary [&_a]:underline",
            "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
          )}
          data-placeholder={placeholder || "Descreva seu produto..."}
          onInput={emitChange}
          onPaste={handlePaste}
        />
      )}

      {/* Char count */}
      {maxLength && (
        <div className="px-3 py-1 text-xs text-muted-foreground text-right border-t border-input">
          {charCount}/{maxLength} caracteres
        </div>
      )}
    </div>
  );
}
