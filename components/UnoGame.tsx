'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createGame, playCard, drawCard, canPlay, type GameState, type Card, type Color } from '@/lib/game'

const COLOR_HEX: Record<Color, string> = {
  red: '#e74c3c', yellow: '#f1c40f', green: '#2ecc71', blue: '#3498db', wild: '#9b59b6'
}

const LABEL: Record<string, string> = {
  skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4'
}

interface Props { roomId: string; userId: string; nickname: string }

export default function UnoGame({ roomId, userId, nickname }: Props) {
  const [state, setState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([])
  const [nameInput, setNameInput] = useState('')
  const [joined, setJoined] = useState(false)
  const [pickColor, setPickColor] = useState<string | null>(null)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)

  useEffect(() => {
    load()
    const ch = supabase.channel(`game-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, e => {
        const s = (e.new as { state: GameState }).state
        setState(s)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId])

  async function load() {
    const { data } = await supabase.from('game_rooms').select('state').eq('id', roomId).single()
    if (data) {
      setState(data.state as GameState)
      const s = data.state as GameState
      setJoined(s.players.includes(userId))
    }
    setLoading(false)
  }

  async function save(s: GameState) {
    await supabase.from('game_rooms').upsert({ id: roomId, state: s, updated_at: new Date().toISOString() })
    setState(s)
  }

  async function joinGame() {
    const name = nameInput.trim() || nickname
    if (!name) return
    if (state && state.players.length >= 4) return
    if (state && !state.winner && state.deck.length > 0) return // game in progress

    const existingPlayers = state?.players || []
    if (existingPlayers.includes(userId)) { setJoined(true); return }
    const newPlayers = [...existingPlayers, userId]

    // Store nickname in messages-like way via presence (simplified: just use localStorage mapping)
    const names = JSON.parse(localStorage.getItem('zc_player_names') || '{}')
    names[userId] = name
    localStorage.setItem('zc_player_names', JSON.stringify(names))

    if (state) {
      await save({ ...state, players: newPlayers, hands: { ...state.hands, [userId]: [] } })
    } else {
      const init: GameState = createGame([userId])
      init.players = [userId]
      await save(init)
    }
    setJoined(true)
  }

  async function startGame() {
    if (!state || state.players.length < 2) return
    const newState = createGame(state.players)
    await save(newState)
  }

  async function handlePlay(cardId: string) {
    if (!state) return
    const card = state.hands[userId]?.find(c => c.id === cardId)
    if (!card) return
    if (card.color === 'wild') {
      setPendingCardId(cardId)
      setPickColor('pick')
      return
    }
    const newState = playCard(state, userId, cardId)
    await save(newState)
  }

  async function handleColorPick(color: Color) {
    if (!state || !pendingCardId) return
    const newState = playCard(state, userId, pendingCardId, color)
    await save(newState)
    setPickColor(null)
    setPendingCardId(null)
  }

  async function handleDraw() {
    if (!state) return
    const newState = drawCard(state, userId)
    await save(newState)
  }

  function getPlayerName(id: string) {
    const names = JSON.parse(localStorage.getItem('zc_player_names') || '{}')
    return names[id] || id.slice(0, 6)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>

  const notStarted = !state || state.deck.length === 0 && Object.values(state.hands).every(h => h.length === 0)
  const gameOver = state?.winner

  // Lobby
  if (notStarted || (state && state.players.length > 0 && !state.hands[userId]?.length && !state.winner)) {
    const isCreator = state?.players[0] === userId || !state
    const count = state?.players.length || 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>🃏 UNO</div>
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            {count} / 4 players joined
          </div>
          {state?.players.map(pid => (
            <div key={pid} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>
              {getPlayerName(pid)} {pid === userId ? '(you)' : ''}
            </div>
          ))}
        </div>

        {!joined && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Your name in this game" value={nameInput} onChange={e => setNameInput(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={joinGame}>Join</button>
          </div>
        )}

        {joined && isCreator && count >= 2 && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={startGame}>
            Start game ({count} players)
          </button>
        )}
        {joined && isCreator && count < 2 && (
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
            Waiting for at least 1 more player…
          </div>
        )}
        {joined && !isCreator && (
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
            Waiting for the host to start…
          </div>
        )}
      </div>
    )
  }

  if (!state) return null

  if (gameOver) {
    const isWinner = state.winner === userId
    return (
      <div className="winner-banner">
        <div className="winner-emoji">{isWinner ? '🏆' : '😅'}</div>
        <div className="winner-text">{isWinner ? 'You won!' : `${getPlayerName(state.winner!)} wins!`}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>
          {isWinner ? 'UNO! The deck is clear.' : 'Better luck next time.'}
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 20 }}
          onClick={async () => {
            const newState = createGame(state.players)
            await save(newState)
          }}
        >
          Play again
        </button>
      </div>
    )
  }

  const myHand = state.hands[userId] || []
  const top = state.discard[state.discard.length - 1]
  const currentPlayer = state.players[state.currentPlayerIndex]
  const isMyTurn = currentPlayer === userId

  const otherPlayers = state.players.filter(p => p !== userId)

  return (
    <div className="game-board">
      {/* Other players' hand sizes */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {otherPlayers.map(pid => {
          const count = state.hands[pid]?.length || 0
          return (
            <div key={pid} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: currentPlayer === pid ? 'var(--accent)' : 'var(--bg3)',
              color: currentPlayer === pid ? '#0d0d0d' : 'var(--text2)'
            }}>
              {getPlayerName(pid)}: {count} {count === 1 ? '🔥 UNO!' : 'cards'}
            </div>
          )
        })}
      </div>

      {/* Turn indicator */}
      <div className={`turn-indicator ${isMyTurn ? 'turn-yours' : ''}`}>
        {isMyTurn ? '⬇ Your turn' : `${getPlayerName(currentPlayer)}'s turn`}
        {state.pendingDraw > 0 && ` · +${state.pendingDraw} pending`}
      </div>

      {/* Discard + draw area */}
      <div className="discard-area">
        <div
          className={`uno-card color-${top.color}`}
          style={{ cursor: 'default', borderColor: `${COLOR_HEX[state.currentColor]}88` }}
        >
          {LABEL[top.value] || top.value}
        </div>
        {state.currentColor !== top.color && (
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: COLOR_HEX[state.currentColor],
            border: '2px solid rgba(255,255,255,.3)'
          }} />
        )}
        <div
          className="draw-pile"
          onClick={isMyTurn ? handleDraw : undefined}
          style={{ opacity: isMyTurn ? 1 : 0.4 }}
          title="Draw card"
        >
          🂠
        </div>
      </div>

      {/* Color picker */}
      {pickColor === 'pick' && (
        <div className="color-picker">
          {(['red', 'yellow', 'green', 'blue'] as Color[]).map(c => (
            <div
              key={c}
              className="color-btn"
              style={{ background: COLOR_HEX[c] }}
              onClick={() => handleColorPick(c)}
            />
          ))}
        </div>
      )}

      {/* My hand */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, textAlign: 'center' }}>
          Your hand ({myHand.length})
        </div>
        <div className="card-row">
          {myHand.map(c => {
            const playable = isMyTurn && canPlay(c, state)
            return (
              <div
                key={c.id}
                className={`uno-card color-${c.color} ${playable ? 'playable' : ''}`}
                style={{ opacity: isMyTurn && !playable ? 0.4 : 1 }}
                onClick={() => playable && handlePlay(c.id)}
              >
                {LABEL[c.value] || c.value}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
