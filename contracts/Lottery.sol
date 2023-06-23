// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Lottery__NotEnoughStake(uint256 _minStake);
error Lottery__EventInProgress(uint256 timeRemaining);
error Lottery__StakingNotOpen();
error Lottery__UpKeepNotNeeded(
    uint256 totalStakesForCurrentEvent,
    uint256 playersLength,
    uint8 lotteryState,
    uint256 timeRemaining
);

contract Lottery is Ownable, VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING,
        CLOSED
    }

    event RequestSent(uint256 indexed requestId);
    event WinnerSelected(address indexed winner, uint256 winnerIndex, uint256 amount);
    event PlayerStaked(address indexed player, uint256 amount);
    event WinnerWithdraw(address indexed winner, uint256 amount);

    uint256 public immutable i_minStake;
    address[] public s_players;
    uint256 public s_totalStakesForCurrentEvent;
    uint256 public s_eventDuration;
    uint256 private s_eventStartedAt;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFORMATION = 3;
    uint32 private immutable i_callbackGasLimit = 1000000;
    uint32 private immutable i_numWords = 2;
    bytes32 private immutable i_keyHash;
    LotteryState public s_lotteryState;
    VRFCoordinatorV2Interface public COORDINATOR;

    mapping(address => uint256) public s_winnerProceeds;
    address public s_lastWinner;

    uint256[] public s_randomWords;
    address[] public s_lotteryWinners;
    uint256 public s_lotteryWinnersCount;

    constructor(
        uint256 minStake,
        uint64 subscriptionId,
        address vrfCoordinatorAddress,
        bytes32 keyHash,
        uint256 eventDuration
    ) VRFConsumerBaseV2(vrfCoordinatorAddress) {
        i_minStake = minStake;
        i_subscriptionId = subscriptionId;
        i_keyHash = keyHash;
        s_eventDuration = eventDuration;
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinatorAddress);
        s_totalStakesForCurrentEvent = 0;
        s_lotteryState = LotteryState.CLOSED;
    }

    function stake() public payable {
        if (msg.value < i_minStake) revert Lottery__NotEnoughStake(i_minStake);
        if (s_lotteryState != LotteryState.OPEN) revert Lottery__StakingNotOpen();
        s_players.push(msg.sender);
        s_totalStakesForCurrentEvent += msg.value;
        emit PlayerStaked(msg.sender, msg.value);
    }

    function startLottery() public onlyOwner {
        if (s_players.length > 0) {
            delete s_players;
        }
        if (block.timestamp - s_eventStartedAt <= s_eventDuration) {
            revert Lottery__EventInProgress(block.timestamp - s_eventStartedAt);
        }
        s_eventStartedAt = block.timestamp;
        s_lotteryState = LotteryState.OPEN;
    }

    function endEvent() private onlyOwner {
        delete s_players;
        s_totalStakesForCurrentEvent = 0;
        s_lotteryState = LotteryState.CLOSED;
    }

    function selectWinner() internal {
        s_lotteryState = LotteryState.CALCULATING;
        requestNumber();
    }

    function withdrawProceeds() public {
        emit WinnerWithdraw(msg.sender, s_winnerProceeds[msg.sender]);
        s_winnerProceeds[msg.sender] = 0;
        payable(msg.sender).transfer(s_winnerProceeds[msg.sender]);
    }

    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        s_randomWords = randomWords;
        uint256 winnerIndex = s_randomWords[0] % s_players.length;
        s_winnerProceeds[s_players[winnerIndex]] = s_totalStakesForCurrentEvent;
        s_lastWinner = s_players[winnerIndex];
        emit WinnerSelected(s_lastWinner, s_lotteryWinnersCount, s_winnerProceeds[s_lastWinner]);
        s_lotteryWinners.push(s_lastWinner);
        s_lotteryWinnersCount++;
        endEvent();
    }

    function requestNumber() public returns (uint256 requestId) {
        requestId = COORDINATOR.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFORMATION,
            i_callbackGasLimit,
            i_numWords
        );
        emit RequestSent(requestId);
        return requestId;
    }

    function checkUpkeep(bytes memory) public view override returns (bool upkeepNeeded, bytes memory) {
        bool isOpen = s_lotteryState == LotteryState.OPEN;
        bool timePassed = (block.timestamp - s_eventStartedAt) > s_eventDuration;
        bool hasPlayer = s_players.length > 0;
        bool hasBalance = s_totalStakesForCurrentEvent > 0;

        upkeepNeeded = isOpen && timePassed && hasPlayer && hasBalance;

        return (upkeepNeeded, "0x0");
    }

    function performUpkeep(bytes calldata) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__UpKeepNotNeeded(
                s_totalStakesForCurrentEvent,
                s_players.length,
                uint8(s_lotteryState),
                block.timestamp - s_eventStartedAt
            );
        }
        selectWinner();
    }

    function setEventDuration(uint256 eventDuration) public onlyOwner {
        s_eventDuration = eventDuration;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getPlayersLength() public view returns (uint256) {
        return s_players.length;
    }

    function getTheRandomNumber() public view returns (uint256) {
        return s_randomWords[0];
    }

    function getWinnerProceeds(address winner) public view returns (uint256) {
        return s_winnerProceeds[winner];
    }

    function getLotteryWinners() public view returns (address[] memory) {
        return s_lotteryWinners;
    }

    function getLotteryWinnersCount() public view returns (uint256) {
        return s_lotteryWinnersCount;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getEventStartedAt() public view returns (uint256) {
        return s_eventStartedAt;
    }

    function getEventDuration() public view returns (uint256) {
        return s_eventDuration;
    }
}
