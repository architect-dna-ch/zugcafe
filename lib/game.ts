export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type Value = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4'
export interface Card { color: Color; value: Value; id: string }
export interface GameState {
  deck: Card[]
  discard: Card[]
  hands: Record<string, Card[]>
  players: string[]
  names: Record<string, string>
  currentPlayerIndex: number
  direction: 1 | -1
  pendingDraw: number
  winner: string | null
  currentColor: Color
}

const COLORS: Color[] = ['red', 'yellow', 'green', 'blue']
const NUMBERS: Value[] = ['0','1','2','3','4','5','6','7','8','9']
const ACTIONS: Value[] = ['skip','reverse','draw2']

let _id = 0
function card(color: Color, value: Value): Card {
  return { color, value, id: `${color}-${value}-${_id++}` }
}

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const c of COLORS) {
    deck.push(card(c, '0'))
    for (let i = 0; i < 2; i++) {
      for (const n of NUMBERS.slice(1)) deck.push(card(c, n))
      for (const a of ACTIONS) deck.push(card(c, a))
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push(card('wild', 'wild'))
    deck.push(card('wild', 'wild4'))
  }
  return shuffle(deck)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createGame(players: string[], names: Record<string, string> = {}): GameState {
  const deck = buildDeck()
  const hands: Record<string, Card[]> = {}
  for (const p of players) {
    hands[p] = deck.splice(0, 7)
  }
  // find a non-wild starting card
  let startIdx = deck.findIndex(c => c.color !== 'wild')
  const [startCard] = deck.splice(startIdx, 1)
  return {
    deck,
    discard: [startCard],
    hands,
    players,
    names,
    currentPlayerIndex: 0,
    direction: 1,
    pendingDraw: 0,
    winner: null,
    currentColor: startCard.color,
  }
}

export function topCard(state: GameState): Card {
  return state.discard[state.discard.length - 1]
}

export function canPlay(card: Card, state: GameState): boolean {
  if (state.pendingDraw > 0) {
    return card.value === 'draw2' || card.value === 'wild4'
  }
  const top = topCard(state)
  return card.color === 'wild' || card.color === state.currentColor || card.value === top.value
}

export function playCard(state: GameState, playerId: string, cardId: string, chosenColor?: Color): GameState {
  if (state.winner) return state
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (currentPlayer !== playerId) return state

  const hand = state.hands[playerId]
  const cardIdx = hand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return state
  const played = hand[cardIdx]
  if (!canPlay(played, state)) return state

  const newHand = hand.filter((_, i) => i !== cardIdx)
  let newState: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    discard: [...state.discard, played],
    currentColor: played.color === 'wild' ? (chosenColor ?? 'red') : played.color,
  }

  if (newHand.length === 0) {
    return { ...newState, winner: playerId }
  }

  const n = state.players.length
  let skip = false
  if (played.value === 'skip') skip = true
  if (played.value === 'reverse') {
    newState.direction = (state.direction * -1) as 1 | -1
    if (n === 2) skip = true
  }
  if (played.value === 'draw2') newState.pendingDraw = state.pendingDraw + 2
  if (played.value === 'wild4') newState.pendingDraw = state.pendingDraw + 4

  const advance = skip ? 2 : 1
  newState.currentPlayerIndex = ((state.currentPlayerIndex + state.direction * advance) % n + n) % n
  return newState
}

export function drawCard(state: GameState, playerId: string): GameState {
  if (state.winner) return state
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (currentPlayer !== playerId) return state

  const count = state.pendingDraw > 0 ? state.pendingDraw : 1
  let deck = [...state.deck]
  let discard = [...state.discard]

  if (deck.length < count) {
    const keep = discard.splice(discard.length - 1, 1)
    deck = [...deck, ...shuffle(discard)]
    discard = keep
  }

  const drawn = deck.splice(0, count)
  const n = state.players.length
  const newState: GameState = {
    ...state,
    deck,
    discard,
    pendingDraw: 0,
    hands: { ...state.hands, [playerId]: [...state.hands[playerId], ...drawn] },
    currentPlayerIndex: ((state.currentPlayerIndex + state.direction) % n + n) % n,
  }
  return newState
}
