require("dotenv").config();
const { ethers } = require("ethers");

const ABI = [
  "function addAuditRecordsBatch((address actor, bytes32 promptHash, bytes32 responseHash, bytes32 reasoningHash)[] records) external",
  "function getRecordCount() view returns (uint256)"
];

function hashText(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

function buildDemoRecord(actor, index) {
  const ts = new Date().toISOString();
  const prompt = `Demo prompt #${index} @ ${ts}`;
  const response = `Demo response #${index}`;
  const reasoning = `Demo reasoning summary #${index}`;

  return {
    actor,
    promptHash: hashText(prompt),
    responseHash: hashText(response),
    reasoningHash: hashText(reasoning)
  };
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const contractAddress = process.env.AUDIT_CONTRACT_ADDRESS;
  const backendPk = process.env.BACKEND_PRIVATE_KEY;

  if (!rpcUrl || !contractAddress || !backendPk) {
    throw new Error("Missing required env vars: SEPOLIA_RPC_URL, AUDIT_CONTRACT_ADDRESS, BACKEND_PRIVATE_KEY");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(backendPk, provider);
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Wrong network chainId=${network.chainId}. Expected 11155111 (Sepolia).`);
  }

  const countArg = process.argv[2] ? Number(process.argv[2]) : 3;
  const count = Number.isFinite(countArg) && countArg > 0 ? Math.min(countArg, 20) : 3;

  const actor = wallet.address;
  const batch = [];
  for (let i = 1; i <= count; i++) {
    batch.push(buildDemoRecord(actor, i));
  }

  console.log("Seeder wallet:", wallet.address);
  console.log("Contract:", contractAddress);
  console.log("Network chainId:", network.chainId.toString());
  console.log("Seeding records:", batch.length);

  const tx = await contract.addAuditRecordsBatch(batch);
  console.log("Seed tx:", tx.hash);
  await tx.wait();

  const total = await contract.getRecordCount();
  console.log("New record count:", total.toString());
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
