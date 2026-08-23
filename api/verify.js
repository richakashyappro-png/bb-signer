export default async function handler(req, res) {
  const allowedOrigin = "https://richakashyappro-png.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address, signature, message } = req.body || {};

  if (!address || !signature) {
    return res.status(400).json({
      error: "Missing address or signature"
    });
  }

  // BountyBook's contract is {address, signature}. The SIWE `message` is forwarded
  // when present (harmless if unused upstream).
  const payload = message
    ? { address, signature, message }
    : { address, signature };

  try {
    const response = await fetch(
      "https://api.bountybook.ai/auth/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const body = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    res.send(body);
  } catch (error) {
    return res.status(502).json({
      error: "Verify upstream request failed"
    });
  }
}
