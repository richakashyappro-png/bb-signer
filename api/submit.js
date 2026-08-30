import { readFileSync } from "fs";
import { join } from "path";

const ALLOWED_JOB_ID = "a55bd7d2-b6a0-4bfc-80b5-f788d0ff312d";
const EXPECTED_FILE = "event_emitter.ts";
const MIN_LENGTH = 500;

function loadAuthoritativeSolution() {
  // Vercel serverless: __dirname is /var/task/api/, project root is one level up
  const solPath = join(__dirname, "..", EXPECTED_FILE);
  const raw = readFileSync(solPath, "utf-8");
  return raw;
}

function validateSolution(sol) {
  if (!sol || typeof sol !== "string") return { ok: false, reason: "solution is missing or not a string" };
  if (sol.trim().length < MIN_LENGTH) return { ok: false, reason: `solution too small: ${sol.trim().length} chars (min ${MIN_LENGTH})` };
  if (!sol.includes("class TypedEmitter")) return { ok: false, reason: "missing TypedEmitter class" };
  if (!sol.includes("on<K")) return { ok: false, reason: "missing on method" };
  if (!sol.includes("off<K")) return { ok: false, reason: "missing off method" };
  if (!sol.includes("once<K")) return { ok: false, reason: "missing once method" };
  if (!sol.includes("emit<K")) return { ok: false, reason: "missing emit method" };
  if (!sol.includes("listenerCount<K")) return { ok: false, reason: "missing listenerCount method" };
  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: "Missing or invalid job id" });
  }

  console.log(`[GUARD] JOB ID: ${id}`);

  if (id !== ALLOWED_JOB_ID) {
    console.log(`[GUARD] BLOCKED_WRONG_JOB`);
    return res.status(409).json({
      error: "Server guard: only job " + ALLOWED_JOB_ID + " can be submitted from this deployment",
      guardResult: "BLOCKED_WRONG_JOB"
    });
  }

  let authoritativeSolution;
  try {
    authoritativeSolution = loadAuthoritativeSolution();
  } catch (e) {
    console.log(`[GUARD] BLOCKED_LOAD_FAIL — ${e.message}`);
    return res.status(500).json({
      error: "Server guard: cannot load solution — " + e.message,
      guardResult: "BLOCKED_LOAD_FAIL"
    });
  }

  console.log(`[GUARD] SERVER SOLUTION LENGTH: ${authoritativeSolution.length}`);

  const validation = validateSolution(authoritativeSolution);
  if (!validation.ok) {
    console.log(`[GUARD] BLOCKED_INVALID_SOLUTION — ${validation.reason}`);
    return res.status(409).json({
      error: "Server guard: solution failed validation — " + validation.reason,
      guardResult: "BLOCKED_INVALID_SOLUTION",
      serverSolutionLength: authoritativeSolution.length
    });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const executorAddress = req.body?.executorAddress;
  if (!executorAddress || typeof executorAddress !== "string") {
    return res.status(400).json({ error: "Missing executorAddress" });
  }

  const forwardBody = {
    executorAddress: executorAddress,
    outputData: {
      files: { [EXPECTED_FILE]: authoritativeSolution }
    }
  };

  console.log(`[GUARD] PASS — forwarding with ${authoritativeSolution.length} byte server solution`);

  try {
    const response = await fetch(
      "https://api.bountybook.ai/jobs/" + encodeURIComponent(id) + "/submit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": auth
        },
        body: JSON.stringify(forwardBody)
      }
    );

    const body = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    res.send(body);
  } catch (error) {
    return res.status(502).json({ error: "Submit upstream request failed" });
  }
}
