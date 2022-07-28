import { Worker, NEAR, NearAccount, TransactionError } from "near-workspaces";
const crypto = require("crypto");

jest.setTimeout(30 * 1000);

function sha256(message) {
  return crypto.createHash("sha256").update(message).digest("hex");
}

interface Game {
  p1: string;
  p2: string;
  deposit: string;
  p1Hash: string;
  p2Hash: string;
  p1Raw: string;
  p2Raw: string;
  winner: string;
}

let context = {} as {
  worker: Worker;
  accounts: Record<string, NearAccount>;
};

beforeEach(async () => {
  try {
    // Init the worker and start a Sandbox server
    const worker = await Worker.init();

    // deploy contract
    const root = worker.rootAccount;

    const contract = await root.devDeploy("./out/main.wasm", {
      initialBalance: NEAR.parse("30 N").toJSON(),
    });

    const alice = await root.createSubAccount("alice", {
      initialBalance: NEAR.parse("30 N").toJSON(),
    });
    const bob = await root.createSubAccount("bob", {
      initialBalance: NEAR.parse("30 N").toJSON(),
    });
    const charlie = await root.createSubAccount("charlie", {
      initialBalance: NEAR.parse("30 N").toJSON(),
    });

    // Save state for test runs, it is unique for each test
    context.worker = worker;
    context.accounts = { root, contract, alice, bob, charlie };
  } catch (error) {
    console.log(error);
  }
});

afterEach(async () => {
  // Stop Sandbox server
  await context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("has 0 games initially", async () => {
  const { contract } = context.accounts;

  const games: Game[] = await contract.view("getAvailableGames", {});
  expect(games.length === 0).toBeTruthy();
});

test("creates a game", async () => {
  const { alice, contract } = context.accounts;

  // const state = await contract.viewState();

  await alice.call(contract, "createGame", {}, { attachedDeposit: "50000000" });

  const games: Game[] = await contract.view("getAvailableGames", {});

  expect(games.length === 1).toBeTruthy();
});

test("joins a game", async () => {
  const { alice, bob, contract } = context.accounts;
  const attachedDeposit = "50000000";

  await alice.call(contract, "createGame", {}, { attachedDeposit });
  await bob.call(contract, "joinGame", { gameIndex: 0 }, { attachedDeposit });

  const availableGames: Game[] = await contract.view("getAvailableGames", {});
  const game: Game = await contract.view("getGameByIndex", { gameIndex: 0 });

  expect(availableGames.length === 0).toBeTruthy();
  expect(game.p1 === alice.accountId).toBeTruthy();
  expect(game.p2 === bob.accountId).toBeTruthy();
});

test("p1 and p2 make moves", async () => {
  const { alice, bob, contract } = context.accounts;
  const attachedDeposit = "50000000";

  await alice.call(contract, "createGame", {}, { attachedDeposit });
  await bob.call(contract, "joinGame", { gameIndex: 0 }, { attachedDeposit });

  const aliceMove = `scissors-${Math.floor(Math.random() * 10 ** 10)}`;
  const aliceHash = await sha256(aliceMove);

  const bobMove = `rock-${Math.floor(Math.random() * 10 ** 10)}`;
  const bobHash = await sha256(bobMove);

  await alice.call(contract, "play", { gameIndex: 0, moveHash: aliceHash });
  await bob.call(contract, "play", { gameIndex: 0, moveHash: bobHash });

  const game: Game = await contract.view("getGameByIndex", { gameIndex: 0 });

  expect(game.p1Hash === aliceHash).toBeTruthy();
  expect(game.p2Hash === bobHash).toBeTruthy();

  await alice.call(contract, "reveal", { gameIndex: 0, moveRaw: aliceMove });
  await bob.call(contract, "reveal", { gameIndex: 0, moveRaw: bobMove });

  const gameWithReveal: Game = await contract.view("getGameByIndex", {
    gameIndex: 0,
  });
  // console.log({ gameWithReveal });
});

test("p1 and p2 make moves - ends up in draw", async () => {
  const { alice, bob, contract } = context.accounts;
  const attachedDeposit = "50000000";

  await alice.call(contract, "createGame", {}, { attachedDeposit });
  await bob.call(contract, "joinGame", { gameIndex: 0 }, { attachedDeposit });

  const aliceMove = `scissors-${Math.floor(Math.random() * 10 ** 10)}`;
  const aliceHash = await sha256(aliceMove);

  const bobMove = `scissors-${Math.floor(Math.random() * 10 ** 10)}`;
  const bobHash = await sha256(bobMove);

  await alice.call(contract, "play", { gameIndex: 0, moveHash: aliceHash });
  await bob.call(contract, "play", { gameIndex: 0, moveHash: bobHash });

  await alice.call(contract, "reveal", { gameIndex: 0, moveRaw: aliceMove });
  await bob.call(contract, "reveal", { gameIndex: 0, moveRaw: bobMove });

  const gameWithReveal: Game = await contract.view("getGameByIndex", {
    gameIndex: 0,
  });
  console.log({ gameWithReveal });
});

test.only("p1 and p2 make moves - try to change move", async () => {
  const { alice, bob, contract } = context.accounts;
  const attachedDeposit = "50000000";

  await alice.call(contract, "createGame", {}, { attachedDeposit });
  await bob.call(contract, "joinGame", { gameIndex: 0 }, { attachedDeposit });

  const aliceMove = `scissors-${Math.floor(Math.random() * 10 ** 10)}`;
  const aliceHash = await sha256(aliceMove);
  const aliceMove2 = `paper-${Math.floor(Math.random() * 10 ** 10)}`;
  const aliceHash2 = await sha256(aliceMove2);

  const bobMove = `rock-${Math.floor(Math.random() * 10 ** 10)}`;
  const bobHash = await sha256(bobMove);

  await alice.call(contract, "play", { gameIndex: 0, moveHash: aliceHash });
  await bob.call(contract, "play", { gameIndex: 0, moveHash: bobHash });

  try {
    await alice.call(contract, "play", {
      gameIndex: 0,
      moveHash: aliceHash2,
    });
  } catch (error) {
    expect(
      (error as TransactionError).message.includes("ABORT: You already played")
    ).toBeTruthy();
  }
});
