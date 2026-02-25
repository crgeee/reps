const PUSHOVER_API = "https://api.pushover.net/1/messages.json";

export async function send(title: string, message: string): Promise<void> {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!userKey || !apiToken) {
    console.log(`[notify fallback] ${title}: ${message}`);
    return;
  }

  try {
    const res = await fetch(PUSHOVER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: apiToken,
        user: userKey,
        title,
        message,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[notify] Pushover error ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("[notify] Failed to send Pushover notification:", err);
  }
}
