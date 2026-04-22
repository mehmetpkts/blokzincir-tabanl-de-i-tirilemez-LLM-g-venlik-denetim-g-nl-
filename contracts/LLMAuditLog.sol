// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title LLMAuditLog
/// @notice Immutable-style on-chain log for LLM audit records using hashed fields only.
contract LLMAuditLog is AccessControl {
    bytes32 public constant LOGGER_ROLE = keccak256("LOGGER_ROLE");

    error ZeroAddress();
    error EmptyHash();
    error RecordNotFound();
    error EmptyBatch();

    struct AuditRecordInput {
        address actor;
        bytes32 promptHash;
        bytes32 responseHash;
        bytes32 reasoningHash;
    }

    struct AuditRecord {
        address actor;
        bytes32 promptHash;
        bytes32 responseHash;
        bytes32 reasoningHash;
        uint256 timestamp;
    }

    AuditRecord[] private _records;

    /// @notice Emitted whenever a new audit record is appended.
    event AuditRecordAdded(
        uint256 indexed recordId,
        address indexed actor,
        bytes32 indexed promptHash,
        bytes32 responseHash,
        bytes32 reasoningHash,
        uint256 timestamp,
        address logger
    );

    constructor(address initialLogger) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (initialLogger != address(0)) {
            _grantRole(LOGGER_ROLE, initialLogger);
        }
    }

    function _validateRecord(
        address actor,
        bytes32 promptHash,
        bytes32 responseHash,
        bytes32 reasoningHash
    ) internal pure {
        if (actor == address(0)) revert ZeroAddress();
        if (promptHash == bytes32(0)) revert EmptyHash();
        if (responseHash == bytes32(0)) revert EmptyHash();
        if (reasoningHash == bytes32(0)) revert EmptyHash();
    }

    /// @notice Grants write permission to a backend service wallet.
    function authorizeLogger(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        _grantRole(LOGGER_ROLE, account);
    }

    /// @notice Revokes write permission from a backend service wallet.
    function revokeLogger(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(LOGGER_ROLE, account);
    }

    /// @notice Appends a new hashed audit record. Only authorized backend wallets can call this.
    function addAuditRecord(
        address actor,
        bytes32 promptHash,
        bytes32 responseHash,
        bytes32 reasoningHash
    ) external onlyRole(LOGGER_ROLE) {
        _validateRecord(actor, promptHash, responseHash, reasoningHash);

        AuditRecord memory newRecord = AuditRecord({
            actor: actor,
            promptHash: promptHash,
            responseHash: responseHash,
            reasoningHash: reasoningHash,
            timestamp: block.timestamp
        });

        _records.push(newRecord);
        uint256 recordId = _records.length - 1;

        emit AuditRecordAdded(
            recordId,
            actor,
            promptHash,
            responseHash,
            reasoningHash,
            newRecord.timestamp,
            msg.sender
        );
    }

    /// @notice Appends multiple hashed audit records in a single transaction.
    function addAuditRecordsBatch(AuditRecordInput[] calldata records) external onlyRole(LOGGER_ROLE) {
        uint256 count = records.length;
        if (count == 0) revert EmptyBatch();

        for (uint256 i = 0; i < count; ++i) {
            AuditRecordInput calldata inputRecord = records[i];
            _validateRecord(
                inputRecord.actor,
                inputRecord.promptHash,
                inputRecord.responseHash,
                inputRecord.reasoningHash
            );

            AuditRecord memory newRecord = AuditRecord({
                actor: inputRecord.actor,
                promptHash: inputRecord.promptHash,
                responseHash: inputRecord.responseHash,
                reasoningHash: inputRecord.reasoningHash,
                timestamp: block.timestamp
            });

            _records.push(newRecord);
            uint256 recordId = _records.length - 1;

            emit AuditRecordAdded(
                recordId,
                inputRecord.actor,
                inputRecord.promptHash,
                inputRecord.responseHash,
                inputRecord.reasoningHash,
                newRecord.timestamp,
                msg.sender
            );
        }
    }

    /// @notice Returns total number of records stored on-chain.
    function getRecordCount() external view returns (uint256) {
        return _records.length;
    }

    /// @notice Returns a single record by id. Anyone can read.
    function getRecord(uint256 recordId) external view returns (AuditRecord memory) {
        if (recordId >= _records.length) revert RecordNotFound();
        return _records[recordId];
    }

    /// @notice Returns a page of records using offset and limit. Anyone can read.
    function getRecords(uint256 offset, uint256 limit) external view returns (AuditRecord[] memory) {
        uint256 total = _records.length;
        if (offset >= total) {
            return new AuditRecord[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        AuditRecord[] memory page = new AuditRecord[](size);

        for (uint256 i = 0; i < size; ++i) {
            page[i] = _records[offset + i];
        }

        return page;
    }
}
