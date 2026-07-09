// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

/// @title ClaimRegistry — minimal FHIR QA MIS anchor (claim + preauthorization)
/// @notice Stores only fields present in the standard institutional bundle profile.
///         Organization.name, Patient demographics, diagnosis, attachments stay off-chain.
contract ClaimRegistry {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
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

    enum Status {
        UNKNOWN,
        APPROVED,
        REJECTED,
        DECLINE,
        SENT_BACK,
        SENT_FOR_PAYMENT_PROCESSING,
        MEDICAL_REVIEW
    }

    /// @dev Aligned to QA MIS bundle: Bundle, Organization, Coverage, Patient, Claim
    struct Claim {
        bytes32 claimIdHash;           // Claim.identifier
        uint256 claimNumber;           // assigned at anchor
        bytes32 bundleIdHash;          // Bundle.id
        bytes32 bundleContentHash;       // keccak256(canonical bundle JSON)
        bytes32 recordUseHash;           // hash(Claim.use) claim | preauthorization
        bytes32 fidHash;                 // Organization.id (FID)
        bytes32 facilityLevelHash;       // Organization facility-level extension
        bytes32 schemeCodeHash;          // Coverage schemeCategoryCode
        bytes32 crIdHash;                // Patient.id (Afyaangu CR)
        bytes32 nationalIdHash;          // Patient.identifier nationalid (hashed)
        bytes32 claimTypeHash;           // Claim.type e.g. institutional
        bytes32 interventionCodeHash;    // Claim.item productOrService code
        uint64 creationDate;             // Claim.created
        uint64 dateFrom;                 // Claim.billablePeriod.start
        uint64 dateTo;                   // Claim.billablePeriod.end
        uint256 claimedTotal;            // Claim.total
        bool ipsClaim;                   // Claim.subType ip
        Status status;
    }

    mapping(uint256 => Claim) private claims;
    mapping(uint256 => bool) private claimExists;
    mapping(bytes32 => uint256) private claimIdToNumber;
    mapping(bytes32 => bool) private claimIdMapped;

    event ClaimUpserted(
        uint256 indexed claimNumber,
        bytes32 indexed claimIdHash,
        Status status,
        bytes32 recordUseHash
    );
    event ClaimStatusUpdated(uint256 indexed claimNumber, Status oldStatus, Status newStatus);

    function _h(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    function _upsertClaim(Claim calldata c) internal {
        require(c.claimNumber != 0, "claimNumber=0");
        require(c.claimIdHash != bytes32(0), "claimIdHash=0");
        require(c.bundleContentHash != bytes32(0), "bundleContentHash=0");

        if (claimIdMapped[c.claimIdHash]) {
            uint256 existing = claimIdToNumber[c.claimIdHash];
            require(existing == c.claimNumber, "claimId mapped to other");
        }

        claims[c.claimNumber] = c;
        claimExists[c.claimNumber] = true;
        claimIdMapped[c.claimIdHash] = true;
        claimIdToNumber[c.claimIdHash] = c.claimNumber;

        emit ClaimUpserted(c.claimNumber, c.claimIdHash, c.status, c.recordUseHash);
    }

    function upsertClaim(Claim calldata c) external onlyOwner {
        _upsertClaim(c);
    }

    function setClaimStatus(uint256 claimNumber, Status newStatus) external onlyOwner {
        require(claimExists[claimNumber], "Claim not found");
        Status oldStatus = claims[claimNumber].status;
        if (oldStatus == newStatus) return;
        claims[claimNumber].status = newStatus;
        emit ClaimStatusUpdated(claimNumber, oldStatus, newStatus);
    }

    function setClaimStatusByClaimIdHash(bytes32 claimIdHash, Status newStatus) external onlyOwner {
        require(claimIdMapped[claimIdHash], "ClaimId not found");
        uint256 claimNumber = claimIdToNumber[claimIdHash];
        require(claimExists[claimNumber], "Claim not found");
        Status oldStatus = claims[claimNumber].status;
        if (oldStatus == newStatus) return;
        claims[claimNumber].status = newStatus;
        emit ClaimStatusUpdated(claimNumber, oldStatus, newStatus);
    }

    function getClaim(uint256 claimNumber) external view onlyOwner returns (Claim memory) {
        require(claimExists[claimNumber], "Claim not found");
        return claims[claimNumber];
    }

    function getClaimByClaimIdHash(bytes32 claimIdHash) external view onlyOwner returns (Claim memory) {
        require(claimIdMapped[claimIdHash], "ClaimId not found");
        return claims[claimIdToNumber[claimIdHash]];
    }

    function existsClaim(uint256 claimNumber) external view onlyOwner returns (bool) {
        return claimExists[claimNumber];
    }

    function hashString(string calldata s) external pure returns (bytes32) {
        return _h(s);
    }
}
