// Turbo Tumble's fixed sets (constitution VIII). No three.js import, so unit tests can load this.
import { RelayMsg } from '../../../relay/protocol.ts';
// MsgType values are the online wire format and the labels are shown in the menu: don't change values.

export const RaceState = { Menu: 'menu', Count: 'count', Race: 'race', Done: 'done' } as const;
export type RaceState = typeof RaceState[keyof typeof RaceState];

export const MsgType = {
  Hello: RelayMsg.Hello, Join: RelayMsg.Join, Leave: RelayMsg.Leave, // sent by the relay
  Me: 'me', Start: 'start', State: 's', Goo: 'goo', Pop: 'pop', Zap: 'zap',
} as const;
export type MsgType = typeof MsgType[keyof typeof MsgType];

export const Item = { Turbo: 'turbo', Goo: 'goo', Zap: 'zap' } as const;
export type Item = typeof Item[keyof typeof Item];

export const Action = { Up: 'up', Down: 'down', Left: 'left', Right: 'right', Drift: 'drift', Item: 'item' } as const;
export type Action = typeof Action[keyof typeof Action];


export const EditTab = { P1: 'Player 1', P2: 'Player 2' } as const;
export type EditTab = typeof EditTab[keyof typeof EditTab];

// buttons on the race-finished screen
export const EndAction = { Again: 'again', Garage: 'garage' } as const;
export type EndAction = typeof EndAction[keyof typeof EndAction];
