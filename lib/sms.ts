/**
 * SMS provider adapters for phone OTP.
 *
 * With no SMS_API_KEY configured, messages are NOT sent and the OTP is
 * returned in the API response in non-production so you can test phone login.
 */
export type SmsResult = { sent: boolean; devCode?: string };

function normaliseBd(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `880${digits}`;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_PROVIDER && process.env.SMS_PROVIDER !== "none");
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;
  const apiKey = process.env.SMS_API_KEY;

  if (!provider || provider === "none" || !apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[sms] No SMS provider configured — OTP was generated but not delivered. Set SMS_PROVIDER/SMS_API_KEY."
      );
    }
    return { sent: false };
  }

  const to = normaliseBd(phone);

  try {
    if (provider === "sslwireless") {
      // SSL Wireless (Bangladesh) — bulk SMS
      const res = await fetch(process.env.SMS_API_URL || "https://smsplus.sslwireless.com/api/v3/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: apiKey,
          sid: process.env.SMS_SENDER_ID,
          msisdn: to,
          sms: message,
          csms_id: `BA${Date.now()}`,
        }),
        cache: "no-store",
      });
      return { sent: res.ok };
    }

    if (provider === "bulksmsbd") {
      const params = new URLSearchParams({
        api_key: apiKey,
        type: "text",
        number: to,
        senderid: process.env.SMS_SENDER_ID ?? "",
        message,
      });
      const res = await fetch(`${process.env.SMS_API_URL || "https://bulksmsbd.net/api/smsapi"}?${params}`, {
        cache: "no-store",
      });
      return { sent: res.ok };
    }

    // Generic JSON webhook provider
    const res = await fetch(process.env.SMS_API_URL ?? "", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to, message, sender: process.env.SMS_SENDER_ID }),
      cache: "no-store",
    });
    return { sent: res.ok };
  } catch (error) {
    console.error("[sms] send failed", error);
    return { sent: false };
  }
}
