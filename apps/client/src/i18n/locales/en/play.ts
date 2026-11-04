// English text: "play" namespace (source of truth for keys). In-game HUD controls: player
// panels, status pill, your-turn focus, action buttons, hand, development cards and dice.
export const play = {
  panels: {
    players: "Players",
    you: "you",
    offline: "offline",
    stat: {
      vp: "VP",
      vpShort: "VP",
      cards: "Cards",
      cardsShort: "Crd",
      dev: "Dev",
      devShort: "Dev",
      knights: "Knights",
      knightsShort: "Kn",
    },
    longestRoad: "Longest Road",
    largestArmy: "Largest Army",
    hiddenTitle: "Only you can see this",
    hiddenVp: "{{vp}} VP with hidden cards",
  },
  pill: {
    pickSpot: "Pick a spot on the board.",
    cancel: "Cancel",
  },
  focus: {
    yourTurn: "Your turn",
    rollForOrder: "Roll for order",
    notYet: "Not yet",
  },
  actions: {
    group: "Turn actions",
    buildRoad: "Build road",
    buildSettlement: "Build settlement",
    buildCity: "Build city",
    buyDevCard: "Buy development card",
    tradeBank: "Trade with bank",
    endTurn: "End turn",
    costs: "Costs {{cost}}",
    costItem: "{{count}} {{resource}}",
    left: {
      roads: "{{count}} roads left",
      settlements: "{{count}} settlements left",
      cities: "{{count}} cities left",
    },
  },
  hand: {
    label: "Your hand",
  },
  dev: {
    revealToWin: "Reveal to win",
    play: "Play {{card}}",
    playHeld: "Play {{card}}, {{count}} held",
    boughtThisTurn: "Bought this turn: playable from your next turn.",
    notPlayable: "Not playable right now.",
  },
  card: {
    withCount: "{{name}}, {{count}}",
  },
  dice: {
    noRoll: "No roll yet this turn",
    rolled: "Rolled {{a}} and {{b}}, total {{total}}",
    rollDice: "Roll dice",
    rollForOrder: "Roll for order",
  },
} as const;
