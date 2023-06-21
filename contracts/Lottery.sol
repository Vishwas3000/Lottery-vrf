// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8.17;

error Lottery__NotEnoughStake(uint256 _minStake);

contract Lottery is Ownable {
    uint256 public i_minStake;
    address[] public s_players;
    uint256 private s_eventStartedAt;
    uint256 private s_eventDuration;

    constructor(uint256 _minStake) {
        i_minStake = _minStake;
    }

    function stake() public payable {
        if (msg.value < i_minStake) revert Lottery__NotEnoughStake(i_minStake);
        s_players.push(msg.sender);
    }

    function startEvent() private onlyOwner {
        s_eventStartedAt = block.timestamp;
    }

    function endEvent() private onlyOwner {
        s_players = new address[](0);
    }

    function selectWinner() private {}
}
