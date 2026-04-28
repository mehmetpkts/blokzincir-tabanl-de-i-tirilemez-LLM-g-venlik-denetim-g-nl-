require("dotenv").config();
const { Wallet } = require("ethers");

const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || "";
const AUDIT_BACKEND_URL = process.env.AUDIT_BACKEND_URL || "http://localhost:3001";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";
const ACTOR_ADDRESS =
  process.env.AUDIT_ACTOR_ADDRESS ||
  (process.env.BACKEND_PRIVATE_KEY ? new Wallet(process.env.BACKEND_PRIVATE_KEY).address : "");

function usage() {
  console.log("Usage:");
  console.log('  npm run chat:lmstudio -- "Mesajinizi buraya yazin"');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function getModelName() {
  if (LMSTUDIO_MODEL) {
    return LMSTUDIO_MODEL;
  }

  const models = await requestJson(`${LMSTUDIO_BASE_URL}/models`);
  const firstModel = models.data && models.data[0] && models.data[0].id;
  if (!firstModel) {
    throw new Error("No LM Studio model found. Load a model in LM Studio first.");
  }

  return firstModel;
}

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!ACTOR_ADDRESS) {
    throw new Error("AUDIT_ACTOR_ADDRESS or BACKEND_PRIVATE_KEY is required.");
  }

  const model = await getModelName();
  const completion = await requestJson(`${LMSTUDIO_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });

  const responseText = completion.choices?.[0]?.message?.content || "";
  if (!responseText) {
    throw new Error("LM Studio returned an empty response.");
  }

  const auditHeaders = { "Content-Type": "application/json" };
  if (BACKEND_API_KEY) {
    auditHeaders["x-api-key"] = BACKEND_API_KEY;
  }

  const audit = await requestJson(`${AUDIT_BACKEND_URL}/audit-log`, {
    method: "POST",
    headers: auditHeaders,
    body: JSON.stringify({
      actor: ACTOR_ADDRESS,
      prompt,
      response: responseText,
      reasoning: `LM Studio local model audit summary. model=${model}`
    })
  });

  console.log(JSON.stringify({
    ok: true,
    model,
    actor: ACTOR_ADDRESS,
    response: responseText,
    audit
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
