// Ajustes (specs/client-settings).
import type { Catalog } from "../index.ts";

export const settings: Catalog["settings"] = {
  open: "Ajustes",
  title: "Ajustes",
  description: "Idioma, sonido, notificaciones, accesibilidad y créditos.",
  close: "Cerrar ajustes",
  sectionPicker: "Sección",
  section: {
    language: "Idioma",
    sound: "Sonido",
    notifications: "Notificaciones",
    accessibility: "Accesibilidad",
    about: "Acerca de",
  },
  language: {
    label: "Idioma",
    hint: "Cambia todos los textos al instante y se recuerda en este dispositivo.",
  },
  sound: {
    enabled: "Sonidos del juego",
    enabledHint: "Tiradas de dados y el aviso al empezar tu turno.",
    volume: "Volumen",
    test: "Probar sonido",
  },
  notifications: {
    enabled: "Avisos de turno",
    enabledHint: "Recibe un aviso cuando sea tu turno.",
    status: {
      onPush: "Activados. Recibes avisos aunque cierres la pestaña del juego.",
      onTabOnly: "Activados. Los avisos solo funcionan con la pestaña del juego abierta.",
      off: "Desactivados.",
      blocked:
        "Bloqueados por el navegador. Permite las notificaciones de este sitio en la configuración del sitio del navegador y vuelve.",
      unsupported: "Este navegador no admite notificaciones.",
    },
    iosHint: "En iPhone y iPad, añade el juego a la pantalla de inicio para recibir avisos.",
  },
  accessibility: {
    motion: "Movimiento",
    motionHint: "Controla la tirada de dados y las animaciones de cartas y tablero.",
    system: "Según el sistema",
    reduce: "Reducir movimiento",
    full: "Movimiento completo",
  },
  about: {
    version: "Versión {{version}}",
    credits: "Créditos",
    by: "de",
    otherAssets: "Otros recursos del tema: ",
    themeAssets: "Recursos del tema: ",
    procedural: "formas procedurales integradas.",
    note: "Los sonidos se sintetizan en el navegador. Hexfall es un proyecto de fans y no está afiliado a ninguna editorial de juegos de mesa.",
  },
};
