export type Block =
  | { type: "heading"; text: string }
  | { type: "para"; text: string }
  | { type: "list"; items: string[] };

const BULLET = /^\s*(?:[•·▪◦●‣–]|[-*])\s+/;
const KNOWN_HEADINGS =
  /(Responsibilities|Requirements|Qualifications|Preferred Qualifications|Minimum Qualifications|Basic Qualifications|Benefits|What You'll Do|What You Will Do|What You'll Bring|What We Offer|Who You Are|About (?:Us|the Role|the Team|the Company|You)|Skills|Duties|Compensation|Nice to Have)\s*:/gi;

function isHeading(line: string): boolean {
  if (line.length > 60 || BULLET.test(line)) return false;
  if (/:$/.test(line)) return true;
  return line.length >= 4 && /[A-Z]/.test(line) && line === line.toUpperCase() && !/[.!?]$/.test(line);
}

/** Turn a plain-text job description into headings, paragraphs and bullet lists. */
export function formatDescription(text: string): Block[] {
  if (!text?.trim()) return [];
  const normalized = text
    .replace(/\r\n?/g, "\n")
    // Inline bullets ("... • item • item") onto their own lines.
    .replace(/\s+([•·▪◦●‣])\s+/g, "\n$1 ")
    // Run-in known headings ("...team. Requirements: ...") onto their own lines.
    .replace(KNOWN_HEADINGS, (m, _h, offset: number, s: string) => (offset > 0 && s[offset - 1] !== "\n" ? `\n${m}\n` : `${m}\n`))
    .replace(/[ \t]+\n/g, "\n");

  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: "para", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const raw of normalized.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (BULLET.test(line)) {
      flushPara();
      const item = line.replace(BULLET, "").trim();
      if (item) list.push(item);
    } else if (isHeading(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "heading", text: line.replace(/:$/, "") });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
