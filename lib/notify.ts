// Slack notifications via incoming webhook. Deliberately tiny: one env var,
// no SDK, never throws — a failed notification must never fail the caller.
export async function notifySlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[notify] SLACK_WEBHOOK_URL not set — skipping:", text);
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("[notify] Slack post failed", e);
  }
}
