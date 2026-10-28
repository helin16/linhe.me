# Quickstart: validate feature 002

**Prerequisites**: Node 24+, Yarn 4 (see README), `yarn install --immutable`.

## 1. Build and tests

```sh
yarn build   # type-check + build
yarn test    # includes the enum helper tests and the stray-literal check
```

Expected: no type errors; all tests pass. The stray-literal check (research R6) proves SC-001:
it fails if any member value of the ten enums in [data-model.md](data-model.md) is written out
anywhere but its definition (allow-list: default player names, saved-data test fixtures).

## 2. One-edit rename (SC-003)

Temporarily add a member to `Track` (e.g. `Moon: 'Moon'`) and run `yarn build`. Expected: the
type-check fails at the track data map (missing `Moon`) and nowhere needs a string edit. Revert.

## 3. Nothing changed for visitors (US1, SC-002)

Run the spec 001 checks in `yarn preview` ([../001-react-typescript-port/quickstart.md](../001-react-typescript-port/quickstart.md)
steps 4–6): every page and address, a race on each track in 1P and 2P using each item, R/G/M
keys, touch buttons (touch emulation), the garage, a saved legacy setting, the online message, and
leaving and returning to the game. Expected: identical behaviour, no console errors.

## 4. No server details in docs (US3, SC-004)

```sh
grep -nE '/srv/|/etc/|@[0-9]+\.[0-9]+|root@[a-z0-9]' README.md .env.example scripts/*.ts
```

Expected: no output.
