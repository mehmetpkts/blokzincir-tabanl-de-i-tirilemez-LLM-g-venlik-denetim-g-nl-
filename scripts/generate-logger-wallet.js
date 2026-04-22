const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");

const envPath = path.join(process.cwd(), ".env");

function replaceOrAppend(content, key, value) {
  const linePattern = new RegExp(`^${key}=.*$`, "m");
  const newLine = `${key}=${value}`;
  if (linePattern.test(content)) {
    return content.replace(linePattern, newLine);
  }
  return `${content.trimEnd()}\n${newLine}\n`;
}

function main() {
  const wallet = Wallet.createRandom();
  const current = fs.readFileSync(envPath, "utf8");

  let updated = current;
  updated = replaceOrAppend(updated, "BACKEND_PRIVATE_KEY", wallet.privateKey);
  updated = replaceOrAppend(updated, "LOGGER_ADDRESS", wallet.address);

  fs.writeFileSync(envPath, updated, "utf8");

  console.log("NewLoggerAddress:", wallet.address);
  console.log("Updated .env fields: BACKEND_PRIVATE_KEY, LOGGER_ADDRESS");
}

main();
