import { logging, context } from "near-sdk-core";
import { Game, games, latestGames, RULES } from "./model";
import { Sha256 } from "./sha256";
import { bin2hex } from "./util";

/**
 * @TODO
 * - Check if contract has enough balance to execute
 * - Check if sender / signer is really the user it should be
 */
export class Contract {
  createGame(gamePin: string): void {
    assert(!games.contains(gamePin), "Provided pin is already in use");

    const game = new Game(gamePin, context.sender, "", context.attachedDeposit);
    games.set(gamePin, game);
    latestGames.add(gamePin);
  }

  joinGame(gamePin: string): void {
    assert(!!gamePin && games.contains(gamePin), "Game not found");

    const game = games.getSome(gamePin);

    assert(!game.p2, "This game already has two players");
    assert(game.p1 != context.sender, "You can not play against yourself");

    const requiredDeposit = game.deposit;

    assert(
      context.attachedDeposit == requiredDeposit,
      `Deposit value not correct. Expected: ${requiredDeposit}, got: ${context.attachedDeposit}`
    );

    const updatedGame = new Game(
      gamePin,
      game.p1,
      context.sender,
      context.attachedDeposit
    );

    games.set(gamePin, updatedGame);
    latestGames.delete(gamePin);
  }

  getGames(): Game[] {
    const res: Game[] = [];
    for (let i = 0; i < latestGames.values().length; i++) {
      res.push(games.getSome(latestGames.values()[i]));
    }
    return res;
  }

  getGameByPin(gamePin: string): Game {
    assert(!!gamePin && games.contains(gamePin), "Game not found");

    return games.getSome(gamePin);
  }

  play(gamePin: string, moveHash: string): void {
    const game = this.getGameByPin(gamePin);

    if (game.p1 == context.sender) {
      assert(!game.p1Hash, "You already played");
      game.p1Hash = moveHash;
    }

    if (game.p2 == context.sender) {
      assert(!game.p2Hash, "You already played");
      game.p2Hash = moveHash;
    }

    if (game.p1Hash && game.p2Hash) {
      logging.log(`game ${gamePin} ready for reveal phase`);
    }

    games.set(gamePin, game);
  }

  reveal(gamePin: string, moveRaw: string): void {
    const game = this.getGameByPin(gamePin);

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

    games.set(gamePin, game);

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

      games.set(gamePin, game);
    }
  }
}
