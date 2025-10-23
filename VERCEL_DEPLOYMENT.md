# ⚔️ SpeedDuel - Vercel Deployment Guide

## Contract Info
**Address**: `0xd9D6356046993a5e508B461F60C06a7080066cCf`  
**Explorer**: https://megaexplorer.xyz/address/0xd9D6356046993a5e508B461F60C06a7080066cCf

## Quick Deploy

```bash
cd speed-duel/frontend
npm install
vercel
vercel --prod
```

## Vercel Configuration

Create `vercel.json` in `speed-duel/`:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite"
}
```

## Project Settings

- **Framework**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: 18.x

## Testing Checklist

### 1. View Lobby
- See open duels
- View stake amounts
- Check creation timestamps
- Filter by stake size

### 2. Create Duel
- Set stake (0.001 - 10 ETH)
- Create transaction
- Duel appears in lobby
- Wait for opponent

### 3. Join Duel
- Browse open duels
- Match stake amount
- Join transaction
- Move to duel view

### 4. Play Duel
- Choose move (Rock/Paper/Scissors)
- Submit move (instant with quickDuel)
- Wait for opponent
- See result

### 5. View Stats
- Total wins/losses/draws
- Win rate percentage
- Current rating
- Total games played
- Total earnings

## Game Mechanics

### Moves
```
🪨 Rock     beats ✂️ Scissors
📄 Paper    beats 🪨 Rock
✂️ Scissors beats 📄 Paper
Same move = Draw (refund minus fee)
```

### Stakes
- Minimum: 0.001 ETH
- Maximum: 10 ETH
- Winner takes: (stake × 2) - 0.5% fee
- Draw: Both get refund - 0.5% fee

### Rating System
- Win: +10 rating
- Loss: -5 rating
- Draw: +1 rating
- Start: 0 rating

## UI Components

### Lobby View
```jsx
<DuelCard>
  <DuelId>Duel #{id}</DuelId>
  <Stake>{stake} ETH</Stake>
  <Creator>{player1}</Creator>
  <JoinButton>Join Duel</JoinButton>
</DuelCard>
```

### Duel View
```jsx
<DuelArena>
  <Player1>{address} - {move}</Player1>
  <VS>⚔️</VS>
  <Player2>{address} - {move}</Player2>
  <PrizePool>{stake * 2} ETH</PrizePool>
  <MoveSelector>
    <Rock onClick={selectRock} />
    <Paper onClick={selectPaper} />
    <Scissors onClick={selectScissors} />
  </MoveSelector>
</DuelArena>
```

### Stats View
```jsx
<StatsGrid>
  <Stat label="Wins" value={wins} color="green" />
  <Stat label="Losses" value={losses} color="red" />
  <Stat label="Draws" value={draws} color="gray" />
  <Stat label="Win Rate" value={winRate + '%'} />
  <Stat label="Rating" value={rating} />
  <Stat label="Earnings" value={earnings + ' ETH'} />
</StatsGrid>
```

## Smart Contract Functions

### Create & Join
```javascript
// Create duel
await contract.createDuel({ value: ethers.parseEther('0.01') })

// Join duel
await contract.joinDuel(duelId, { value: stake })
```

### Play Modes

#### Quick Duel (Recommended)
```javascript
// One transaction
const move = 1 // Rock
const salt = ethers.randomBytes(32)
await contract.quickDuel(duelId, move, salt)
```

#### Commit-Reveal (More Secure)
```javascript
// Step 1: Commit move hash
const moveHash = await contract.getMoveHash(move, salt)
await contract.makeMove(duelId, moveHash)

// Step 2: Reveal after both committed
await contract.revealMove(duelId, move, salt)
```

### View Functions
```javascript
// Get open duels
await contract.getOpenDuels(count, offset)

// Get player stats
await contract.getPlayerStats(address)

// Get duel details
await contract.getDuel(duelId)
```

## Game Flow

### State Machine
```
Open → Committed → Revealed → Completed
  ↓
Cancelled (timeout or creator cancel)
```

### Timeline
1. **Create** (10ms) - Duel created, awaiting opponent
2. **Join** (10ms) - Opponent joins, both can now move
3. **Move** (10ms) - Both players submit moves
4. **Result** (instant) - Winner determined, funds distributed
5. **Complete** - Stats updated, new duel can start

## Animations

### Move Selection
```css
.move-button:hover {
  animation: pulse-glow 1.5s ease-in-out infinite;
  transform: scale(1.1);
}
```

### Battle Animation
```css
@keyframes battle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(-5deg); }
  75% { transform: scale(1.1) rotate(5deg); }
}
```

### Result Display
- Win: Confetti animation 🎉
- Loss: Shake animation
- Draw: Fade animation

## Security

### Fairness
- Commit-reveal prevents cheating
- Salt ensures randomness
- On-chain verification
- Timeout protection

### Anti-Cheat
- Can't see opponent's move before submitting
- Can't change move after submission
- Transaction order doesn't matter
- Fair randomness from blockchain

## Advanced Features

### Tournament Mode (Future)
- Multi-round brackets
- Prize pools
- Leaderboards
- Spectator mode

### Team Duels (Future)
- 2v2 or 3v3
- Combined stakes
- Team ratings

### Custom Rules (Future)
- Best of 3/5
- Time limits
- Double or nothing

## Performance

- Lobby updates every 3 seconds
- Instant move feedback
- Optimistic UI updates
- Transaction confirmations ~10ms

## Troubleshooting

### Can't create duel
- Check stake is within limits (0.001 - 10 ETH)
- Ensure sufficient balance
- Verify gas estimation

### Can't join duel
- Must match exact stake
- Can't play against yourself
- Check duel hasn't expired (5 min timeout)

### Move not registering
- Ensure duel status is correct
- Check you haven't moved already
- Verify transaction confirmed

### Stats not updating
- Refresh page
- Check transaction confirmed
- Verify contract connection

## Monitoring

### Events to Track
- `DuelCreated`
- `DuelJoined`
- `MoveMade`
- `DuelCompleted`
- `DuelCancelled`

### Analytics
- Total duels created
- Average stake size
- Win/loss ratios
- Most active players
- Revenue generated

---

**Ready for battle? Deploy and start dueling!** ⚔️🎮

