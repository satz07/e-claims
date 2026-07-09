// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

/// @title VerifiableRegistry — minimal hash-only registry for citizens, clinicians, insurers
/// @dev Stores idHash + optional metaHash + validity window. No PHI on-chain.
contract VerifiableRegistry {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    enum Status {
        REGISTERED,
        DEREGISTERED,
        SUSPENDED,
        EXPIRED
    }

    struct Entry {
        bytes32 idHash;
        bytes32 metaHash;
        uint64 validFrom;
        uint64 validTo;
        Status status;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    mapping(bytes32 => Entry) private entries;
    mapping(bytes32 => bool) private entryExists;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EntryRegistered(
        bytes32 indexed idHash,
        bytes32 metaHash,
        uint64 validFrom,
        uint64 validTo
    );
    event EntrySuspended(bytes32 indexed idHash, uint64 recordedAt);
    event EntryReactivated(bytes32 indexed idHash, uint64 recordedAt);
    event EntryDeregistered(bytes32 indexed idHash, uint64 recordedAt);
    event EntryStatusChanged(
        bytes32 indexed idHash,
        Status oldStatus,
        Status newStatus,
        uint64 recordedAt
    );

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function register(
        bytes32 idHash,
        bytes32 metaHash,
        uint64 validFrom,
        uint64 validTo
    ) external onlyOwner {
        require(idHash != bytes32(0), "idHash=0");
        require(validTo >= validFrom, "Invalid validity period");

        uint64 now_ = uint64(block.timestamp);
        bool isNew = !entryExists[idHash];

        if (isNew) {
            entries[idHash] = Entry({
                idHash: idHash,
                metaHash: metaHash,
                validFrom: validFrom,
                validTo: validTo,
                status: Status.REGISTERED,
                registeredAt: now_,
                updatedAt: now_
            });
            entryExists[idHash] = true;
            emit EntryRegistered(idHash, metaHash, validFrom, validTo);
            emit EntryStatusChanged(idHash, Status.REGISTERED, Status.REGISTERED, now_);
        } else {
            Entry storage e = entries[idHash];
            require(
                e.status == Status.DEREGISTERED || e.status == Status.EXPIRED,
                "Already active"
            );
            Status oldStatus = e.status;
            e.metaHash = metaHash;
            e.validFrom = validFrom;
            e.validTo = validTo;
            e.status = Status.REGISTERED;
            e.updatedAt = now_;
            emit EntryRegistered(idHash, metaHash, validFrom, validTo);
            emit EntryStatusChanged(idHash, oldStatus, Status.REGISTERED, now_);
        }
    }

    function suspend(bytes32 idHash) external onlyOwner {
        require(entryExists[idHash], "Entry not found");
        Entry storage e = entries[idHash];
        require(e.status == Status.REGISTERED, "Not registered");
        uint64 now_ = uint64(block.timestamp);
        Status oldStatus = e.status;
        e.status = Status.SUSPENDED;
        e.updatedAt = now_;
        emit EntryStatusChanged(idHash, oldStatus, Status.SUSPENDED, now_);
        emit EntrySuspended(idHash, now_);
    }

    function reactivate(bytes32 idHash) external onlyOwner {
        require(entryExists[idHash], "Entry not found");
        Entry storage e = entries[idHash];
        require(e.status == Status.SUSPENDED, "Not suspended");
        uint64 now_ = uint64(block.timestamp);
        Status oldStatus = e.status;
        e.status = Status.REGISTERED;
        e.updatedAt = now_;
        emit EntryStatusChanged(idHash, oldStatus, Status.REGISTERED, now_);
        emit EntryReactivated(idHash, now_);
    }

    function deregister(bytes32 idHash) external onlyOwner {
        require(entryExists[idHash], "Entry not found");
        Entry storage e = entries[idHash];
        require(e.status != Status.DEREGISTERED, "Already deregistered");
        uint64 now_ = uint64(block.timestamp);
        Status oldStatus = e.status;
        e.status = Status.DEREGISTERED;
        e.updatedAt = now_;
        emit EntryStatusChanged(idHash, oldStatus, Status.DEREGISTERED, now_);
        emit EntryDeregistered(idHash, now_);
    }

    function isAuthorized(bytes32 idHash, uint64 atTime) external view returns (bool) {
        if (!entryExists[idHash]) return false;
        Entry storage e = entries[idHash];
        if (e.status != Status.REGISTERED) return false;
        if (atTime < e.validFrom || atTime > e.validTo) return false;
        return true;
    }

    function getEntry(bytes32 idHash) external view returns (Entry memory) {
        require(entryExists[idHash], "Entry not found");
        return entries[idHash];
    }

    function existsEntry(bytes32 idHash) external view returns (bool) {
        return entryExists[idHash];
    }
}
