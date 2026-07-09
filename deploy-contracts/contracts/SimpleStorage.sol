// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SimpleStorage {
    uint256 public favoriteNumber;
    string public message;

    event FavoriteNumberUpdated(uint256 newFavoriteNumber);
    event MessageUpdated(string newMessage);

    constructor(uint256 _favoriteNumber, string memory _message) {
        favoriteNumber = _favoriteNumber;
        message = _message;
    }

    function setFavoriteNumber(uint256 _favoriteNumber) external {
        favoriteNumber = _favoriteNumber;
        emit FavoriteNumberUpdated(_favoriteNumber);
    }

    function setMessage(string calldata _message) external {
        message = _message;
        emit MessageUpdated(_message);
    }
}
