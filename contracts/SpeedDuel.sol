// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SpeedDuel
 * @dev Fast-paced PvP battle game leveraging MegaETH's 10ms blocks
 * Rock-Paper-Scissors style combat with stakes and tournaments
 */
contract SpeedDuel is Ownable, ReentrancyGuard {
    enum Move { None, Rock, Paper, Scissors }
    enum DuelStatus { Open, Committed, Revealed, Completed, Cancelled }

    struct Duel {
        uint256 id;
        address player1;
        address player2;
        uint256 stake;
        DuelStatus status;
        bytes32 player1MoveHash;
        bytes32 player2MoveHash;
        Move player1Move;
        Move player2Move;
        address winner;
        uint256 createdAt;
        uint256 expiresAt;
    }

    struct Player {
        uint256 wins;
        uint256 losses;
        uint256 draws;
        uint256 totalEarnings;
        uint256 gamesPlayed;
        uint256 currentRating;
    }

    mapping(uint256 => Duel) public duels;
    mapping(address => Player) public players;
    mapping(address => uint256) public pendingWithdrawals;
    
    uint256 public nextDuelId = 1;
    uint256 public platformFee = 50; // 0.5% (50/10000)
    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant MAX_STAKE = 10 ether;
    uint256 public constant DUEL_TIMEOUT = 300; // 5 minutes

    uint256[] public openDuels;
    mapping(uint256 => uint256) public duelIndexInOpenDuels;

    event DuelCreated(uint256 indexed duelId, address indexed player1, uint256 stake);
    event DuelJoined(uint256 indexed duelId, address indexed player2);
    event MoveMade(uint256 indexed duelId, address indexed player, bool isPlayer1);
    event DuelCompleted(uint256 indexed duelId, address indexed winner, uint256 prize);
    event DuelCancelled(uint256 indexed duelId);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new duel
     */
    function createDuel() external payable nonReentrant returns (uint256) {
        require(msg.value >= MIN_STAKE && msg.value <= MAX_STAKE, "Invalid stake amount");

        uint256 duelId = nextDuelId++;
        
        duels[duelId] = Duel({
            id: duelId,
            player1: msg.sender,
            player2: address(0),
            stake: msg.value,
            status: DuelStatus.Open,
            player1MoveHash: bytes32(0),
            player2MoveHash: bytes32(0),
            player1Move: Move.None,
            player2Move: Move.None,
            winner: address(0),
            createdAt: block.timestamp,
            expiresAt: block.timestamp + DUEL_TIMEOUT
        });

        openDuels.push(duelId);
        duelIndexInOpenDuels[duelId] = openDuels.length - 1;

        emit DuelCreated(duelId, msg.sender, msg.value);
        return duelId;
    }

    /**
     * @dev Join an existing duel
     */
    function joinDuel(uint256 duelId) external payable nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.status == DuelStatus.Open, "Duel not open");
        require(msg.value == duel.stake, "Must match stake");
        require(msg.sender != duel.player1, "Cannot play against yourself");
        require(block.timestamp < duel.expiresAt, "Duel expired");

        duel.player2 = msg.sender;
        duel.status = DuelStatus.Committed;

        // Remove from open duels
        _removeFromOpenDuels(duelId);

        emit DuelJoined(duelId, msg.sender);
    }

    /**
     * @dev Commit move (hash of move + salt)
     */
    function makeMove(uint256 duelId, bytes32 moveHash) external nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.status == DuelStatus.Committed || duel.status == DuelStatus.Revealed, "Invalid duel status");
        require(msg.sender == duel.player1 || msg.sender == duel.player2, "Not a player in this duel");

        if (msg.sender == duel.player1) {
            require(duel.player1MoveHash == bytes32(0), "Move already made");
            duel.player1MoveHash = moveHash;
            emit MoveMade(duelId, msg.sender, true);
        } else {
            require(duel.player2MoveHash == bytes32(0), "Move already made");
            duel.player2MoveHash = moveHash;
            emit MoveMade(duelId, msg.sender, false);
        }

        // If both moves committed, ready to reveal
        if (duel.player1MoveHash != bytes32(0) && duel.player2MoveHash != bytes32(0)) {
            duel.status = DuelStatus.Revealed;
        }
    }

    /**
     * @dev Reveal move
     */
    function revealMove(uint256 duelId, Move move, bytes32 salt) external nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.status == DuelStatus.Revealed, "Not ready to reveal");
        require(msg.sender == duel.player1 || msg.sender == duel.player2, "Not a player in this duel");
        require(move != Move.None, "Invalid move");

        bytes32 expectedHash = keccak256(abi.encodePacked(move, salt, msg.sender));

        if (msg.sender == duel.player1) {
            require(duel.player1MoveHash == expectedHash, "Invalid reveal");
            require(duel.player1Move == Move.None, "Already revealed");
            duel.player1Move = move;
        } else {
            require(duel.player2MoveHash == expectedHash, "Invalid reveal");
            require(duel.player2Move == Move.None, "Already revealed");
            duel.player2Move = move;
        }

        // If both revealed, determine winner
        if (duel.player1Move != Move.None && duel.player2Move != Move.None) {
            _completeDuel(duelId);
        }
    }

    /**
     * @dev Quick duel - commit and reveal in one tx (less secure but faster)
     */
    function quickDuel(uint256 duelId, Move move, bytes32 salt) external nonReentrant {
        Duel storage duel = duels[duelId];
        require(duel.status == DuelStatus.Committed, "Invalid status for quick duel");
        require(msg.sender == duel.player1 || msg.sender == duel.player2, "Not a player");
        require(move != Move.None, "Invalid move");

        bytes32 moveHash = keccak256(abi.encodePacked(move, salt, msg.sender));

        if (msg.sender == duel.player1) {
            require(duel.player1MoveHash == bytes32(0), "Move already made");
            duel.player1MoveHash = moveHash;
            duel.player1Move = move;
        } else {
            require(duel.player2MoveHash == bytes32(0), "Move already made");
            duel.player2MoveHash = moveHash;
            duel.player2Move = move;
        }

        // If both moves made, complete duel
        if (duel.player1Move != Move.None && duel.player2Move != Move.None) {
            duel.status = DuelStatus.Revealed;
            _completeDuel(duelId);
        }
    }

    /**
     * @dev Complete duel and determine winner
     */
    function _completeDuel(uint256 duelId) private {
        Duel storage duel = duels[duelId];
        
        address winner = _determineWinner(duel.player1Move, duel.player2Move, duel.player1, duel.player2);
        duel.winner = winner;
        duel.status = DuelStatus.Completed;

        uint256 totalPot = duel.stake * 2;
        uint256 fee = (totalPot * platformFee) / 10000;
        uint256 prize = totalPot - fee;

        // Update player stats
        if (winner == duel.player1) {
            players[duel.player1].wins++;
            players[duel.player2].losses++;
            players[duel.player1].currentRating += 10;
            if (players[duel.player2].currentRating >= 5) {
                players[duel.player2].currentRating -= 5;
            }
        } else if (winner == duel.player2) {
            players[duel.player2].wins++;
            players[duel.player1].losses++;
            players[duel.player2].currentRating += 10;
            if (players[duel.player1].currentRating >= 5) {
                players[duel.player1].currentRating -= 5;
            }
        } else {
            // Draw
            players[duel.player1].draws++;
            players[duel.player2].draws++;
            players[duel.player1].currentRating += 1;
            players[duel.player2].currentRating += 1;
        }

        players[duel.player1].gamesPlayed++;
        players[duel.player2].gamesPlayed++;

        // Distribute winnings
        if (winner == address(0)) {
            // Draw - return stakes minus fee
            uint256 refund = (totalPot - fee) / 2;
            pendingWithdrawals[duel.player1] += refund;
            pendingWithdrawals[duel.player2] += refund;
        } else {
            players[winner].totalEarnings += prize;
            pendingWithdrawals[winner] += prize;
        }

        pendingWithdrawals[owner()] += fee;

        emit DuelCompleted(duelId, winner, prize);
    }

    /**
     * @dev Determine winner based on moves
     */
    function _determineWinner(Move move1, Move move2, address player1, address player2) private pure returns (address) {
        if (move1 == move2) return address(0); // Draw

        if (
            (move1 == Move.Rock && move2 == Move.Scissors) ||
            (move1 == Move.Paper && move2 == Move.Rock) ||
            (move1 == Move.Scissors && move2 == Move.Paper)
        ) {
            return player1;
        }

        return player2;
    }

    /**
     * @dev Cancel duel (if not joined or timed out)
     */
    function cancelDuel(uint256 duelId) external nonReentrant {
        Duel storage duel = duels[duelId];
        require(msg.sender == duel.player1, "Only creator can cancel");
        require(duel.status == DuelStatus.Open || block.timestamp >= duel.expiresAt, "Cannot cancel");

        duel.status = DuelStatus.Cancelled;
        pendingWithdrawals[duel.player1] += duel.stake;

        if (duel.status == DuelStatus.Open) {
            _removeFromOpenDuels(duelId);
        }

        emit DuelCancelled(duelId);
    }

    /**
     * @dev Withdraw winnings
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    /**
     * @dev Get hash for move
     */
    function getMoveHash(Move move, bytes32 salt) external view returns (bytes32) {
        return keccak256(abi.encodePacked(move, salt, msg.sender));
    }

    /**
     * @dev Remove duel from open duels array
     */
    function _removeFromOpenDuels(uint256 duelId) private {
        uint256 index = duelIndexInOpenDuels[duelId];
        uint256 lastIndex = openDuels.length - 1;

        if (index != lastIndex) {
            uint256 lastDuelId = openDuels[lastIndex];
            openDuels[index] = lastDuelId;
            duelIndexInOpenDuels[lastDuelId] = index;
        }

        openDuels.pop();
        delete duelIndexInOpenDuels[duelId];
    }

    /**
     * @dev Get open duels
     */
    function getOpenDuels(uint256 count, uint256 offset) external view returns (uint256[] memory) {
        if (offset >= openDuels.length) {
            return new uint256[](0);
        }

        uint256 remaining = openDuels.length - offset;
        uint256 size = count < remaining ? count : remaining;
        uint256[] memory result = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            result[i] = openDuels[offset + i];
        }

        return result;
    }

    /**
     * @dev Get player stats
     */
    function getPlayerStats(address player) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 draws,
        uint256 totalEarnings,
        uint256 gamesPlayed,
        uint256 rating,
        uint256 pendingBalance
    ) {
        Player storage p = players[player];
        return (
            p.wins,
            p.losses,
            p.draws,
            p.totalEarnings,
            p.gamesPlayed,
            p.currentRating,
            pendingWithdrawals[player]
        );
    }

    /**
     * @dev Get duel info
     */
    function getDuel(uint256 duelId) external view returns (
        address player1,
        address player2,
        uint256 stake,
        DuelStatus status,
        Move player1Move,
        Move player2Move,
        address winner,
        uint256 createdAt,
        uint256 expiresAt
    ) {
        Duel storage duel = duels[duelId];
        return (
            duel.player1,
            duel.player2,
            duel.stake,
            duel.status,
            duel.player1Move,
            duel.player2Move,
            duel.winner,
            duel.createdAt,
            duel.expiresAt
        );
    }

    /**
     * @dev Set platform fee
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high"); // Max 5%
        platformFee = newFee;
    }
}

