import { Fragment } from "react";

/** Renders the consent form text: "## " lines are headings, "- " lines are bullets, [[blanks]] are highlighted until filled in. */
export function ConsentText({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);
  const inline = (t: string) =>
    t.split(/(\[\[[^\]]*\]\])/g).map((part, i) =>
      /^\[\[/.test(part) ? <mark key={i} className="rounded bg-amber-200 px-1 text-amber-950">{part}</mark> : <Fragment key={i}>{part}</Fragment>);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        return (
          <div key={i}>
            {lines.map((l, j) =>
              l.startsWith("## ") ? <h3 key={j} className="mt-2 text-base font-semibold">{l.slice(3)}</h3>
                : l.startsWith("- ") ? <li key={j} className="ml-5 list-disc">{inline(l.slice(2))}</li>
                  : <p key={j}>{inline(l)}</p>)}
          </div>
        );
      })}
    </div>
  );
}
