// All catalogs. English is the source of truth: every other catalog is typed
// `Catalog`, so a missing or extra key is a type error. Each namespace file has one owner.
import { board as enBoard } from "./en/board.ts";
import { common as enCommon } from "./en/common.ts";
import { dialogs as enDialogs } from "./en/dialogs.ts";
import { errors as enErrors } from "./en/errors.ts";
import { game as enGame } from "./en/game.ts";
import { play as enPlay } from "./en/play.ts";
import { session as enSession } from "./en/session.ts";
import { rules as enRules } from "./en/rules.ts";
import { settings as enSettings } from "./en/settings.ts";
import { tutorial as enTutorial } from "./en/tutorial.ts";
import { board as esBoard } from "./es/board.ts";
import { common as esCommon } from "./es/common.ts";
import { dialogs as esDialogs } from "./es/dialogs.ts";
import { errors as esErrors } from "./es/errors.ts";
import { game as esGame } from "./es/game.ts";
import { play as esPlay } from "./es/play.ts";
import { session as esSession } from "./es/session.ts";
import { rules as esRules } from "./es/rules.ts";
import { settings as esSettings } from "./es/settings.ts";
import { tutorial as esTutorial } from "./es/tutorial.ts";
import type { Language } from "../language.ts";
import type { DeepString } from "./types.ts";

export const en = {
  common: enCommon,
  game: enGame,
  errors: enErrors,
  board: enBoard,
  session: enSession,
  play: enPlay,
  dialogs: enDialogs,
  settings: enSettings,
  tutorial: enTutorial,
  rules: enRules,
} as const;

export type Catalog = DeepString<typeof en>;

export const es: Catalog = {
  common: esCommon,
  game: esGame,
  errors: esErrors,
  board: esBoard,
  session: esSession,
  play: esPlay,
  dialogs: esDialogs,
  settings: esSettings,
  tutorial: esTutorial,
  rules: esRules,
};

export const CATALOGS: Readonly<Record<Language, Catalog>> = { en, es };
