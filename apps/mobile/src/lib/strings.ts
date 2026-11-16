/**
 * All user-facing UI copy in one place.
 *
 * i18n plan: screens import `t` from here. When we add locales later,
 * this becomes `en.ts` and we add `hi.ts` etc. behind a locale switch —
 * no screen changes needed. Keep strings neutral English; desi flavor
 * lives in word packs, awards and branding, not in UI copy.
 */
export const t = {
  // Home
  tagline: "Draw. Guess. Laugh. 🎨",
  namePlaceholder: "Your name?",
  roomCodePlaceholder: "Room code…",
  avatarHint: "Style your player",
  createRoom: "Create Room 🎨",
  joinRoom: "Join Room 🚪",
  joinWithCode: "Join with a code 🔑",
  backToCreate: "← Back to create room",
  connecting: "Connecting...",
  footer: "Free forever · Share the code with friends and play 🎉",

  // Room header
  lobby: "Lobby",
  pickingWord: "Picking a word...",
  turnInProgress: "In progress",
  waitingNext: "Get ready...",

  // Game bar
  guessThis: "GUESS THIS",
  drawThis: "DRAW THIS",
  roundOf: (round: number, total: number) => `Round ${round} of ${total}`,
  yourTurnNext: "Your turn next",
  points: (n: number) => `${n} points`,

  // Lobby
  inviteLabel: "Invite code — share it with friends!",
  copyCode: "Copy code 📋",
  copyLink: "Copy link 🔗",
  copied: "Copied!",
  players: "Players",
  settingsHostOnly: "Settings (host only)",
  rounds: "Rounds",
  drawTime: "Draw time (sec)",
  hints: "Hints",
  hostControls: (host: string) => `👑 ${host} controls the settings`,
  waitingForHost: "Waiting for the host to start...",
  needPlayers: "Need at least 2 players",
  startGame: "Start Game! 🚀",

  // Game
  yourTurn: "Your turn! 🎨",
  pickWordSub: "Pick a word and draw it",
  guessPlaceholder: "Type your guess here...",
  drawerChatPlaceholder: "Chat (players are guessing)...",
  youGuessed: "🎉 You guessed it! Enjoy the show",
  roundLabel: (round: number, total: number) => `Round ${round}/${total}`,

  // Overlays
  theWordWas: "The word was",
  drawnBy: (name: string) => `Drawn by ${name}`,
  nextTurnComing: "Next turn is coming up...",
  roundDone: (round: number) => `Round ${round} done! 🏁`,
  winnerIs: "is the winner!",
  rematchComing: "Heading back to the lobby for a rematch...",

  // Word choice
  pickFast: "Pick fast!",
  choosingWord: (name: string) => `${name} is choosing a word!`,

  // Drawing reactions
  likeDrawing: "Like the drawing",
  dislikeDrawing: "Dislike the drawing",

  // Canvas (web loader)
  canvasLoading: "Loading the canvas...",
} as const;
