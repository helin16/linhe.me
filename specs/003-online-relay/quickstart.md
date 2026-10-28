# Quickstart: validate feature 003

**Prerequisites**: Node 24+, Yarn 4, `yarn install --immutable`.

## 1. Unit and relay end-to-end tests

```sh
yarn test
```

Expected: all tests pass, including the relay end-to-end tests (real relay on a random port, real
WebSocket clients), and the coverage report shows 100% functions for `relay/` and
`src/games/turbo-tumble/net.ts` (the run fails below that).

```sh
yarn e2e
```

Expected: `e2e/online.spec.ts` and `e2e/online-down.spec.ts` pass in chromium, firefox and
webkit-ipad.

## 2. Local two-window race

```sh
yarn relay   # starts the relay on localhost
yarn dev     # the dev server proxies /relay to it
```

In two browser windows at the game page: window A chooses Online → Create room (code and Copy
link appear, "Online as P1 · 1/4"); window B opens the copied link (code pre-filled) → Join
("Online as P2 · 2/4", "The host picks the track and starts"). A picks a track and starts; both
race; goo and zap affect the right karts; close B mid-race: A shows 1/4 within 5 s and keeps
racing; rejoin B, then close A (the host): B becomes host and can start the next race. Then stop the relay and choose Online: "Online play isn't available right now" within
5 s; 1 Player still races. See [contracts/relay-protocol.md](contracts/relay-protocol.md) for all
messages.

## 3. Deploy and check live

```sh
yarn deploy
```

Expected: site and relay updated; the deploy's check prints that the relay answered with a room
code. Repeat step 2's race with two devices on different networks against the live site.

## 4. Crash recovery and privacy (on the server)

Kill the relay process; within 10 s the service is running again and a new room can be created.
After all rooms empty, the service log shows only start-up lines and periodic counts (no codes,
names or messages).
