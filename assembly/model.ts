import { PersistentMap, PersistentSet, u128 } from "near-sdk-as";

export const RULES: Map<string, boolean> = new Map<string, boolean>();
RULES.set("rock-scissors", true);
RULES.set("rock-paper", false);
RULES.set("scissors-rock", false);
RULES.set("scissors-paper", true);
RULES.set("paper-scissors", false);
RULES.set("paper-rock", true);

@nearBindgen
export class Game {
  p1Hash: string;
  p2Hash: string;
  p1Raw: string;
  p2Raw: string;
  winner: string;

  constructor(
    public pin: string,
    public p1: string,
    public p2: string,
    public deposit: u128
  ) {}
}

export const latestGames: PersistentSet<string> = new PersistentSet<string>(
  "lg"
);
export const games: PersistentMap<string, Game> = new PersistentMap<
  string,
  Game
>("g");

export const myGamesInProgress: PersistentMap<
  string,
  PersistentSet<string>
> = new PersistentMap<string, PersistentSet<string>>("gip");
