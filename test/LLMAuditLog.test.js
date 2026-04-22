const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("LLMAuditLog", function () {
  async function deployFixture() {
    const [admin, logger, attacker, actor] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LLMAuditLog");
    const contract = await Factory.deploy(logger.address);
    await contract.waitForDeployment();
    return { contract, admin, logger, attacker, actor };
  }

  it("grants initial logger role in constructor", async function () {
    const { contract, logger } = await deployFixture();
    const LOGGER_ROLE = await contract.LOGGER_ROLE();
    expect(await contract.hasRole(LOGGER_ROLE, logger.address)).to.equal(true);
  });

  it("allows only logger to add records", async function () {
    const { contract, logger, attacker, actor } = await deployFixture();

    const promptHash = ethers.keccak256(ethers.toUtf8Bytes("prompt"));
    const responseHash = ethers.keccak256(ethers.toUtf8Bytes("response"));
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes("reasoning"));

    await expect(
      contract
        .connect(attacker)
        .addAuditRecord(actor.address, promptHash, responseHash, reasoningHash)
    ).to.be.reverted;

    await expect(
      contract
        .connect(logger)
        .addAuditRecord(actor.address, promptHash, responseHash, reasoningHash)
    )
      .to.emit(contract, "AuditRecordAdded")
      .withArgs(
        0,
        actor.address,
        promptHash,
        responseHash,
        reasoningHash,
        anyValue,
        logger.address
      );
  });

  it("adds multiple records in batch and emits events", async function () {
    const { contract, logger, actor } = await deployFixture();

    const records = [
      {
        actor: actor.address,
        promptHash: ethers.keccak256(ethers.toUtf8Bytes("p1")),
        responseHash: ethers.keccak256(ethers.toUtf8Bytes("r1")),
        reasoningHash: ethers.keccak256(ethers.toUtf8Bytes("c1"))
      },
      {
        actor: actor.address,
        promptHash: ethers.keccak256(ethers.toUtf8Bytes("p2")),
        responseHash: ethers.keccak256(ethers.toUtf8Bytes("r2")),
        reasoningHash: ethers.keccak256(ethers.toUtf8Bytes("c2"))
      }
    ];

    await expect(contract.connect(logger).addAuditRecordsBatch(records))
      .to.emit(contract, "AuditRecordAdded")
      .withArgs(
        0,
        actor.address,
        records[0].promptHash,
        records[0].responseHash,
        records[0].reasoningHash,
        anyValue,
        logger.address
      );

    expect(await contract.getRecordCount()).to.equal(2n);
  });

  it("returns stored records and count", async function () {
    const { contract, logger, actor } = await deployFixture();

    const promptHash = ethers.keccak256(ethers.toUtf8Bytes("p1"));
    const responseHash = ethers.keccak256(ethers.toUtf8Bytes("r1"));
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes("c1"));

    await contract
      .connect(logger)
      .addAuditRecord(actor.address, promptHash, responseHash, reasoningHash);

    expect(await contract.getRecordCount()).to.equal(1n);

    const record = await contract.getRecord(0);
    expect(record.actor).to.equal(actor.address);
    expect(record.promptHash).to.equal(promptHash);
    expect(record.responseHash).to.equal(responseHash);
    expect(record.reasoningHash).to.equal(reasoningHash);
  });

  it("returns paginated records", async function () {
    const { contract, logger, actor } = await deployFixture();

    const mk = (v) => ethers.keccak256(ethers.toUtf8Bytes(v));
    await contract.connect(logger).addAuditRecordsBatch([
      { actor: actor.address, promptHash: mk("p1"), responseHash: mk("r1"), reasoningHash: mk("c1") },
      { actor: actor.address, promptHash: mk("p2"), responseHash: mk("r2"), reasoningHash: mk("c2") },
      { actor: actor.address, promptHash: mk("p3"), responseHash: mk("r3"), reasoningHash: mk("c3") }
    ]);

    const page = await contract.getRecords(1, 2);
    expect(page.length).to.equal(2);
    expect(page[0].promptHash).to.equal(mk("p2"));
    expect(page[1].promptHash).to.equal(mk("p3"));

    const emptyPage = await contract.getRecords(100, 10);
    expect(emptyPage.length).to.equal(0);
  });

  it("reverts with custom errors on invalid input", async function () {
    const { contract, logger, actor } = await deployFixture();

    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));

    await expect(contract.getRecord(0)).to.be.revertedWithCustomError(
      contract,
      "RecordNotFound"
    );

    await expect(
      contract.connect(logger).addAuditRecordsBatch([])
    ).to.be.revertedWithCustomError(contract, "EmptyBatch");

    await expect(
      contract
        .connect(logger)
        .addAuditRecord(ethers.ZeroAddress, hash, hash, hash)
    ).to.be.revertedWithCustomError(contract, "ZeroAddress");
  });
});
