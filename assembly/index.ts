import { u128 } from "near-sdk-as";
import { logging, context, PersistentVector } from "near-sdk-core";
import { Sha256 } from "./sha256";
import { bin2hex } from "./util";

const RULES: Map<string, boolean> = new Map<string, boolean>();
RULES.set("rock-scissors", true);
RULES.set("rock-paper", false);
RULES.set("scissors-rock", false);
RULES.set("scissors-paper", true);
RULES.set("paper-scissors", false);
RULES.set("paper-rock", true);

@nearBindgen
class Game {
  p1Hash: string;
  p2Hash: string;
  p1Raw: string;
  p2Raw: string;
  winner: string;

  constructor(public p1: string, public p2: string, public deposit: u128) {}
}
/**
 * @TODO
 * - Check if contract has enough balance to execute
 * - Check if sender / signer is really the user it should be
 */
export class Contract {
  private games: PersistentVector<Game> = new PersistentVector<Game>("g");

  createGame(): void {
    const game = new Game(context.sender, "", context.attachedDeposit);
    this.games.push(game);
  }

  joinGame(gameIndex: i32): void {
    assert(gameIndex >= 0 && gameIndex < this.games.length, "Game not found");

    const game = this.games[gameIndex];

    assert(!game.p2, "This game already has two players");
    assert(game.p1 != context.sender, "You can not play against yourself");

    const requiredDeposit = game.deposit;

    assert(
      context.attachedDeposit == requiredDeposit,
      `Deposit value not correct. Expected: ${requiredDeposit}, got: ${context.attachedDeposit}`
    );

    const updatedGame = new Game(
      game.p1,
      context.sender,
      context.attachedDeposit
    );

    this.games.replace(gameIndex, updatedGame);
  }

  getGames(): Game[] {
    const res: Game[] = [];
    for (let i = 0; i < this.games.length; i++) {
      res.push(this.games[i]);
    }
    return res;
  }

  getGameByIndex(gameIndex: i32): Game {
    assert(gameIndex >= 0 && gameIndex < this.games.length, "Game not found");

    return this.games[gameIndex];
  }

  getAvailableGames(): Game[] {
    const maxNumberOfGames = 5;
    const availableGames = new Array<Game>();

    let limit = min(maxNumberOfGames, this.games.length);
    let i = limit - 1;
    let foundEnoughGames = false;

    while (!foundEnoughGames && i >= 0) {
      const potentialAvailableGame = this.games[i];

      if (!potentialAvailableGame.p2) {
        availableGames.push(potentialAvailableGame);
      }

      if (availableGames.length >= limit) {
        foundEnoughGames = true;
      }

      i--;
    }

    return availableGames;
  }

  play(gameIndex: i32, moveHash: string): void {
    const game = this.getGameByIndex(gameIndex);

    if (game.p1 == context.sender) {
      assert(!game.p1Hash, "You already played");
      game.p1Hash = moveHash;
    }

    if (game.p2 == context.sender) {
      assert(!game.p2Hash, "You already played");
      game.p2Hash = moveHash;
    }

    if (game.p1Hash && game.p2Hash) {
      logging.log(`game ${gameIndex} ready for reveal phase`);
    }

    this.games.replace(gameIndex, game);
  }

  reveal(gameIndex: i32, moveRaw: string): void {
    const game = this.getGameByIndex(gameIndex);

    assert(
      game.p1Hash && game.p2Hash,
      "You can not reveal your move because the play phase is not finished yet"
    );

    if (game.p1 == context.sender) {
      assert(!game.p1Raw, "You already revealed your move");
    }

    if (game.p2 == context.sender) {
      assert(!game.p2Raw, "You already revealed your move");
    }

    if (game.p1 == context.sender) {
      const buffer = Sha256.hash(Uint8Array.wrap(String.UTF8.encode(moveRaw)));
      const p1TestHash = bin2hex(buffer);

      assert(
        p1TestHash == game.p1Hash,
        "Hashed value and raw value do not match for p1"
      );

      game.p1Raw = moveRaw;
    }

    if (game.p2 == context.sender) {
      const buffer = Sha256.hash(Uint8Array.wrap(String.UTF8.encode(moveRaw)));
      const p2TestHash = bin2hex(buffer);

      assert(
        p2TestHash == game.p2Hash,
        "Hashed value and raw value do not match for p2"
      );

      game.p2Raw = moveRaw;
    }

    this.games.replace(gameIndex, game);

    // If both players revealed their moves, determine the winner
    if (game.p1Raw && game.p2Raw) {
      const p1Move: string = game.p1Raw.split("-")[0];
      const p2Move: string = game.p2Raw.split("-")[0];

      assert(
        ["rock", "paper", "scissors"].includes(p1Move),
        "p1 move not valid"
      );
      assert(
        ["rock", "paper", "scissors"].includes(p2Move),
        "p2 move not valid"
      );

      if (p1Move == p2Move) {
        // We have a draw
        // Transfer back the deposits?
        return;
      }

      assert(RULES.has(`${p1Move}-${p2Move}`), "Invalid move combination");

      const p1Won: boolean = RULES.get(`${p1Move}-${p2Move}`);

      if (p1Won) {
        // transfer 2x deposit to p1
        game.winner = "p1";
      } else {
        // transfer 2x deposit to p2
        game.winner = "p2";
      }

      logging.log(`Winner is ${game.winner}`);

      this.games.replace(gameIndex, game);
    }
  }
}
