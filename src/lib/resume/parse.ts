export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type ResumeKind = "pdf" | "docx" | "text";

export function detectKind(filename: string, mime = ""): ResumeKind | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "docx" || mime.includes("wordprocessingml")) return "docx";
  if (["txt", "md"].includes(ext) || mime.startsWith("text/")) return "text";
  return null;
}

/** Collapse whitespace noise left by PDF/DOCX extraction while keeping paragraph breaks. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractResumeText(buffer: Buffer, filename: string, mime = ""): Promise<string> {
  if (buffer.byteLength > MAX_RESUME_BYTES) throw new Error("Resume is larger than 5 MB");
  const kind = detectKind(filename, mime);
  let text: string;
  switch (kind) {
    case "pdf": {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      text = (await extractText(pdf, { mergePages: true })).text;
      break;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
      break;
    }
    case "text":
      text = buffer.toString("utf8");
      break;
    default:
      throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
  }
  text = cleanText(text);
  if (text.length < 50) throw new Error("Could not read any text from that file. Is it a scanned image?");
  return text;
}
