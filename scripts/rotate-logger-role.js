require("dotenv").config();
const { ethers } = require("ethers");

const ABI = [
  "function LOGGER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function authorizeLogger(address account)",
  "function revokeLogger(address account)"
];

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const contractAddress = process.env.AUDIT_CONTRACT_ADDRESS;
  const deployerPk = process.env.DEPLOYER_PRIVATE_KEY;
  const backendPk = process.env.BACKEND_PRIVATE_KEY;

  if (!rpcUrl || !contractAddress || !deployerPk || !backendPk) {
    throw new Error("Missing required env vars: SEPOLIA_RPC_URL, AUDIT_CONTRACT_ADDRESS, DEPLOYER_PRIVATE_KEY, BACKEND_PRIVATE_KEY");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(deployerPk, provider);
  const loggerWallet = new ethers.Wallet(backendPk, provider);
  const contract = new ethers.Contract(contractAddress, ABI, deployer);

  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Wrong network chainId=${network.chainId}. Expected 11155111.`);
  }

  const deployerAddress = await deployer.getAddress();
  const loggerAddress = await loggerWallet.getAddress();

  console.log("Deployer:", deployerAddress);
  console.log("New logger:", loggerAddress);

  const loggerRole = await contract.LOGGER_ROLE();

  const loggerHasRole = await contract.hasRole(loggerRole, loggerAddress);
  if (!loggerHasRole) {
    const grantTx = await contract.authorizeLogger(loggerAddress);
    await grantTx.wait();
    console.log("Granted LOGGER_ROLE tx:", grantTx.hash);
  } else {
    console.log("Logger already has LOGGER_ROLE");
  }

  if (loggerAddress.toLowerCase() !== deployerAddress.toLowerCase()) {
    const deployerHasRole = await contract.hasRole(loggerRole, deployerAddress);
    if (deployerHasRole) {
      const revokeTx = await contract.revokeLogger(deployerAddress);
      await revokeTx.wait();
      console.log("Revoked deployer LOGGER_ROLE tx:", revokeTx.hash);
    } else {
      console.log("Deployer LOGGER_ROLE already revoked");
    }
  }

  const loggerBalance = await provider.getBalance(loggerAddress);
  if (loggerBalance < ethers.parseEther("0.003")) {
    const fundTx = await deployer.sendTransaction({
      to: loggerAddress,
      value: ethers.parseEther("0.01")
    });
    await fundTx.wait();
    console.log("Funded logger wallet tx:", fundTx.hash);
  } else {
    console.log("Logger wallet balance is sufficient:", ethers.formatEther(loggerBalance));
  }

  const deployerStillLogger = await contract.hasRole(loggerRole, deployerAddress);
  const loggerNowLogger = await contract.hasRole(loggerRole, loggerAddress);

  console.log("Final roles -> deployer:", deployerStillLogger, "logger:", loggerNowLogger);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
