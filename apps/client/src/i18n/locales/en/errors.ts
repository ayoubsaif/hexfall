// English text: "errors" namespace (source of truth for keys). Plain words for server
// error codes; `satisfies` keeps every code covered.
import type { RuleErrorCode } from "@hexfall/engine";
import type { ErrorCode } from "@hexfall/protocol";

export const errors = {
  room: {
    bad_frame: "The server could not read that request.",
    version_mismatch: "This page is out of date. Please reload.",
    internal: "Something went wrong on the server. Please try again.",
    bad_name: "That name is invalid or already taken in this room.",
    room_not_found: "There is no room with that code.",
    room_full: "That room is full.",
    game_started: "That game has already started.",
    not_host: "Only the host can do that.",
    not_enough_players: "3 to 6 players are needed to start.",
    not_a_bot: "That seat is not a bot.",
    bad_avatar: "That avatar does not exist.",
    avatar_taken: "Another player already has that avatar.",
    bad_token: "Your seat could not be restored.",
    no_seat: "You are not seated in a game.",
    already_in_room: "You are already in a room.",
    unavailable: "The server is busy right now. Please try again in a moment.",
    rate_limited: "Too many requests. Slow down a little.",
    game_paused: "The host paused the game.",
    not_paused: "The game is not paused.",
    not_playing: "The game is not running.",
  } as const satisfies Record<ErrorCode, string>,
  rule: {
    invalid_config: "That game setup is not valid.",
    invalid_action: "That move is not valid.",
    game_over: "The game is over.",
    not_your_turn: "It is not your turn.",
    wrong_phase: "That move is not possible right now.",
    must_roll_first: "Roll the dice first.",
    already_rolled: "You already rolled this turn.",
    illegal_placement: "You cannot build there.",
    insufficient_resources: "You do not have enough resources.",
    no_pieces: "You have no pieces of that kind left.",
    invalid_discard: "That discard is not valid.",
    illegal_robber_hex: "The robber cannot go there.",
    illegal_victim: "You cannot rob that player.",
    deck_empty: "The development card deck is empty.",
    card_not_playable: "You cannot play that card now.",
    dev_card_already_played: "You already played a development card this turn.",
    cannot_reveal: "You can reveal Victory Point cards only to win.",
    invalid_trade: "That trade is not valid.",
    unknown_offer: "That trade offer is gone.",
    bank_empty: "The bank does not have those cards.",
    not_allowed_in_special_build:
      "In a building window you can only build, buy development cards or pass.",
  } as const satisfies Record<RuleErrorCode, string>,
} as const;
