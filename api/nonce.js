export default async function handler(req, res) {
  const allowedOrigin = "https://richakashyappro-png.github.io";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = req.query.address;

  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  try {
    const response = await fetch(
      "https://api.bountybook.ai/auth/nonce?address=" +
        encodeURIComponent(address)
    );

    const body = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    res.send(body);
  } catch (error) {
    return res.status(502).json({
      error: "Nonce upstream request failed"
    });
  }
}
