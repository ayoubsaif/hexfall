// Tutorial rule-helper topics (openspec tutorial-mode-and-rules-guide, specs/tutorial-mode
// "Rule helpers on game controls"; design decision 4). Pure data: topic id → i18n keys, cost
// and the rules guide section it belongs to. Text lives in the `tutorial` locale namespace and
// follows AGENTS.md.
import type { ResourceBundle } from "@hexfall/engine";
import { COSTS } from "@hexfall/engine/geometry";
import type { RulesSection } from "../store/rulesGuide.ts";

export const TOPICS = [
  "road",
  "settlement",
  "city",
  "devBuy",
  "knight",
  "roadBuilding",
  "yearOfPlenty",
  "monopoly",
  "victoryPoint",
  "roll",
  "endTurn",
  "maritime",
  "trade",
  "robber",
  "discard",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface TopicInfo {
  /** i18n key of the card title. */
  title: `tutorial.topic.${Topic}.title`;
  /** i18n key: what the action does. */
  body: `tutorial.topic.${Topic}.body`;
  /** i18n key: the rules that limit it, one per line ("\n"). */
  rules: `tutorial.topic.${Topic}.rules`;
  /** What it costs, if anything. */
  cost: ResourceBundle | null;
  /** Where the rules guide explains it. */
  section: RulesSection;
}

const COST: Partial<Record<Topic, ResourceBundle>> = {
  road: COSTS.road,
  settlement: COSTS.settlement,
  city: COSTS.city,
  devBuy: COSTS.devCard,
};

const SECTION: Record<Topic, RulesSection> = {
  road: "building",
  settlement: "building",
  city: "building",
  devBuy: "devCards",
  knight: "devCards",
  roadBuilding: "devCards",
  yearOfPlenty: "devCards",
  monopoly: "devCards",
  victoryPoint: "devCards",
  roll: "production",
  endTurn: "turn",
  maritime: "trading",
  trade: "trading",
  robber: "robber",
  discard: "robber",
};

export function topicInfo(topic: Topic): TopicInfo {
  return {
    title: `tutorial.topic.${topic}.title`,
    body: `tutorial.topic.${topic}.body`,
    rules: `tutorial.topic.${topic}.rules`,
    cost: COST[topic] ?? null,
    section: SECTION[topic],
  };
}

/** The rule lines of a translated `rules` text. */
export function ruleLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
