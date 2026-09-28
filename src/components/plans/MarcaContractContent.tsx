import { Fragment, ReactNode } from "react";

/**
 * Safe renderer for contract markdown. Never uses innerHTML: every line becomes
 * React text nodes, so any HTML/script in the content is shown as plain text.
 * Supports: #/##/### headings, "- " lists, blank-line paragraphs and **bold**.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function MarcaContractContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push(<p key={blocks.length} className="text-sm leading-relaxed text-foreground">{inline(para.join(" "))}</p>);
      para = [];
    }
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc pl-5 space-y-1 text-sm text-foreground">
          {list.map((l, i) => <li key={i}>{inline(l)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of (content ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line) { flush(); continue; }
    if (h) {
      flush();
      const cls = h[1].length === 1 ? "text-lg font-semibold" : "text-base font-semibold";
      blocks.push(<h3 key={blocks.length} className={`${cls} text-foreground mt-2`}>{inline(h[2])}</h3>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) { if (para.length) flush(); list.push(line.replace(/^[-*]\s+/, "")); continue; }
    if (list.length) flush();
    para.push(line);
  }
  flush();
  return <div className="space-y-3">{blocks}</div>;
}
