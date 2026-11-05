// Spanish text: "common" namespace.
import type { Catalog } from "../index.ts";

export const common: Catalog["common"] = {
  resource: {
    brick: "Ladrillo",
    grain: "Grano",
    lumber: "Madera",
    ore: "Mineral",
    wool: "Lana",
  },
  devCard: {
    knight: "Caballero",
    roadBuilding: "Construcción de carreteras",
    yearOfPlenty: "Año de abundancia",
    monopoly: "Monopolio",
    victoryPoint: "Punto de victoria",
  },
  alerts: {
    push: {
      title: {
        turn: "Tu turno — sala {{room}}",
        setup: "Tu turno — sala {{room}}",
        rollForOrder: "Tira para el orden — sala {{room}}",
        discard: "Descarta — sala {{room}}",
      },
      body: {
        turn: "Tira los dados.",
        setup: "Coloca tu poblado y tu camino.",
        rollForOrder: "Tira para decidir quién empieza.",
        discard: "Descarta la mitad de tus cartas.",
      },
    },
  },
};
