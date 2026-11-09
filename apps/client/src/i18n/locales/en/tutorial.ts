// Tutorial mode helpers and phase hints (openspec tutorial-mode-and-rules-guide, specs/tutorial-mode).
// Text follows AGENTS.md (base rules only). `rules` lines are separated by "\n" and shown as a list.
export const tutorial = {
  ui: {
    title: "Tutorial",
    learnMore: "Learn more",
    turnOff: "Turn off tutorial",
    collapse: "Hide hint",
    expand: "Show tutorial hint",
    help: "Rules help",
    costLabel: "Cost",
  },
  settings: {
    label: "Tutorial",
    hint: "Rule helpers on the game buttons and a short hint for what to do now.",
  },
  topic: {
    // AGENTS.md §7a
    road: {
      title: "Road",
      body: "Build a road on an empty path. Roads connect your buildings and lead to new building spots.",
      rules:
        "Must touch one of your roads, settlements or cities.\nCan't continue through an intersection with another player's settlement or city.\nOne road per path; you have 15 in all.\nA continuous road of 5 or more can earn Longest Road (2 VP).",
    },
    // §7b
    settlement: {
      title: "Settlement",
      body: "Build a settlement on an empty intersection: 1 VP, and resources from the hexes around it.",
      rules:
        "Must touch one of your roads.\nDistance Rule: no settlement or city (yours included) on any neighbouring intersection.\nYou have 5 settlements; one upgraded to a city returns to your supply.",
    },
    // §7c
    city: {
      title: "City",
      body: "Upgrade one of your settlements to a city: 2 VP, and 2 cards from each producing hex.",
      rules:
        "Only replaces one of your own settlements; never built on an empty spot.\nYou have 4 cities; the settlement goes back to your supply.",
    },
    // §7d
    devBuy: {
      title: "Development card",
      body: "Draw the top card of the development deck: a Knight, a Progress card or a Victory Point card.",
      rules:
        "You can't play it on the turn you buy it (Victory Point cards excepted).\nNo more cards once the deck (25, or 34 with 5–6 players) is empty.\nDevelopment cards can never be traded.",
    },
    // §9b
    knight: {
      title: "Knight",
      body: "Move the robber to a different hex and steal 1 random card from an opponent with a building next to it.",
      rules:
        "Nobody discards: that only happens on a rolled 7.\nYou may play it before rolling, e.g. to move the robber off your hex.\nPlayed Knights stay face up: the first player with 3 gets Largest Army (2 VP), and someone with more takes it.\nOne development card per turn, and not on the turn you bought it.",
    },
    // §9d
    roadBuilding: {
      title: "Road Building",
      body: "Place 2 roads for free, following the normal road rules.",
      rules:
        "The second road may connect to the first.\nWith fewer than 2 roads left or no legal path, you place what you can.\nOne development card per turn, and not on the turn you bought it.",
    },
    yearOfPlenty: {
      title: "Year of Plenty",
      body: "Take any 2 resource cards from the bank, the same or different.",
      rules:
        "Only what the bank still has.\nYou can use them this turn.\nOne development card per turn, and not on the turn you bought it.",
    },
    monopoly: {
      title: "Monopoly",
      body: "Name one resource: every other player gives you all their cards of that type.",
      rules:
        "Players with none give nothing.\nOne development card per turn, and not on the turn you bought it.",
    },
    // §9c
    victoryPoint: {
      title: "Victory Point",
      body: "Worth 1 VP, kept hidden in your hand.",
      rules:
        "Others only see it once it is revealed.\nOn your turn you may reveal them only when that brings you to the victory target and wins, even on the turn you bought them.\nIt doesn't count toward the one-card-per-turn limit.",
    },
    // §5, §6
    roll: {
      title: "Roll the dice",
      body: "Both dice: every hex with that number pays the buildings around it, 1 card per settlement and 2 per city, for every player.",
      rules:
        "Mandatory, exactly once per turn, before trading and building.\nYou may play a Knight before rolling.\nThe robber's hex produces nothing.\nA 7 produces nothing and moves the robber.\nIf the bank runs short of a resource, nobody gets it, unless only one player is owed it: they take what is left.",
    },
    endTurn: {
      title: "End turn",
      body: "Finish your turn; the player to your left plays next.",
      rules:
        "You must roll before ending your turn.\nYou win at once when you reach the victory target on your own turn.",
    },
    // §11b
    maritime: {
      title: "Trade with the bank",
      body: "Swap identical cards for 1 card of another type, on your turn, as often as you like.",
      rules:
        "4:1 is always available.\n3:1 with a generic harbor.\n2:1 only for the resource of a special harbor; it gives no better rate for other resources.\nA settlement or city on either end of the harbor's path gives you that harbor, usable the turn you build it.\nThe bank must have the card you want.",
    },
    // §11a
    trade: {
      title: "Trade with players",
      body: "Offer cards to other players; they can accept, reject or counter.",
      rules:
        "Only on the active player's turn, and the active player takes part in every trade.\nNo gifts: both sides give at least one card.\nThe same resource can't be on both sides.\nDevelopment cards can't be traded.",
    },
    // §8 steps 2–3
    robber: {
      title: "Robber",
      body: "Move the robber to a different hex, then steal 1 random card from an opponent with a settlement or city next to it.",
      rules:
        "It must move: leaving it in place is not allowed; the desert is fine.\nIf several opponents qualify, you choose; an empty hand gives nothing.\nWhile it sits there, that hex produces nothing.",
    },
    // §8 step 1
    discard: {
      title: "Discard",
      body: "A 7 was rolled: everyone with more than 7 cards discards half, rounded down.",
      rules:
        "8 cards: discard 4; 9: 4; 11: 5.\nYou choose the cards; they go back to the bank.\nAll discards happen before the robber moves.",
    },
  },
  blocker: {
    notYourTurn: "It's not your turn.",
    rollFirst: "Roll the dice first.",
    cards: "You need {{cards}}.",
    cardsToTrade: "You don't have enough cards to trade.",
    pieces: "No pieces of this kind left.",
    deckEmpty: "The development deck is empty.",
    boughtThisTurn: "You bought it this turn: play it from your next turn.",
    alreadyPlayed: "You already played a development card this turn.",
    finishStep: "Finish the current step first.",
    notNow: "It can't be played right now.",
    noSpot: {
      road: "No free path touches your roads or buildings.",
      settlement: "No free spot touches your roads and keeps the Distance Rule.",
      city: "You have no settlement to upgrade.",
    },
  },
  hint: {
    rollForOrder: "Roll the dice: the highest roll starts the game (ties roll again).",
    rollForOrderWaiting: "The players are rolling to decide who starts.",
    setupSettlement1:
      "Place your first settlement on any free intersection. Distance Rule: no building on a neighbouring intersection.",
    setupRoad1: "Place a road touching the settlement you just placed.",
    setupSettlement2:
      "Place your second settlement (it need not connect to the first). You get 1 card from each hex around it.",
    setupRoad2: "Place a road touching your second settlement.",
    setupWaiting:
      "Another player is placing. Round 1 goes clockwise; round 2 comes back the other way.",
    rollFirst:
      "Your turn: roll the dice. You may play a Knight first to move the robber before production.",
    main: "Trade and build in any order: roads, settlements, cities, development cards. End your turn when done.",
    waiting:
      "Another player's turn. You may trade with them if they ask; you can't trade with others.",
    discard_one: "A 7: you hold more than 7 cards, so discard {{count}} card (half, rounded down).",
    discard_other:
      "A 7: you hold more than 7 cards, so discard {{count}} cards (half, rounded down).",
    discardWaiting: "A 7 was rolled: players with more than 7 cards discard half.",
    robberSeven:
      "Move the robber to a different hex, then steal 1 random card from an adjacent opponent.",
    robberKnight:
      "Knight: move the robber to a different hex and steal 1 random card from an adjacent opponent. Nobody discards.",
    robberWaiting: "The robber is moving: the hex it lands on stops producing.",
    roadBuilding_one: "Road Building: place {{count}} more free road.",
    roadBuilding_other: "Road Building: place {{count}} free roads.",
    roadBuildingWaiting: "Another player is placing free roads from Road Building.",
    specialBuild:
      "Your building window: you may build or buy a development card, but not trade or play cards. Press Done building when finished.",
    specialBuildWaiting: "Another player is using their building window. Yours comes in turn.",
  },
};
