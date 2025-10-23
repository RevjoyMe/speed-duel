# ⚔️ SpeedDuel

Fast-paced PvP battle game built on MegaETH. Rock-Paper-Scissors with real stakes and instant gameplay.

## Features

- **Instant Duels**: Create or join duels in seconds
- **Rock-Paper-Scissors**: Classic game with crypto stakes
- **Real Stakes**: Bet ETH on your skills
- **Rating System**: Earn rating points for wins
- **Quick Mode**: One-transaction gameplay
- **Fair Resolution**: On-chain logic, no cheating possible

## Technology Stack

- **Smart Contracts**: Solidity + Hardhat
- **Frontend**: React + Vite + TailwindCSS
- **Blockchain**: MegaETH Testnet (Chain ID: 6342)
- **Web3**: ethers.js v6

## Setup & Deployment

### 1. Install Dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Deploy to MegaETH

```bash
npm run deploy
```

### 4. Run Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3003

## How to Play

1. **Create Duel**: Set your stake (0.001 - 10 ETH) and wait for opponent
2. **Join Duel**: Browse open duels and join one
3. **Choose Move**: Rock, Paper, or Scissors
4. **Battle**: Both players commit moves
5. **Winner Takes All**: Winner gets prize (2x stake minus 0.5% fee)

## Game Rules

### Winning Conditions
- Rock beats Scissors
- Paper beats Rock
- Scissors beats Paper
- Same move = Draw (both get refund minus fee)

### Rating System
- Win: +10 rating
- Loss: -5 rating
- Draw: +1 rating

### Stake Limits
- Minimum: 0.001 ETH
- Maximum: 10 ETH
- Platform fee: 0.5%

## Gameplay Modes

### Quick Duel (Recommended)
- Single transaction
- Instant resolution
- Less secure but faster

### Commit-Reveal Duel
- Two-phase gameplay
- Commit move hash first
- Reveal move after both committed
- More secure, prevents front-running

## Smart Contract Functions

### Duels
- `createDuel()` - Create new duel
- `joinDuel(duelId)` - Join existing duel
- `quickDuel(duelId, move, salt)` - Fast one-tx gameplay
- `makeMove(duelId, moveHash)` - Commit move
- `revealMove(duelId, move, salt)` - Reveal move
- `cancelDuel(duelId)` - Cancel if no opponent

### Stats & Info
- `getPlayerStats(player)` - Get player statistics
- `getOpenDuels(count, offset)` - Browse available duels
- `getDuel(duelId)` - Get duel details

## Security Features

- Commit-reveal scheme prevents cheating
- Timeout mechanism for abandoned duels
- ReentrancyGuard protection
- Fair randomness handling

## Smart Contract

**✅ DEPLOYED CONTRACT**

**Contract Address**: `0xd9D6356046993a5e508B461F60C06a7080066cCf`

**View on Explorer**: https://megaexplorer.xyz/address/0xd9D6356046993a5e508B461F60C06a7080066cCf

**Network**: MegaETH Testnet
- Chain ID: 6342
- RPC: https://carrot.megaeth.com/rpc
- Explorer: https://megaexplorer.xyz

**Deployed**: Successfully deployed and verified
**Deployer**: 0x89ae914DB5067a0F2EF532aeCB96aBd7c83F53Ef

## Building for Production

```bash
cd frontend
npm run build
```

Deploy the `frontend/dist` folder to any static hosting.

## Future Features

- Tournaments with prize pools
- Best-of-3 matches
- Spectator mode
- Leaderboards
- Team battles
- More game modes (dice, coin flip, etc.)

## License

MIT

