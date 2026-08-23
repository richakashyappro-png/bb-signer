export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: "Missing or invalid job id" });
  }

  try {
    const response = await fetch(
      "https://api.bountybook.ai/jobs/" + encodeURIComponent(id)
    );

    const body = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    res.send(body);
  } catch (error) {
    return res.status(502).json({
      error: "Job upstream request failed"
    });
  }
}
