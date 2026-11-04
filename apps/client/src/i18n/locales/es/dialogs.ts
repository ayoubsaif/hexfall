// Spanish text: "dialogs" namespace.
import type { Catalog } from "../index.ts";

export const dialogs: Catalog["dialogs"] = {
  stepper: {
    less: "Quitar 1 de {{resource}}",
    more: "Añadir 1 de {{resource}}",
    youHave: "tienes {{count}}",
    bankHas: "la banca tiene {{count}}",
  },
  discard: {
    title_one: "Descarta {{count}} carta",
    title_other: "Descarta {{count}} cartas",
    description: "Ha salido un 7 y tienes más de 7 cartas. Elegidas: {{picked}} de {{owed}}.",
    confirm: "Descartar",
  },
  yearOfPlenty: {
    title: "Año de abundancia",
    description_one: "Toma {{count}} carta de la banca.",
    description_other: "Toma {{count}} cartas de la banca.",
    confirm: "Tomar cartas",
  },
  monopoly: {
    title: "Monopolio",
    description: "Elige un recurso. Los demás jugadores te dan todas las cartas que tengan de él.",
    group: "Recurso que reclamas",
  },
  victim: {
    title: "Elige a quién robar",
    cards_one: "{{count}} carta",
    cards_other: "{{count}} cartas",
    pickAnother: "Elegir otra casilla",
  },
  cancel: "Cancelar",
  maritime: {
    title: "Comercio marítimo con la banca",
    give: "Dar",
    get: "Recibir",
    giveLabel: "Dar {{resource}}, {{rate}}:1, tienes {{count}}",
    getLabel: "Recibir {{resource}}, la banca tiene {{count}}",
    have: "tienes {{count}}",
    bank: "banca {{count}}",
    howMany: "Cuántas recibir",
    summary: "Das {{giveCount}} de {{give}} por {{getCount}} de {{get}}.",
    impossible: "No es posible con tus cartas y las existencias de la banca.",
    atMost: "Puedes recibir como máximo {{max}}.",
    close: "Cerrar",
    trade: "Comerciar",
  },
  feed: {
    log: "Registro de la partida",
    empty: "Aún no hay eventos.",
    dismiss: "Cerrar aviso",
    gameOver: "Fin de la partida",
    wins: "¡{{name}} gana!",
    player: "Jugador",
    vp: "PV",
    hiddenVp_one: "(incl. {{count}} carta de PV)",
    hiddenVp_other: "(incl. {{count}} cartas de PV)",
    backToStart: "Volver al inicio",
  },
};
