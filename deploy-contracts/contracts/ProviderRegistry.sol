// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

/// @title ProviderRegistry — authorized healthcare providers, licenses, and tiers
contract ProviderRegistry {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // -------------------------
    // Types
    // -------------------------
    enum ProviderStatus {
        REGISTERED,
        DEREGISTERED,
        SUSPENDED,
        EXPIRED
    }

    struct Provider {
        bytes32 providerIdHash;
        bytes32 nameHash;
        bytes32 levelHash;
        bytes32 countyHash;
        bytes32 facilityTypeHash;
        uint64 licenseValidFrom;
        uint64 licenseValidTo;
        ProviderStatus status;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    struct LicenseHistoryEntry {
        uint64 validFrom;
        uint64 validTo;
        uint64 recordedAt;
    }

    struct TierHistoryEntry {
        bytes32 levelHash;
        uint64 recordedAt;
    }

    struct StatusHistoryEntry {
        ProviderStatus status;
        uint64 recordedAt;
    }

    mapping(bytes32 => Provider) private providers;
    mapping(bytes32 => bool) private providerExists;

    mapping(bytes32 => LicenseHistoryEntry[]) private licenseHistory;
    mapping(bytes32 => TierHistoryEntry[]) private tierHistory;
    mapping(bytes32 => StatusHistoryEntry[]) private statusHistory;

    // -------------------------
    // Events
    // -------------------------
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event ProviderRegistered(
        bytes32 indexed providerIdHash,
        bytes32 nameHash,
        bytes32 levelHash,
        uint64 licenseValidFrom,
        uint64 licenseValidTo
    );

    event ProviderDeregistered(bytes32 indexed providerIdHash, uint64 recordedAt);

    event ProviderSuspended(bytes32 indexed providerIdHash, uint64 recordedAt);
    event ProviderReactivated(bytes32 indexed providerIdHash, uint64 recordedAt);

    event ProviderLicenseUpdated(
        bytes32 indexed providerIdHash,
        uint64 validFrom,
        uint64 validTo,
        uint64 recordedAt
    );

    event ProviderTierChanged(
        bytes32 indexed providerIdHash,
        bytes32 oldLevelHash,
        bytes32 newLevelHash,
        uint64 recordedAt
    );

    event ProviderExpiredFlagged(bytes32 indexed providerIdHash, uint64 recordedAt);

    event ProviderStatusChanged(
        bytes32 indexed providerIdHash,
        ProviderStatus oldStatus,
        ProviderStatus newStatus,
        uint64 recordedAt
    );

    // -------------------------
    // Constructor / ownership
    // -------------------------
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------
    // Registration / de-registration
    // -------------------------
    function registerProvider(
        bytes32 providerIdHash,
        bytes32 nameHash,
        bytes32 levelHash,
        bytes32 countyHash,
        bytes32 facilityTypeHash,
        uint64 licenseValidFrom,
        uint64 licenseValidTo
    ) external onlyOwner {
        require(providerIdHash != bytes32(0), "providerIdHash=0");
        require(licenseValidTo >= licenseValidFrom, "Invalid license period");

        uint64 now_ = uint64(block.timestamp);
        bool isNew = !providerExists[providerIdHash];

        if (isNew) {
            providers[providerIdHash] = Provider({
                providerIdHash: providerIdHash,
                nameHash: nameHash,
                levelHash: levelHash,
                countyHash: countyHash,
                facilityTypeHash: facilityTypeHash,
                licenseValidFrom: licenseValidFrom,
                licenseValidTo: licenseValidTo,
                status: ProviderStatus.REGISTERED,
                registeredAt: now_,
                updatedAt: now_
            });
            providerExists[providerIdHash] = true;
            _pushStatus(providerIdHash, ProviderStatus.REGISTERED, now_);
            _pushLicense(providerIdHash, licenseValidFrom, licenseValidTo, now_);
            _pushTier(providerIdHash, levelHash, now_);
            emit ProviderRegistered(
                providerIdHash,
                nameHash,
                levelHash,
                licenseValidFrom,
                licenseValidTo
            );
        } else {
            Provider storage p = providers[providerIdHash];
            require(
                p.status == ProviderStatus.DEREGISTERED || p.status == ProviderStatus.EXPIRED,
                "Already active"
            );
            ProviderStatus oldStatus = p.status;
            p.nameHash = nameHash;
            p.levelHash = levelHash;
            p.countyHash = countyHash;
            p.facilityTypeHash = facilityTypeHash;
            p.licenseValidFrom = licenseValidFrom;
            p.licenseValidTo = licenseValidTo;
            p.status = ProviderStatus.REGISTERED;
            p.updatedAt = now_;
            _pushStatus(providerIdHash, ProviderStatus.REGISTERED, now_);
            _pushLicense(providerIdHash, licenseValidFrom, licenseValidTo, now_);
            _pushTier(providerIdHash, levelHash, now_);
            emit ProviderStatusChanged(providerIdHash, oldStatus, ProviderStatus.REGISTERED, now_);
            emit ProviderRegistered(
                providerIdHash,
                nameHash,
                levelHash,
                licenseValidFrom,
                licenseValidTo
            );
        }
    }

    function deregisterProvider(bytes32 providerIdHash) external onlyOwner {
        require(providerExists[providerIdHash], "Provider not found");
        Provider storage p = providers[providerIdHash];
        ProviderStatus oldStatus = p.status;
        require(oldStatus != ProviderStatus.DEREGISTERED, "Already deregistered");

        uint64 now_ = uint64(block.timestamp);
        p.status = ProviderStatus.DEREGISTERED;
        p.updatedAt = now_;
        _pushStatus(providerIdHash, ProviderStatus.DEREGISTERED, now_);
        emit ProviderStatusChanged(providerIdHash, oldStatus, ProviderStatus.DEREGISTERED, now_);
        emit ProviderDeregistered(providerIdHash, now_);
    }

    function suspendProvider(bytes32 providerIdHash) external onlyOwner {
        require(providerExists[providerIdHash], "Provider not found");
        Provider storage p = providers[providerIdHash];
        require(p.status == ProviderStatus.REGISTERED, "Not registered");

        uint64 now_ = uint64(block.timestamp);
        ProviderStatus oldStatus = p.status;
        p.status = ProviderStatus.SUSPENDED;
        p.updatedAt = now_;
        _pushStatus(providerIdHash, ProviderStatus.SUSPENDED, now_);
        emit ProviderStatusChanged(providerIdHash, oldStatus, ProviderStatus.SUSPENDED, now_);
        emit ProviderSuspended(providerIdHash, now_);
    }

    function reactivateProvider(bytes32 providerIdHash) external onlyOwner {
        require(providerExists[providerIdHash], "Provider not found");
        Provider storage p = providers[providerIdHash];
        require(p.status == ProviderStatus.SUSPENDED, "Not suspended");

        uint64 now_ = uint64(block.timestamp);
        ProviderStatus oldStatus = p.status;
        p.status = ProviderStatus.REGISTERED;
        p.updatedAt = now_;
        _pushStatus(providerIdHash, ProviderStatus.REGISTERED, now_);
        emit ProviderStatusChanged(providerIdHash, oldStatus, ProviderStatus.REGISTERED, now_);
        emit ProviderReactivated(providerIdHash, now_);
    }

    // -------------------------
    // License management
    // -------------------------
    function updateLicense(
        bytes32 providerIdHash,
        uint64 licenseValidFrom,
        uint64 licenseValidTo
    ) external onlyOwner {
        require(providerExists[providerIdHash], "Provider not found");
        require(licenseValidTo >= licenseValidFrom, "Invalid license period");

        Provider storage p = providers[providerIdHash];
        uint64 now_ = uint64(block.timestamp);
        p.licenseValidFrom = licenseValidFrom;
        p.licenseValidTo = licenseValidTo;
        p.updatedAt = now_;

        if (p.status == ProviderStatus.EXPIRED && licenseValidTo >= now_) {
            ProviderStatus oldStatus = p.status;
            p.status = ProviderStatus.REGISTERED;
            emit ProviderStatusChanged(providerIdHash, oldStatus, ProviderStatus.REGISTERED, now_);
        }

        _pushLicense(providerIdHash, licenseValidFrom, licenseValidTo, now_);
        emit ProviderLicenseUpdated(providerIdHash, licenseValidFrom, licenseValidTo, now_);
    }

    /// @notice Flags provider as EXPIRED when licenseValidTo is in the past
    function flagExpiredIfNeeded(bytes32 providerIdHash) external {
        require(providerExists[providerIdHash], "Provider not found");
        Provider storage p = providers[providerIdHash];
        if (p.status != ProviderStatus.REGISTERED) return;
        if (block.timestamp <= p.licenseValidTo) return;

        uint64 now_ = uint64(block.timestamp);
        ProviderStatus oldStatus = p.status;
        p.status = ProviderStatus.EXPIRED;
        p.updatedAt = now_;
        _pushStatus(providerIdHash, ProviderStatus.EXPIRED, now_);
        emit ProviderStatusChanged(providerIdHash, oldStatus, ProviderStatus.EXPIRED, now_);
        emit ProviderExpiredFlagged(providerIdHash, now_);
    }

    // -------------------------
    // Tier management
    // -------------------------
    function setProviderTier(bytes32 providerIdHash, bytes32 newLevelHash) external onlyOwner {
        require(providerExists[providerIdHash], "Provider not found");
        require(newLevelHash != bytes32(0), "levelHash=0");

        Provider storage p = providers[providerIdHash];
        bytes32 oldLevel = p.levelHash;
        if (oldLevel == newLevelHash) return;

        uint64 now_ = uint64(block.timestamp);
        p.levelHash = newLevelHash;
        p.updatedAt = now_;
        _pushTier(providerIdHash, newLevelHash, now_);
        emit ProviderTierChanged(providerIdHash, oldLevel, newLevelHash, now_);
    }

    // -------------------------
    // Validation (for ClaimRegistry integration)
    // -------------------------
    function isProviderAuthorized(bytes32 providerIdHash, uint64 atTime) external view returns (bool) {
        if (!providerExists[providerIdHash]) return false;
        Provider storage p = providers[providerIdHash];
        if (p.status != ProviderStatus.REGISTERED) return false;
        if (atTime < p.licenseValidFrom || atTime > p.licenseValidTo) return false;
        return true;
    }

    // -------------------------
    // Reads
    // -------------------------
    function getProvider(bytes32 providerIdHash) external view returns (Provider memory) {
        require(providerExists[providerIdHash], "Provider not found");
        return providers[providerIdHash];
    }

    function existsProvider(bytes32 providerIdHash) external view returns (bool) {
        return providerExists[providerIdHash];
    }

    function getLicenseHistory(bytes32 providerIdHash) external view returns (LicenseHistoryEntry[] memory) {
        require(providerExists[providerIdHash], "Provider not found");
        return licenseHistory[providerIdHash];
    }

    function getTierHistory(bytes32 providerIdHash) external view returns (TierHistoryEntry[] memory) {
        require(providerExists[providerIdHash], "Provider not found");
        return tierHistory[providerIdHash];
    }

    function getStatusHistory(bytes32 providerIdHash) external view returns (StatusHistoryEntry[] memory) {
        require(providerExists[providerIdHash], "Provider not found");
        return statusHistory[providerIdHash];
    }

    function hashString(string calldata s) external pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    // -------------------------
    // Internal history helpers
    // -------------------------
    function _pushLicense(
        bytes32 providerIdHash,
        uint64 validFrom,
        uint64 validTo,
        uint64 recordedAt
    ) internal {
        licenseHistory[providerIdHash].push(
            LicenseHistoryEntry({validFrom: validFrom, validTo: validTo, recordedAt: recordedAt})
        );
    }

    function _pushTier(bytes32 providerIdHash, bytes32 levelHash, uint64 recordedAt) internal {
        tierHistory[providerIdHash].push(TierHistoryEntry({levelHash: levelHash, recordedAt: recordedAt}));
    }

    function _pushStatus(bytes32 providerIdHash, ProviderStatus status, uint64 recordedAt) internal {
        statusHistory[providerIdHash].push(StatusHistoryEntry({status: status, recordedAt: recordedAt}));
    }
}
