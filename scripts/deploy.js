const hre = require("hardhat");

async function main() {
    const networkName = hre.network.name;

    if (networkName === "sepolia") {
        if (!process.env.SEPOLIA_RPC_URL) {
            throw new Error("SEPOLIA_RPC_URL is missing in environment variables.");
        }

        if (!process.env.DEPLOYER_PRIVATE_KEY) {
            throw new Error("DEPLOYER_PRIVATE_KEY is missing in environment variables.");
        }
    }

    const [deployer] = await hre.ethers.getSigners();
    const network = await hre.ethers.provider.getNetwork();

    if (networkName === "sepolia" && network.chainId !== 11155111n) {
        throw new Error(
            `Wrong chain for sepolia deployment: chainId=${network.chainId}. Expected 11155111.`
        );
    }

    const initialLogger = process.env.LOGGER_ADDRESS || deployer.address;
    if (!hre.ethers.isAddress(initialLogger)) {
        throw new Error("LOGGER_ADDRESS is not a valid EVM address.");
    }

    console.log("Network:", networkName);
    console.log("ChainId:", network.chainId.toString());
    console.log("Deploying LLMAuditLog with account:", deployer.address);
    console.log("Initial logger address:", initialLogger);

    const LLMAuditLog = await hre.ethers.getContractFactory("LLMAuditLog");
    const auditLog = await LLMAuditLog.deploy(initialLogger);
    await auditLog.waitForDeployment();

    console.log("LLMAuditLog deployed to:", await auditLog.getAddress());
    console.log("Constructor args:", JSON.stringify([initialLogger]));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
