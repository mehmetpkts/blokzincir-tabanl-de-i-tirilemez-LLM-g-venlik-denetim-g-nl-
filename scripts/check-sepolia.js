require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!rpcUrl) {
    throw new Error("SEPOLIA_RPC_URL is missing in .env");
  }
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY is missing in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);

  if (network.chainId !== 11155111n) {
    throw new Error(
      `SEPOLIA_RPC_URL points to wrong network: chainId=${network.chainId}. Expected 11155111 (Sepolia).`
    );
  }

  console.log("Network:", `${network.name} (chainId=${network.chainId})`);
  console.log("Deployer:", wallet.address);
  console.log("Balance (ETH):", ethers.formatEther(balance));

  if (balance === 0n) {
    console.log("WARNING: Deployer balance is 0. Fund this wallet before deployment.");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
