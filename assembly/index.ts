import {
  logging,
  context,
  PersistentSet,
  ContractPromiseBatch,
  u128,
} from "near-sdk-core";
import { Game, games, latestGames, myGamesInProgress, RULES } from "./model";
import { Sha256 } from "./util/sha256";
import { bin2hex } from "./util/util";
import { EMIT_GAME_CREATED } from "./events/gameCreated";

/**
 * @TODO
 * - Check if contract has enough balance to execute
 * - Check if sender / signer is really the user it should be
 * - How to publish events from AssemblyScript?
 */
export class Contract {
  createGame(gamePin: string): void {
    assert(!games.contains(gamePin), "Provided pin is already in use");

    const game = new Game(gamePin, context.sender, "", context.attachedDeposit);
    games.set(gamePin, game);
    latestGames.add(gamePin);

    const p1Games =
      myGamesInProgress.get(context.sender) ||
      new PersistentSet<string>(`my-games-${context.sender}`);
    if (p1Games) {
      p1Games.add(game.pin);
      myGamesInProgress.set(context.sender, p1Games);
    }

    EMIT_GAME_CREATED(gamePin);
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

    const p2Games =
      myGamesInProgress.get(context.sender) ||
      new PersistentSet<string>(`my-games-${context.sender}`);
    if (p2Games) {
      p2Games.add(game.pin);
      myGamesInProgress.set(context.sender, p2Games);
    }
  }

  getGames(): Game[] {
    const res: Game[] = [];
    for (let i = 0; i < latestGames.values().length; i++) {
      res.push(games.getSome(latestGames.values()[i]));
    }
    return res;
  }

  getMyGamesInProgress(accountId: string): Game[] {
    assert(!!accountId, "You must provide an account ID");

    const gamePins = myGamesInProgress.get(accountId);

    if (!gamePins) {
      return [];
    }

    let gamesInProgress = new Array<Game>();
    for (let index = 0; index < gamePins.values().length; index++) {
      const gamePin = gamePins.values()[index];
      gamesInProgress.push(games.getSome(gamePin));
    }

    return gamesInProgress;
  }

  getGameByPin(gamePin: string): Game {
    assert(!!gamePin && games.contains(gamePin), "Game not found");

    return games.getSome(gamePin);
  }

  play(gamePin: string, moveHash: string): void {
    const game = this.getGameByPin(gamePin);

    assert(!!game, "Game not found");

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
        game.winner = "p1";
        ContractPromiseBatch.create(game.p1).transfer(
          u128.add(game.deposit, game.deposit)
        );
      } else {
        game.winner = "p2";
        ContractPromiseBatch.create(game.p2).transfer(
          u128.add(game.deposit, game.deposit)
        );
      }

      logging.log(`Winner is ${game.winner}`);

      games.set(gamePin, game);
    }
  }
}
