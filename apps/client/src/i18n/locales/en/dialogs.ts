// English text: "dialogs" namespace (source of truth for keys). Modal choices
// (discard, Year of Plenty, Monopoly, robber victim), bank trade, and the feed
// (event log, toasts, rejection message, game over).
export const dialogs = {
  stepper: {
    less: "One less {{resource}}",
    more: "One more {{resource}}",
    youHave: "you have {{count}}",
    bankHas: "bank has {{count}}",
  },
  discard: {
    title_one: "Discard {{count}} card",
    title_other: "Discard {{count}} cards",
    description: "A 7 was rolled and you hold more than 7 cards. Chosen: {{picked}} of {{owed}}.",
    confirm: "Discard",
  },
  yearOfPlenty: {
    title: "Year of Plenty",
    description_one: "Take {{count}} card from the bank.",
    description_other: "Take {{count}} cards from the bank.",
    confirm: "Take cards",
  },
  monopoly: {
    title: "Monopoly",
    description: "Name a resource. Every other player gives you all of theirs.",
    group: "Resource to claim",
  },
  victim: {
    title: "Choose who to rob",
    cards_one: "{{count}} card",
    cards_other: "{{count}} cards",
    pickAnother: "Pick another hex",
  },
  cancel: "Cancel",
  maritime: {
    title: "Trade with the bank",
    give: "Give",
    get: "Get",
    giveLabel: "Give {{resource}}, {{rate}}:1, you have {{count}}",
    getLabel: "Get {{resource}}, bank has {{count}}",
    have: "have {{count}}",
    bank: "bank {{count}}",
    howMany: "How many to get",
    summary: "Give {{giveCount}} {{give}} for {{getCount}} {{get}}.",
    impossible: "Not possible with your cards and the bank's stock.",
    atMost: "You can get at most {{max}}.",
    close: "Close",
    trade: "Trade",
  },
  feed: {
    log: "Game log",
    empty: "No events yet.",
    dismiss: "Dismiss",
    gameOver: "Game over",
    wins: "{{name}} wins!",
    player: "Player",
    vp: "VP",
    hiddenVp_one: "(incl. {{count}} VP card)",
    hiddenVp_other: "(incl. {{count}} VP cards)",
    backToStart: "Back to start",
  },
} as const;
