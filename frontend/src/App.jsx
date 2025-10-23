import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import contractABI from './contract-abi.json'
import contractAddress from './contract-address.json'

const MEGAETH_CONFIG = {
  chainId: '0x18c6',
  chainName: 'MegaETH Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://carrot.megaeth.com/rpc'],
  blockExplorerUrls: ['https://megaexplorer.xyz']
}

const MOVES = {
  1: { name: 'Rock', emoji: '🪨' },
  2: { name: 'Paper', emoji: '📄' },
  3: { name: 'Scissors', emoji: '✂️' }
}

function App() {
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState(null)
  const [view, setView] = useState('lobby') // lobby, create, duel, stats
  const [loading, setLoading] = useState(false)
  
  const [openDuels, setOpenDuels] = useState([])
  const [stats, setStats] = useState(null)
  const [currentDuel, setCurrentDuel] = useState(null)
  
  // Form states
  const [stakeAmount, setStakeAmount] = useState('0.01')
  const [selectedMove, setSelectedMove] = useState(null)
  const [salt, setSalt] = useState('')

  useEffect(() => {
    checkWalletConnection()
  }, [])

  useEffect(() => {
    if (contract && account) {
      loadData()
      const interval = setInterval(loadData, 3000)
      return () => clearInterval(interval)
    }
  }, [contract, account])

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts.length > 0) {
        await connectWallet()
      }
    }
  }

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!')
        return
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: MEGAETH_CONFIG.chainId }],
        })
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [MEGAETH_CONFIG],
          })
        }
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractInstance = new ethers.Contract(
        contractAddress.address,
        contractABI,
        signer
      )

      setAccount(accounts[0])
      setContract(contractInstance)
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  const loadData = async () => {
    if (!contract || !account) return

    try {
      // Load player stats
      const playerStats = await contract.getPlayerStats(account)
      setStats({
        wins: Number(playerStats[0]),
        losses: Number(playerStats[1]),
        draws: Number(playerStats[2]),
        totalEarnings: ethers.formatEther(playerStats[3]),
        gamesPlayed: Number(playerStats[4]),
        rating: Number(playerStats[5]),
        pendingBalance: ethers.formatEther(playerStats[6])
      })

      // Load open duels
      const duelIds = await contract.getOpenDuels(20, 0)
      const duelsData = await Promise.all(
        duelIds.map(async (id) => {
          const duel = await contract.getDuel(id)
          return {
            id: Number(id),
            player1: duel[0],
            stake: ethers.formatEther(duel[2]),
            createdAt: Number(duel[7]),
            expiresAt: Number(duel[8])
          }
        })
      )
      setOpenDuels(duelsData)

      // Check current duel if in duel view
      if (currentDuel) {
        const duelData = await contract.getDuel(currentDuel.id)
        setCurrentDuel({
          id: currentDuel.id,
          player1: duelData[0],
          player2: duelData[1],
          stake: ethers.formatEther(duelData[2]),
          status: Number(duelData[3]),
          player1Move: Number(duelData[4]),
          player2Move: Number(duelData[5]),
          winner: duelData[6]
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const createDuel = async () => {
    if (!stakeAmount) return
    setLoading(true)
    try {
      const tx = await contract.createDuel({
        value: ethers.parseEther(stakeAmount)
      })
      const receipt = await tx.wait()
      
      // Get duel ID from event
      const event = receipt.logs.find(log => {
        try {
          return contract.interface.parseLog(log).name === 'DuelCreated'
        } catch { return false }
      })
      
      if (event) {
        const parsed = contract.interface.parseLog(event)
        const duelId = Number(parsed.args[0])
        const duelData = await contract.getDuel(duelId)
        setCurrentDuel({
          id: duelId,
          player1: duelData[0],
          player2: duelData[1],
          stake: ethers.formatEther(duelData[2]),
          status: Number(duelData[3])
        })
        setView('duel')
      }
      
      await loadData()
    } catch (error) {
      console.error('Error creating duel:', error)
      alert(error.reason || 'Failed to create duel')
    } finally {
      setLoading(false)
    }
  }

  const joinDuel = async (duelId, stake) => {
    setLoading(true)
    try {
      const tx = await contract.joinDuel(duelId, {
        value: ethers.parseEther(stake)
      })
      await tx.wait()
      
      const duelData = await contract.getDuel(duelId)
      setCurrentDuel({
        id: duelId,
        player1: duelData[0],
        player2: duelData[1],
        stake: ethers.formatEther(duelData[2]),
        status: Number(duelData[3])
      })
      setView('duel')
      await loadData()
    } catch (error) {
      console.error('Error joining duel:', error)
      alert(error.reason || 'Failed to join duel')
    } finally {
      setLoading(false)
    }
  }

  const makeMove = async () => {
    if (!selectedMove || !currentDuel) return
    setLoading(true)
    try {
      // Generate random salt if not provided
      const moveSalt = salt || ethers.hexlify(ethers.randomBytes(32))
      
      // Use quick duel for faster gameplay
      const tx = await contract.quickDuel(currentDuel.id, selectedMove, moveSalt)
      await tx.wait()
      
      await loadData()
      alert('Move made! Waiting for opponent...')
    } catch (error) {
      console.error('Error making move:', error)
      alert(error.reason || 'Failed to make move')
    } finally {
      setLoading(false)
      setSelectedMove(null)
    }
  }

  const withdraw = async () => {
    setLoading(true)
    try {
      const tx = await contract.withdraw()
      await tx.wait()
      await loadData()
      alert('Withdrawal successful!')
    } catch (error) {
      console.error('Error withdrawing:', error)
      alert(error.reason || 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status) => {
    const statuses = ['Open', 'In Progress', 'Revealing', 'Completed', 'Cancelled']
    return statuses[status] || 'Unknown'
  }

  const getWinRate = () => {
    if (!stats || stats.gamesPlayed === 0) return '0'
    return ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-md">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-4xl font-bold mb-4">SpeedDuel</h1>
          <p className="text-gray-600 mb-6">Fast-paced PvP battles on MegaETH</p>
          <button
            onClick={connectWallet}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-blue-500 text-white rounded-full font-bold hover:shadow-lg transition"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">⚔️ SpeedDuel</h1>
              <p className="text-gray-600">{account.slice(0, 6)}...{account.slice(-4)}</p>
            </div>
            {stats && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Rating</p>
                <p className="text-3xl font-bold">⭐ {stats.rating}</p>
                {parseFloat(stats.pendingBalance) > 0 && (
                  <button
                    onClick={withdraw}
                    disabled={loading}
                    className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition disabled:opacity-50"
                  >
                    Withdraw {parseFloat(stats.pendingBalance).toFixed(4)} ETH
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('lobby')}
            className={`flex-1 py-3 rounded-xl font-bold transition ${
              view === 'lobby' ? 'bg-white text-red-600 shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Lobby
          </button>
          <button
            onClick={() => setView('create')}
            className={`flex-1 py-3 rounded-xl font-bold transition ${
              view === 'create' ? 'bg-white text-red-600 shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Create Duel
          </button>
          <button
            onClick={() => setView('stats')}
            className={`flex-1 py-3 rounded-xl font-bold transition ${
              view === 'stats' ? 'bg-white text-red-600 shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Stats
          </button>
        </div>

        {/* Lobby View */}
        {view === 'lobby' && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-4">🎮 Open Duels</h2>
            {openDuels.length === 0 ? (
              <p className="text-gray-500 text-center py-12">No open duels. Create one!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {openDuels.map(duel => (
                  <div key={duel.id} className="border-2 border-red-200 rounded-xl p-4 hover:border-red-400 transition">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold">Duel #{duel.id}</span>
                      <span className="text-2xl font-bold text-red-600">{duel.stake} ETH</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Created by {duel.player1.slice(0, 6)}...{duel.player1.slice(-4)}
                    </p>
                    <button
                      onClick={() => joinDuel(duel.id, duel.stake)}
                      disabled={loading || duel.player1.toLowerCase() === account.toLowerCase()}
                      className="w-full py-2 bg-gradient-to-r from-red-500 to-blue-500 text-white rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {duel.player1.toLowerCase() === account.toLowerCase() ? 'Your Duel' : 'Join Duel'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Duel View */}
        {view === 'create' && (
          <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6">Create New Duel</h2>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2">Stake Amount (ETH)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max="10"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-sm text-gray-600 mt-2">Min: 0.001 ETH | Max: 10 ETH</p>
            </div>
            <button
              onClick={createDuel}
              disabled={loading || !stakeAmount}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-blue-500 text-white rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Duel'}
            </button>
          </div>
        )}

        {/* Duel View */}
        {view === 'duel' && currentDuel && (
          <div className="bg-white rounded-2xl p-6 shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">⚔️ Duel #{currentDuel.id}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Player 1</p>
                <p className="font-mono font-bold">{currentDuel.player1.slice(0, 10)}...</p>
                {currentDuel.player1Move > 0 && (
                  <div className="text-4xl mt-2">{MOVES[currentDuel.player1Move].emoji}</div>
                )}
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Player 2</p>
                <p className="font-mono font-bold">
                  {currentDuel.player2 === ethers.ZeroAddress ? 'Waiting...' : `${currentDuel.player2.slice(0, 10)}...`}
                </p>
                {currentDuel.player2Move > 0 && (
                  <div className="text-4xl mt-2">{MOVES[currentDuel.player2Move].emoji}</div>
                )}
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-600">Prize Pool</p>
              <p className="text-4xl font-bold text-green-600">{parseFloat(currentDuel.stake) * 2} ETH</p>
              <p className="text-sm text-gray-600 mt-2">Status: {getStatusText(currentDuel.status)}</p>
            </div>

            {currentDuel.status === 3 && currentDuel.winner && (
              <div className="text-center p-4 bg-green-100 rounded-lg mb-6">
                <p className="text-xl font-bold text-green-600">
                  {currentDuel.winner.toLowerCase() === account.toLowerCase() ? '🎉 You Won!' : '😔 You Lost'}
                </p>
                <button
                  onClick={() => { setView('lobby'); setCurrentDuel(null) }}
                  className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600"
                >
                  Back to Lobby
                </button>
              </div>
            )}

            {currentDuel.status === 1 && !selectedMove && (
              <div>
                <p className="text-center font-bold mb-4">Choose Your Move:</p>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(MOVES).map(([key, move]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedMove(parseInt(key))}
                      className="move-button p-6 border-4 border-gray-300 rounded-xl hover:border-red-500 transition text-center"
                    >
                      <div className="text-6xl mb-2">{move.emoji}</div>
                      <div className="font-bold">{move.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMove && (
              <div className="text-center">
                <p className="mb-4">Selected: {MOVES[selectedMove].emoji} {MOVES[selectedMove].name}</p>
                <div className="flex gap-4">
                  <button
                    onClick={makeMove}
                    disabled={loading}
                    className="flex-1 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Confirm Move'}
                  </button>
                  <button
                    onClick={() => setSelectedMove(null)}
                    className="px-6 py-3 bg-gray-300 rounded-lg font-bold hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats View */}
        {view === 'stats' && stats && (
          <div className="bg-white rounded-2xl p-6 shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">📊 Your Stats</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{stats.wins}</p>
                <p className="text-gray-600">Wins</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{stats.losses}</p>
                <p className="text-gray-600">Losses</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-600">{stats.draws}</p>
                <p className="text-gray-600">Draws</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{stats.gamesPlayed}</p>
                <p className="text-gray-600">Total Games</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{getWinRate()}%</p>
                <p className="text-gray-600">Win Rate</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">{stats.rating}</p>
                <p className="text-gray-600">Rating</p>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg">
              <p className="text-gray-600 mb-2">Total Earnings</p>
              <p className="text-4xl font-bold">{parseFloat(stats.totalEarnings).toFixed(4)} ETH</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

