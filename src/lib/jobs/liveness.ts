const EXPIRED_PATTERNS = [
  /no longer accepting applications/i,
  /job (has )?expired/i,
  /(job|posting|position) is no longer available/i,
  /position has been filled/i,
  /job (posting )?(is |has been )?closed/i,
  /this job is no longer/i,
];

const MAX_BODY = 200_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/**
 * True only when we can confirm the listing is gone (404/410 or an "expired" page).
 * Bot blocks, timeouts and network errors return false: we never drop a job we couldn't verify.
 */
export async function isListingDead(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": UA, accept: "text/html" },
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 410) return true;
    if (!res.ok) return false;
    const body = (await res.text()).slice(0, MAX_BODY);
    return EXPIRED_PATTERNS.some((re) => re.test(body));
  } catch {
    return false;
  }
}
