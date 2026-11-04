// Spanish text: "play" namespace.
import type { Catalog } from "../index.ts";

export const play: Catalog["play"] = {
  panels: {
    players: "Jugadores",
    you: "tú",
    offline: "desconectado",
    stat: {
      vp: "PV",
      vpShort: "PV",
      cards: "Cartas",
      cardsShort: "Crt",
      dev: "Desarrollo",
      devShort: "Des",
      knights: "Caballeros",
      knightsShort: "Cab",
    },
    longestRoad: "Gran Ruta Comercial",
    largestArmy: "Gran Ejército",
    hiddenTitle: "Solo tú puedes ver esto",
    hiddenVp: "{{vp}} PV con cartas ocultas",
  },
  pill: {
    pickSpot: "Elige un lugar en el tablero.",
    cancel: "Cancelar",
  },
  focus: {
    yourTurn: "Tu turno",
    rollForOrder: "Tira para el orden",
    notYet: "Todavía no",
  },
  actions: {
    group: "Acciones del turno",
    buildRoad: "Construir carretera",
    buildSettlement: "Construir poblado",
    buildCity: "Construir ciudad",
    buyDevCard: "Comprar carta de desarrollo",
    tradeBank: "Comerciar con la banca",
    endTurn: "Terminar turno",
    costs: "Cuesta {{cost}}",
    costItem: "{{count}} de {{resource}}",
    left: {
      roads: "Te quedan {{count}} carreteras",
      settlements: "Te quedan {{count}} poblados",
      cities: "Te quedan {{count}} ciudades",
    },
  },
  hand: {
    label: "Tu mano",
  },
  dev: {
    revealToWin: "Revelar para ganar",
    play: "Jugar {{card}}",
    playHeld: "Jugar {{card}}, tienes {{count}}",
    boughtThisTurn: "Comprada este turno: podrás jugarla desde tu próximo turno.",
    notPlayable: "No se puede jugar ahora.",
  },
  card: {
    withCount: "{{name}}, {{count}}",
  },
  dice: {
    noRoll: "Aún no se han tirado los dados este turno",
    rolled: "Dados: {{a}} y {{b}}, total {{total}}",
    rollDice: "Tirar dados",
    rollForOrder: "Tirar para el orden",
  },
};
