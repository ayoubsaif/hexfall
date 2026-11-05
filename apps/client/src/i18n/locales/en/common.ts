// English text: "common" namespace (source of truth for keys). Shared words used
// across the HUD: resource and development card names, push notification text.
export const common = {
  resource: {
    brick: "Brick",
    grain: "Grain",
    lumber: "Lumber",
    ore: "Ore",
    wool: "Wool",
  },
  devCard: {
    knight: "Knight",
    roadBuilding: "Road Building",
    yearOfPlenty: "Year of Plenty",
    monopoly: "Monopoly",
    victoryPoint: "Victory Point",
  },
  alerts: {
    push: {
      title: {
        turn: "Your turn — room {{room}}",
        setup: "Your turn — room {{room}}",
        rollForOrder: "Roll for order — room {{room}}",
        discard: "Discard — room {{room}}",
      },
      body: {
        turn: "Roll the dice.",
        setup: "Place your settlement and road.",
        rollForOrder: "Roll to decide who starts.",
        discard: "Discard half your cards.",
      },
    },
  },
} as const;
