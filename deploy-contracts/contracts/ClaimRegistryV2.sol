// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "./IProviderRegistry.sol";

/// @title ClaimRegistryV2 — ClaimRegistry with ProviderRegistry validation on submit
contract ClaimRegistryV2 {    address public owner;
    IProviderRegistry public providerRegistry;

    modifier onlyOwner() {        require(msg.sender == owner, "Not owner");
        _;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setProviderRegistry(address registry) external onlyOwner {
        emit ProviderRegistryUpdated(address(providerRegistry), registry);
        providerRegistry = IProviderRegistry(registry);
    }

    function _requireAuthorizedProvider(bytes32 providerIdHash, uint64 atTime) internal view {
        require(address(providerRegistry) != address(0), "ProviderRegistry not set");
        require(providerRegistry.isProviderAuthorized(providerIdHash, atTime), "Provider not authorized");
    }
    enum Status {
        UNKNOWN,
        APPROVED,
        REJECTED,
        DECLINE,
        SENT_BACK,
        SENT_FOR_PAYMENT_PROCESSING,
        MEDICAL_REVIEW
    }

    enum SurveillanceStatus {
        NONE,
        SENT_TO_SURVEILLANCE
    }

    function _h(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    // -------------------------
    // Claims
    // -------------------------
    struct Claim {
        bytes32 claimIdHash;
        uint256 claimNumber;
        bytes32 claimTypeHash;

        bytes32 providerNameHash;
        bytes32 providerLevelHash;
        bytes32 patientNameHash;

        bytes32 accessCodeHash;
        bytes32 bundleIdHash;
        bytes32 crIdHash;
        bytes32 externalIdHash;
        bytes32 shaCodeHash;
        bytes32 shaPackageCodeHash;
        bytes32 claimCodeHash;

        uint64 creationDate;
        uint64 dateFrom;
        uint64 dateTo;
        uint64 dateProcessed;

        uint256 claimedTotal;
        uint256 approvedTotal;
        uint256 adjustment;

        bool hasApprovedTotal;
        bool hasAdjustment;
        bool hasDateProcessed;
        bool auditFlag;
        bool ipsClaim;

        bytes32 nationalIdHash;
        bytes32 guaranteeIdHash;
        bytes32 explanationHash;
        bytes32 rejectionReasonHash;

        Status status;
        SurveillanceStatus surveillanceStatus;

        bytes32 colourCodeHash;
        uint256 count;
    }

    mapping(uint256 => Claim) private claims;
    mapping(uint256 => bool) private claimExists;

    mapping(bytes32 => uint256) private claimIdToNumber;
    mapping(bytes32 => bool) private claimIdMapped;

    // -------------------------
    // Patients
    // -------------------------
    struct Patient {
        bytes32 idHash;
        bytes32 nameHash;
        bytes32 genderHash;
        uint64 birthDate;

        bytes32 nationalIdHash;
        bytes32 phoneNumberHash;
        bytes32 addressLineHash;
        bytes32 cityHash;
        bytes32 districtHash;
        bytes32 countyHash;
        bytes32 stateHash;
        bytes32 countryHash;
        bytes32 householdNumberHash;

        bytes32 crIdHash; // key
        bytes32 shaNumberHash;

        uint64 policyStartDate;
        uint64 policyEndDate;
    }

    mapping(bytes32 => Patient) private patients;
    mapping(bytes32 => bool) private patientExists;

    // -------------------------
    // Events
    // -------------------------
    event ClaimUpserted(uint256 indexed claimNumber, bytes32 indexed claimIdHash, Status status, bytes32 claimTypeHash);
    event ClaimProviderValidated(
        uint256 indexed claimNumber,
        bytes32 indexed providerIdHash,
        bool authorized
    );
    event ClaimProviderValidationFailed(
        bytes32 indexed claimIdHash,
        bytes32 indexed providerIdHash,
        uint64 atTime
    );
    event ProviderRegistryUpdated(address indexed previous, address indexed next);    event ClaimStatusUpdated(uint256 indexed claimNumber, Status oldStatus, Status newStatus);
    event ClaimPatientNameUpdated(uint256 indexed claimNumber, bytes32 newPatientNameHash);
    event ClaimClaimedTotalUpdated(uint256 indexed claimNumber, uint256 oldClaimedTotal, uint256 newClaimedTotal);

    event PatientUpserted(bytes32 indexed crIdHash);
    event PatientNameUpdated(bytes32 indexed crIdHash, bytes32 newNameHash);

    // -------------------------
    // Claims: write
    // -------------------------
    function _upsertClaim(Claim calldata c) internal {
        require(c.claimNumber != 0, "claimNumber=0");
        require(c.claimIdHash != bytes32(0), "claimIdHash=0");

        if (claimIdMapped[c.claimIdHash]) {
            uint256 existing = claimIdToNumber[c.claimIdHash];
            require(existing == c.claimNumber, "claimId mapped to other");
        }

        claims[c.claimNumber] = c;
        claimExists[c.claimNumber] = true;

        claimIdMapped[c.claimIdHash] = true;
        claimIdToNumber[c.claimIdHash] = c.claimNumber;

        emit ClaimUpserted(c.claimNumber, c.claimIdHash, c.status, c.claimTypeHash);
    }

    function upsertClaim(Claim calldata c) external onlyOwner {
        _upsertClaim(c);
    }

    /// @notice Anchor claim after ProviderRegistry authorization check at dateFrom
    /// @param c Claim struct; providerNameHash should hold hash(FID) for traceability
    /// @param providerIdHash Facility ID hash e.g. hash("FID-35-108719-7")
    function upsertClaimWithProviderCheck(Claim calldata c, bytes32 providerIdHash) external onlyOwner {
        require(providerIdHash != bytes32(0), "providerIdHash=0");
        uint64 atTime = c.dateFrom != 0 ? c.dateFrom : c.creationDate;
        if (address(providerRegistry) == address(0)) {
            emit ClaimProviderValidationFailed(c.claimIdHash, providerIdHash, atTime);
            revert("ProviderRegistry not set");
        }
        if (!providerRegistry.isProviderAuthorized(providerIdHash, atTime)) {
            emit ClaimProviderValidationFailed(c.claimIdHash, providerIdHash, atTime);
            revert("Provider not authorized");
        }
        emit ClaimProviderValidated(c.claimNumber, providerIdHash, true);
        _upsertClaim(c);
    }

    function upsertClaims(Claim[] calldata cs) external onlyOwner {        for (uint256 i = 0; i < cs.length; i++) {
            _upsertClaim(cs[i]);
        }
    }

    // -------------------------
    // Claims: targeted updates
    // -------------------------
    function _setClaimStatus(uint256 claimNumber, Status newStatus) internal {
        require(claimExists[claimNumber], "Claim not found");
        Status oldStatus = claims[claimNumber].status;
        if (oldStatus == newStatus) return;
        claims[claimNumber].status = newStatus;
        emit ClaimStatusUpdated(claimNumber, oldStatus, newStatus);
    }

    function setClaimStatus(uint256 claimNumber, Status newStatus) external onlyOwner {
        _setClaimStatus(claimNumber, newStatus);
    }

    function setClaimStatusByClaimIdHash(bytes32 claimIdHash, Status newStatus) external onlyOwner {
        require(claimIdMapped[claimIdHash], "ClaimId not found");
        _setClaimStatus(claimIdToNumber[claimIdHash], newStatus);
    }

    function setClaimPatientNameHash(uint256 claimNumber, bytes32 newPatientNameHash) external onlyOwner {
        require(claimExists[claimNumber], "Claim not found");
        claims[claimNumber].patientNameHash = newPatientNameHash;
        emit ClaimPatientNameUpdated(claimNumber, newPatientNameHash);
    }

    function setClaimedTotal(uint256 claimNumber, uint256 newClaimedTotal) external onlyOwner {
        require(claimExists[claimNumber], "Claim not found");
        uint256 oldVal = claims[claimNumber].claimedTotal;
        if (oldVal == newClaimedTotal) return;
        claims[claimNumber].claimedTotal = newClaimedTotal;
        emit ClaimClaimedTotalUpdated(claimNumber, oldVal, newClaimedTotal);
    }

    // -------------------------
    // Claims: read
    // -------------------------
    function getClaim(uint256 claimNumber) external view onlyOwner returns (Claim memory) {
        require(claimExists[claimNumber], "Claim not found");
        return claims[claimNumber];
    }

    function getClaimByClaimIdHash(bytes32 claimIdHash) external view onlyOwner returns (Claim memory) {
        require(claimIdMapped[claimIdHash], "ClaimId not found");
        uint256 claimNumber = claimIdToNumber[claimIdHash];
        require(claimExists[claimNumber], "Claim not found");
        return claims[claimNumber];
    }

    function existsClaim(uint256 claimNumber) external view onlyOwner returns (bool) {
        return claimExists[claimNumber];
    }

    // -------------------------
    // Patients: write
    // -------------------------
    function _upsertPatient(Patient calldata p) internal {
        require(p.crIdHash != bytes32(0), "crIdHash=0");
        patients[p.crIdHash] = p;
        patientExists[p.crIdHash] = true;
        emit PatientUpserted(p.crIdHash);
    }

    function upsertPatient(Patient calldata p) external onlyOwner {
        _upsertPatient(p);
    }

    function upsertPatients(Patient[] calldata ps) external onlyOwner {
        for (uint256 i = 0; i < ps.length; i++) {
            _upsertPatient(ps[i]);
        }
    }

    function setPatientNameHash(bytes32 crIdHash, bytes32 newNameHash) external onlyOwner {
        require(patientExists[crIdHash], "Patient not found");
        patients[crIdHash].nameHash = newNameHash;
        emit PatientNameUpdated(crIdHash, newNameHash);
    }

    // -------------------------
    // Patients: read
    // -------------------------
    function getPatient(bytes32 crIdHash) external view onlyOwner returns (Patient memory) {
        require(patientExists[crIdHash], "Patient not found");
        return patients[crIdHash];
    }

    function existsPatient(bytes32 crIdHash) external view onlyOwner returns (bool) {
        return patientExists[crIdHash];
    }

    // -------------------------
    // Convenience
    // -------------------------
    function hashString(string calldata s) external pure returns (bytes32) {
        return _h(s);
    }
}