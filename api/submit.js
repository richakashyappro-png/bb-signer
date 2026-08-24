import { readFileSync } from "fs";
import { join } from "path";

// The ONLY job this guard allows submission for
const ALLOWED_JOB_ID = "1063de95-75f4-4170-8879-f5b1b683bb9b";
const EXPECTED_FILE = "avl.py";
const MIN_LENGTH = 1000;

function loadAuthoritativeSolution() {
  // Vercel serverless functions: static files are at the project root relative to cwd
  const solPath = join(process.cwd(), "solution.js");
  const raw = readFileSync(solPath, "utf-8");
  const match = raw.match(/const SOLUTION_CODE = ([\s\S]*);/);
  if (!match) throw new Error("solution.js missing SOLUTION_CODE variable");
  return JSON.parse(match[1]);
}

function validateSolution(sol) {
  if (!sol || typeof sol !== "string") return { ok: false, reason: "solution is missing or not a string" };
  if (sol.trim().length < MIN_LENGTH) return { ok: false, reason: `solution too small: ${sol.trim().length} chars (min ${MIN_LENGTH})` };
  if (!sol.includes("All tests passed")) return { ok: false, reason: "missing 'All tests passed' marker" };
  if (!sol.includes("class Node")) return { ok: false, reason: "missing AVL class Node" };
  if (!sol.includes("def insert")) return { ok: false, reason: "missing def insert" };
  if (!sol.includes("def inorder")) return { ok: false, reason: "missing def inorder" };
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
    console.log(`[GUARD] RESULT: BLOCKED_WRONG_JOB`);
    return res.status(409).json({
      error: "Server guard: only job " + ALLOWED_JOB_ID + " can be submitted from this deployment",
      guardResult: "BLOCKED_WRONG_JOB"
    });
  }

  let authoritativeSolution;
  try {
    authoritativeSolution = loadAuthoritativeSolution();
  } catch (e) {
    console.log(`[GUARD] RESULT: BLOCKED_LOAD_FAIL — ${e.message}`);
    return res.status(500).json({
      error: "Server guard: cannot load solution — " + e.message,
      guardResult: "BLOCKED_LOAD_FAIL"
    });
  }

  console.log(`[GUARD] SERVER SOLUTION LENGTH: ${authoritativeSolution.length}`);

  const validation = validateSolution(authoritativeSolution);
  if (!validation.ok) {
    console.log(`[GUARD] RESULT: BLOCKED_INVALID_SOLUTION — ${validation.reason}`);
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

  // Force-replace client payload with server-verified solution
  const forwardBody = {
    executorAddress: executorAddress,
    outputData: {
      files: { [EXPECTED_FILE]: authoritativeSolution }
    }
  };

  console.log(`[GUARD] RESULT: PASS — forwarding with ${authoritativeSolution.length} byte server solution`);

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
