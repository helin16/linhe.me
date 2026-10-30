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

// the 3D look (specs/010-turbo-3d-look): what each track's road, ground, light, scenery and effects are made of
export const RoadKind = { Tarmac: 'tarmac', Sand: 'packed-sand', Neon: 'neon-lanes' } as const;
export type RoadKind = typeof RoadKind[keyof typeof RoadKind];

export const GroundKind = { Grass: 'grass', Sand: 'sand', Snow: 'snow', Grid: 'neon-grid' } as const;
export type GroundKind = typeof GroundKind[keyof typeof GroundKind];

export const LightKind = { Sun: 'sun', Night: 'night' } as const;
export type LightKind = typeof LightKind[keyof typeof LightKind];

export const LayerKind = { Hills: 'hills', Dunes: 'dunes', Mountains: 'mountains', Towers: 'towers' } as const;
export type LayerKind = typeof LayerKind[keyof typeof LayerKind];

// one light moving effect per track (FR-006a)
export const Effect = { Snow: 'snowfall', Dust: 'dust', Birds: 'birds', Pulse: 'pulse' } as const;
export type Effect = typeof Effect[keyof typeof Effect];

// what comes from behind the wheels while drifting (FR-002a)
export const PuffKind = { Dust: 'dust', Sand: 'sand', Snow: 'snow', Glint: 'glint' } as const;
export type PuffKind = typeof PuffKind[keyof typeof PuffKind];
