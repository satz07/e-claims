// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

interface IProviderRegistry {
    function isProviderAuthorized(bytes32 providerIdHash, uint64 atTime) external view returns (bool);
}
