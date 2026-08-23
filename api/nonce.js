export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = req.query.address;

  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  const response = await fetch(
    "https://api.bountybook.ai/auth/nonce?address=" +
    encodeURIComponent(address)
  );

  const body = await response.text();

  res.status(response.status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.send(body);
}
