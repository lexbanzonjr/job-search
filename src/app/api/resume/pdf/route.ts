import { pdfFilename, renderResumePdf } from "@/lib/resume/pdf";
import { getLatestResume } from "@/lib/resume/store";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Download the current resume profile as a PDF. */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const resume = await getLatestResume(user.id);
  if (!resume?.profile) return Response.json({ error: "Upload a resume first." }, { status: 400 });
  const pdf = await renderResumePdf(resume.profile);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(resume.profile.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
