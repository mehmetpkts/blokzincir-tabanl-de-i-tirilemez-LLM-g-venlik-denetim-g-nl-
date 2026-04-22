require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.LOCALHOST_RPC_URL;
const CONTRACT_ADDRESS = process.env.AUDIT_CONTRACT_ADDRESS;
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;
const EVENT_BUFFER_SIZE = 100;
const sseClients = new Set();
const recentEvents = [];

const ABI = [
  "function addAuditRecord(address actor, bytes32 promptHash, bytes32 responseHash, bytes32 reasoningHash) external",
  "function addAuditRecordsBatch((address actor, bytes32 promptHash, bytes32 responseHash, bytes32 reasoningHash)[] records) external",
  "function getRecordCount() view returns (uint256)",
  "function getRecords(uint256 offset, uint256 limit) view returns (tuple(address actor, bytes32 promptHash, bytes32 responseHash, bytes32 reasoningHash, uint256 timestamp)[])",
  "event AuditRecordAdded(uint256 indexed recordId, address indexed actor, bytes32 indexed promptHash, bytes32 responseHash, bytes32 reasoningHash, uint256 timestamp, address logger)"
];

const readProvider = RPC_URL ? new ethers.JsonRpcProvider(RPC_URL) : null;
const readContract =
  readProvider && CONTRACT_ADDRESS && ethers.isAddress(CONTRACT_ADDRESS)
    ? new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider)
    : null;

function toEventPayload(recordId, actor, promptHash, responseHash, reasoningHash, timestamp, logger, event) {
  return {
    recordId: recordId.toString(),
    actor,
    promptHash,
    responseHash,
    reasoningHash,
    timestamp: timestamp.toString(),
    logger,
    txHash: event && event.log ? event.log.transactionHash : null,
    blockNumber: event && event.log ? event.log.blockNumber : null,
    observedAt: new Date().toISOString()
  };
}

function pushEvent(payload) {
  recentEvents.unshift(payload);
  if (recentEvents.length > EVENT_BUFFER_SIZE) {
    recentEvents.pop();
  }
}

function broadcastEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

async function getRecordSnapshot(maxRecords = EVENT_BUFFER_SIZE) {
  if (!readContract) {
    return [];
  }

  const total = await readContract.getRecordCount();
  const cap = BigInt(maxRecords);
  const start = total > cap ? total - cap : 0n;
  const size = total - start;

  if (size === 0n) {
    return [];
  }

  const pageSize = 50n;
  const items = [];
  let offset = start;
  while (offset < total) {
    const remaining = total - offset;
    const limit = remaining > pageSize ? pageSize : remaining;
    const page = await readContract.getRecords(offset, limit);

    for (let i = 0; i < page.length; i++) {
      const recordId = (offset + BigInt(i)).toString();
      const record = page[i];
      items.push({
        recordId,
        actor: record.actor,
        promptHash: record.promptHash,
        responseHash: record.responseHash,
        reasoningHash: record.reasoningHash,
        timestamp: record.timestamp.toString(),
        logger: null,
        txHash: null,
        blockNumber: null,
        observedAt: null
      });
    }

    offset += limit;
  }

  items.sort((a, b) => Number(b.recordId) - Number(a.recordId));
  return items;
}

async function warmRecentEvents() {
  if (!readContract || !readProvider) {
    return;
  }

  const latest = await readProvider.getBlockNumber();
  const fromBlock = latest > 400 ? latest - 400 : 0;
  const chunkSize = 10;

  for (let end = latest; end >= fromBlock; end -= chunkSize) {
    const start = end - chunkSize + 1 > fromBlock ? end - chunkSize + 1 : fromBlock;
    const events = await readContract.queryFilter(readContract.filters.AuditRecordAdded(), start, end);

    for (let i = events.length - 1; i >= 0; i--) {
      const evt = events[i];
      const payload = toEventPayload(...evt.args, evt);
      pushEvent(payload);
      if (recentEvents.length >= EVENT_BUFFER_SIZE) {
        return;
      }
    }
  }
}

function startEventSubscription() {
  if (!readContract) {
    console.warn("Event subscription disabled: missing valid RPC or contract address.");
    return;
  }

  readContract.on("AuditRecordAdded", (...args) => {
    const event = args[args.length - 1];
    const payload = toEventPayload(...args.slice(0, 7), event);
    pushEvent(payload);
    broadcastEvent(payload);
  });
}

function hashText(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

function requireApiKey(req, res, next) {
  if (!BACKEND_API_KEY) {
    return next();
  }

  const key = req.header("x-api-key");
  if (key !== BACKEND_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return next();
}

function buildClient() {
  if (!RPC_URL) {
    throw new Error("RPC URL is missing. Set SEPOLIA_RPC_URL or LOCALHOST_RPC_URL.");
  }
  if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
    throw new Error("AUDIT_CONTRACT_ADDRESS is missing or invalid.");
  }
  if (!BACKEND_PRIVATE_KEY) {
    throw new Error("BACKEND_PRIVATE_KEY is missing.");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  return { contract, wallet };
}

app.get("/health", async (req, res) => {
  try {
    const { wallet } = buildClient();
    const recordCount = readContract ? await readContract.getRecordCount() : 0n;
    res.json({ ok: true, wallet: wallet.address, contract: CONTRACT_ADDRESS, recordCount: recordCount.toString() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/events/recent", async (req, res) => {
  if (!readContract) {
    return res.json({ ok: true, count: recentEvents.length, items: recentEvents });
  }

  try {
    const snapshot = await getRecordSnapshot(500);
    const merged = new Map();

    for (const item of snapshot) {
      merged.set(item.recordId, item);
    }

    // Prefer live event metadata (logger/txHash/blockNumber) when available.
    for (const item of recentEvents) {
      merged.set(item.recordId, item);
    }

    const items = Array.from(merged.values()).sort((a, b) => Number(b.recordId) - Number(a.recordId));
    return res.json({ ok: true, count: items.length, items });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/events/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "connected", at: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

app.post("/audit-log", requireApiKey, async (req, res) => {
  try {
    const { actor, prompt, response, reasoning } = req.body;

    if (!actor || !ethers.isAddress(actor)) {
      return res.status(400).json({ error: "actor must be a valid address" });
    }
    if (!prompt || !response || !reasoning) {
      return res.status(400).json({ error: "prompt, response, reasoning are required" });
    }

    const promptHash = hashText(prompt);
    const responseHash = hashText(response);
    const reasoningHash = hashText(reasoning);

    const { contract } = buildClient();
    const tx = await contract.addAuditRecord(actor, promptHash, responseHash, reasoningHash);
    const receipt = await tx.wait();

    res.json({
      ok: true,
      txHash: receipt.hash,
      promptHash,
      responseHash,
      reasoningHash
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/audit-log/batch", requireApiKey, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const records = items.map((item) => {
      if (!item.actor || !ethers.isAddress(item.actor)) {
        throw new Error("Each item.actor must be a valid address");
      }
      if (!item.prompt || !item.response || !item.reasoning) {
        throw new Error("Each item must include prompt, response, reasoning");
      }

      return {
        actor: item.actor,
        promptHash: hashText(item.prompt),
        responseHash: hashText(item.response),
        reasoningHash: hashText(item.reasoning)
      };
    });

    const { contract } = buildClient();
    const tx = await contract.addAuditRecordsBatch(records);
    const receipt = await tx.wait();

    res.json({ ok: true, txHash: receipt.hash, count: records.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

async function bootstrap() {
  try {
    await warmRecentEvents();
    startEventSubscription();
  } catch (error) {
    console.warn("Event bootstrap warning:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`LLMAudit backend service running on :${PORT}`);
    console.log(`Dashboard URL: http://localhost:${PORT}/dashboard.html`);
  });
}

bootstrap();
