import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ResumeProfile } from "@/lib/ai/profile";

const s = StyleSheet.create({
  page: { paddingVertical: 36, paddingHorizontal: 44, fontSize: 10, fontFamily: "Helvetica", color: "#18181b", lineHeight: 1.35 },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 10, color: "#52525b", marginTop: 2 },
  h2: {
    fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, color: "#3f3f46",
    marginTop: 14, marginBottom: 6, paddingBottom: 2, borderBottomWidth: 0.75, borderBottomColor: "#a1a1aa",
  },
  role: { marginBottom: 8 },
  roleHead: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#52525b" },
  bullet: { flexDirection: "row", marginTop: 2, paddingLeft: 6 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
});

export function ResumeDocument({ profile }: { profile: ResumeProfile }) {
  const sub = [profile.targetTitles[0], profile.locations[0]].filter(Boolean).join(" · ");
  return (
    <Document title={profile.name ? `${profile.name} - Resume` : "Resume"} author={profile.name || undefined}>
      <Page size="LETTER" style={s.page}>
        {profile.name ? <Text style={s.name}>{profile.name}</Text> : null}
        {sub ? <Text style={s.sub}>{sub}</Text> : null}

        {profile.summary ? (
          <>
            <Text style={s.h2}>Summary</Text>
            <Text>{profile.summary}</Text>
          </>
        ) : null}

        {profile.experience.length > 0 ? (
          <>
            <Text style={s.h2}>Experience</Text>
            {profile.experience.map((e, i) => (
              <View key={i} style={s.role} wrap={e.highlights.length > 6}>
                <View style={s.roleHead}>
                  <Text>
                    <Text style={s.bold}>{e.title}</Text>
                    {e.company ? `, ${e.company}` : ""}
                  </Text>
                  <Text style={s.muted}>{[e.startDate, e.endDate].filter(Boolean).join(" – ")}</Text>
                </View>
                {e.location ? <Text style={s.muted}>{e.location}</Text> : null}
                {e.highlights.filter((h) => h.trim()).map((h, j) => (
                  <View key={j} style={s.bullet}>
                    <Text style={s.dot}>•</Text>
                    <Text style={s.bulletText}>{h}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {profile.projects.length > 0 ? (
          <>
            <Text style={s.h2}>Projects</Text>
            {profile.projects.map((p, i) => (
              <View key={i} style={s.role} wrap={p.highlights.length > 6}>
                <View style={s.roleHead}>
                  <Text>
                    <Text style={s.bold}>{p.name}</Text>
                    {p.url ? <Text style={s.muted}>{`  ${p.url.replace(/^https?:\/\//, "")}`}</Text> : null}
                  </Text>
                  <Text style={s.muted}>{[p.startDate, p.endDate].filter(Boolean).join(" – ")}</Text>
                </View>
                {p.tech.filter(Boolean).length > 0 ? <Text style={s.muted}>{p.tech.filter(Boolean).join(" · ")}</Text> : null}
                {p.highlights.filter((h) => h.trim()).map((h, j) => (
                  <View key={j} style={s.bullet}>
                    <Text style={s.dot}>•</Text>
                    <Text style={s.bulletText}>{h}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {profile.skills.length > 0 ? (
          <>
            <Text style={s.h2}>Skills</Text>
            <Text>{profile.skills.join(" · ")}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}

export function renderResumePdf(profile: ResumeProfile): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument profile={profile} />);
}

/** A safe download name like "Jane-Doe-Resume.pdf". */
export function pdfFilename(name: string): string {
  const base = name.replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-");
  return `${base ? `${base}-` : ""}Resume.pdf`;
}
