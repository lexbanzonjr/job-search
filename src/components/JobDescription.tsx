import { formatDescription } from "@/lib/jobs/format";

export function JobDescription({ text }: { text: string }) {
  const blocks = formatDescription(text);
  return (
    <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700">
      {blocks.map((b, i) =>
        b.type === "heading" ? (
          <h4 key={i} className="pt-1 font-semibold text-zinc-900">
            {b.text}
          </h4>
        ) : b.type === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}
