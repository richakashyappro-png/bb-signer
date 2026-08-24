import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The ONLY job this guard allows submission for
const ALLOWED_JOB_ID = "1063de95-75f4-4170-8879-f5b1b683bb9b";
const EXPECTED_FILE = "avl.py";
const MIN_LENGTH = 1000;

function loadAuthoritativeSolution() {
  // Read solution.js from the deployed static files at the project root
  const solPath = join(__dirname, "..", "solution.js");
  const raw = readFileSync(solPath, "utf-8");
  const match = raw.match(/const SOLUTION_CODE = (.*);/s);
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

  // === SERVER-SIDE SUBMISSION SAFETY GATE ===
  console.log(`[GUARD] JOB ID: ${id}`);

  if (id !== ALLOWED_JOB_ID) {
    console.log(`[GUARD] RESULT: BLOCKED — job ${id} is not the allowed job`);
    return res.status(409).json({
      error: "Server guard: this deployment only accepts submissions for job " + ALLOWED_JOB_ID,
      guardResult: "BLOCKED_WRONG_JOB"
    });
  }

  let authoritativeSolution;
  try {
    authoritativeSolution = loadAuthoritativeSolution();
  } catch (e) {
    console.log(`[GUARD] RESULT: BLOCKED — cannot load solution.js: ${e.message}`);
    return res.status(500).json({
      error: "Server guard: cannot load authoritative solution — " + e.message,
      guardResult: "BLOCKED_LOAD_FAIL"
    });
  }

  console.log(`[GUARD] SERVER SOLUTION LENGTH: ${authoritativeSolution.length}`);
  console.log(`[GUARD] EXPECTED FILE: ${EXPECTED_FILE}`);

  const validation = validateSolution(authoritativeSolution);
  if (!validation.ok) {
    console.log(`[GUARD] RESULT: BLOCKED — ${validation.reason}`);
    return res.status(409).json({
      error: "Server guard: solution failed validation — " + validation.reason,
      guardResult: "BLOCKED_INVALID_SOLUTION",
      serverSolutionLength: authoritativeSolution.length
    });
  }

  // Force the body to use OUR verified solution regardless of what the client sent
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const executorAddress = req.body?.executorAddress;
  if (!executorAddress || typeof executorAddress !== "string") {
    return res.status(400).json({ error: "Missing executorAddress in request body" });
  }

  const forwardBody = {
    executorAddress: executorAddress,
    outputData: {
      files: {
        [EXPECTED_FILE]: authoritativeSolution
      }
    }
  };

  console.log(`[GUARD] RESULT: PASS — forwarding to BountyBook with server-verified solution (${authoritativeSolution.length} bytes)`);

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
    return res.status(502).json({
      error: "Submit upstream request failed"
    });
  }
}
