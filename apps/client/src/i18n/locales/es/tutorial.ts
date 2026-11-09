// Tutorial mode helpers and phase hints (openspec tutorial-mode-and-rules-guide, specs/tutorial-mode).
import type { Catalog } from "../index.ts";

export const tutorial: Catalog["tutorial"] = {
  ui: {
    title: "Tutorial",
    learnMore: "Saber más",
    turnOff: "Desactivar tutorial",
    collapse: "Ocultar pista",
    expand: "Mostrar pista del tutorial",
    help: "Ayuda de reglas",
    costLabel: "Coste",
  },
  settings: {
    label: "Tutorial",
    hint: "Ayudas de reglas en los botones de juego y una pista breve de qué hacer ahora.",
  },
  topic: {
    road: {
      title: "Carretera",
      body: "Construye una carretera en un camino libre. Las carreteras unen tus construcciones y llevan a nuevos sitios.",
      rules:
        "Debe tocar una de tus carreteras, poblados o ciudades.\nNo puede seguir a través de una intersección con un poblado o ciudad de otro jugador.\nUna carretera por camino; tienes 15 en total.\nUna carretera continua de 5 o más puede darte la Gran Ruta Comercial (2 PV).",
    },
    settlement: {
      title: "Poblado",
      body: "Construye un poblado en una intersección libre: 1 PV y recursos de los hexágonos que lo rodean.",
      rules:
        "Debe tocar una de tus carreteras.\nRegla de distancia: ningún poblado ni ciudad (tampoco tuyos) en las intersecciones vecinas.\nTienes 5 poblados; uno mejorado a ciudad vuelve a tu reserva.",
    },
    city: {
      title: "Ciudad",
      body: "Mejora uno de tus poblados a ciudad: 2 PV y 2 cartas de cada hexágono que produzca.",
      rules:
        "Solo sustituye a uno de tus propios poblados; nunca se construye en un sitio vacío.\nTienes 4 ciudades; el poblado vuelve a tu reserva.",
    },
    devBuy: {
      title: "Carta de desarrollo",
      body: "Roba la carta de arriba del mazo de desarrollo: un Caballero, una carta de progreso o un Punto de victoria.",
      rules:
        "No puedes jugarla el turno en que la compras (salvo los Puntos de victoria).\nNo quedan más cartas cuando se agota el mazo (25, o 34 con 5–6 jugadores).\nLas cartas de desarrollo nunca se comercian.",
    },
    knight: {
      title: "Caballero",
      body: "Mueve el ladrón a otro hexágono y roba 1 carta al azar a un rival con una construcción junto a él.",
      rules:
        "Nadie descarta: eso solo ocurre al sacar un 7.\nPuedes jugarlo antes de tirar, por ejemplo para quitar el ladrón de tu hexágono.\nLos Caballeros jugados quedan boca arriba: el primero con 3 consigue el Gran Ejército (2 PV), y quien tenga más se lo lleva.\nUna carta de desarrollo por turno, y no el turno en que la compraste.",
    },
    roadBuilding: {
      title: "Construcción de carreteras",
      body: "Coloca 2 carreteras gratis, siguiendo las reglas normales de las carreteras.",
      rules:
        "La segunda puede conectar con la primera.\nSi te quedan menos de 2 carreteras o no hay camino válido, colocas las que puedas.\nUna carta de desarrollo por turno, y no el turno en que la compraste.",
    },
    yearOfPlenty: {
      title: "Año de abundancia",
      body: "Toma 2 cartas de recurso cualesquiera de la banca, iguales o distintas.",
      rules:
        "Solo lo que le quede a la banca.\nPuedes usarlas este turno.\nUna carta de desarrollo por turno, y no el turno en que la compraste.",
    },
    monopoly: {
      title: "Monopolio",
      body: "Nombra un recurso: todos los demás jugadores te dan todas sus cartas de ese tipo.",
      rules:
        "Quien no tenga ninguna no da nada.\nUna carta de desarrollo por turno, y no el turno en que la compraste.",
    },
    victoryPoint: {
      title: "Punto de victoria",
      body: "Vale 1 PV y se guarda oculta en tu mano.",
      rules:
        "Los demás solo la ven cuando se revela.\nEn tu turno puedes revelarlas solo si así llegas a la meta de puntos y ganas, incluso el turno en que las compraste.\nNo cuenta para el límite de una carta por turno.",
    },
    roll: {
      title: "Tirar los dados",
      body: "Los dos dados: cada hexágono con ese número paga a las construcciones que lo rodean, 1 carta por poblado y 2 por ciudad, a todos los jugadores.",
      rules:
        "Obligatorio, exactamente una vez por turno, antes de comerciar y construir.\nPuedes jugar un Caballero antes de tirar.\nEl hexágono del ladrón no produce nada.\nUn 7 no produce nada y mueve el ladrón.\nSi a la banca le falta un recurso, nadie lo recibe, salvo que solo se le deba a un jugador: ese se lleva lo que quede.",
    },
    endTurn: {
      title: "Terminar turno",
      body: "Acaba tu turno; juega el jugador de tu izquierda.",
      rules:
        "Tienes que tirar antes de terminar el turno.\nGanas en cuanto alcanzas la meta de puntos en tu propio turno.",
    },
    maritime: {
      title: "Comerciar con la banca",
      body: "Cambia cartas iguales por 1 carta de otro tipo, en tu turno, tantas veces como quieras.",
      rules:
        "El 4:1 siempre está disponible.\n3:1 con un puerto genérico.\n2:1 solo para el recurso de un puerto especial; no mejora el cambio de otros recursos.\nUn poblado o ciudad en cualquier extremo del camino del puerto te da ese puerto, usable el turno en que lo construyes.\nLa banca debe tener la carta que pides.",
    },
    trade: {
      title: "Comerciar con jugadores",
      body: "Ofrece cartas a otros jugadores; pueden aceptar, rechazar o contraofertar.",
      rules:
        "Solo en el turno del jugador activo, y el jugador activo participa en todo intercambio.\nNada de regalos: cada lado da al menos una carta.\nEl mismo recurso no puede estar en los dos lados.\nLas cartas de desarrollo no se comercian.",
    },
    robber: {
      title: "Ladrón",
      body: "Mueve el ladrón a otro hexágono y roba 1 carta al azar a un rival con un poblado o ciudad junto a él.",
      rules:
        "Tiene que moverse: dejarlo donde está no vale; el desierto sí.\nSi hay varios rivales posibles, eliges tú; una mano vacía no da nada.\nMientras esté allí, ese hexágono no produce nada.",
    },
    discard: {
      title: "Descartar",
      body: "Ha salido un 7: quien tenga más de 7 cartas descarta la mitad, redondeando hacia abajo.",
      rules:
        "8 cartas: descarta 4; 9: 4; 11: 5.\nTú eliges las cartas; vuelven a la banca.\nTodos descartan antes de que se mueva el ladrón.",
    },
  },
  blocker: {
    notYourTurn: "No es tu turno.",
    rollFirst: "Tira los dados primero.",
    cards: "Necesitas {{cards}}.",
    cardsToTrade: "No tienes cartas suficientes para comerciar.",
    pieces: "No te quedan piezas de este tipo.",
    deckEmpty: "El mazo de desarrollo está vacío.",
    boughtThisTurn: "La compraste este turno: juégala a partir del siguiente.",
    alreadyPlayed: "Ya jugaste una carta de desarrollo este turno.",
    finishStep: "Termina primero el paso actual.",
    notNow: "Ahora no se puede jugar.",
    noSpot: {
      road: "Ningún camino libre toca tus carreteras o construcciones.",
      settlement: "Ningún sitio libre toca tus carreteras y cumple la regla de distancia.",
      city: "No tienes ningún poblado que mejorar.",
    },
  },
  hint: {
    rollForOrder: "Tira los dados: la tirada más alta empieza la partida (los empates repiten).",
    rollForOrderWaiting: "Los jugadores tiran para decidir quién empieza.",
    setupSettlement1:
      "Coloca tu primer poblado en cualquier intersección libre. Regla de distancia: ninguna construcción en una intersección vecina.",
    setupRoad1: "Coloca una carretera que toque el poblado que acabas de poner.",
    setupSettlement2:
      "Coloca tu segundo poblado (no hace falta que conecte con el primero). Recibes 1 carta de cada hexágono que lo rodea.",
    setupRoad2: "Coloca una carretera que toque tu segundo poblado.",
    setupWaiting:
      "Otro jugador está colocando. La ronda 1 va en sentido horario; la ronda 2 vuelve en sentido contrario.",
    rollFirst:
      "Tu turno: tira los dados. Puedes jugar antes un Caballero para mover el ladrón antes de la producción.",
    main: "Comercia y construye en cualquier orden: carreteras, poblados, ciudades, cartas de desarrollo. Termina el turno cuando acabes.",
    waiting:
      "Turno de otro jugador. Puedes comerciar con él si te lo pide; no puedes comerciar con los demás.",
    discard_one:
      "Un 7: tienes más de 7 cartas, así que descarta {{count}} carta (la mitad, redondeando hacia abajo).",
    discard_other:
      "Un 7: tienes más de 7 cartas, así que descarta {{count}} cartas (la mitad, redondeando hacia abajo).",
    discardWaiting: "Ha salido un 7: quien tenga más de 7 cartas descarta la mitad.",
    robberSeven: "Mueve el ladrón a otro hexágono y roba 1 carta al azar a un rival adyacente.",
    robberKnight:
      "Caballero: mueve el ladrón a otro hexágono y roba 1 carta al azar a un rival adyacente. Nadie descarta.",
    robberWaiting: "El ladrón se está moviendo: el hexágono donde caiga deja de producir.",
    roadBuilding_one: "Construcción de carreteras: coloca {{count}} carretera gratis más.",
    roadBuilding_other: "Construcción de carreteras: coloca {{count}} carreteras gratis.",
    roadBuildingWaiting:
      "Otro jugador está colocando carreteras gratis de Construcción de carreteras.",
    specialBuild:
      "Tu turno de construcción: puedes construir o comprar una carta de desarrollo, pero no comerciar ni jugar cartas. Pulsa Terminar de construir al acabar.",
    specialBuildWaiting: "Otro jugador está en su turno de construcción. El tuyo llegará en orden.",
  },
};
