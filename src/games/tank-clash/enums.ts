// Tank Clash's fixed sets (constitution VIII). Values are saved and sent online: don't change them.

export const TankType = { Scout: 'Scout', Allrounder: 'Allrounder', Heavy: 'Heavy', Artillery: 'Artillery' } as const;
export type TankType = typeof TankType[keyof typeof TankType];

// each type comes in three builds: A tilts further but hits softer, C tilts less but hits harder, B in between
export const Variant = { A: 'A', B: 'B', C: 'C' } as const;
export type Variant = typeof Variant[keyof typeof Variant];

// the maps the picker offers; Random is resolved to one of the others when a battle starts
export const MapId = { GreenHills: 'Green Hills', TimberGap: 'Timber Gap', LakeValley: 'Lake Valley', FrostRidge: 'Frost Ridge', Random: 'Random' } as const;
export type MapId = typeof MapId[keyof typeof MapId];

// what a cell of the ground is made of (numbers: the grid is a Uint8Array)
export const Material = { Air: 0, Earth: 1, Snow: 2, Ice: 3, Wood: 4, Water: 5 } as const;
export type Material = typeof Material[keyof typeof Material];

export const Side = { Left: 'Left', Right: 'Right' } as const;
export type Side = typeof Side[keyof typeof Side];

export const Grip = { High: 'High', Medium: 'Medium', Low: 'Low' } as const;
export type Grip = typeof Grip[keyof typeof Grip];

// what an air drop holds (FR-021)
export const Drop = { Repair: 'Repair kit', Power: 'Power shell', GripGear: 'Grip gear', Shield: 'Shield', Missile: 'Missile' } as const;
export type Drop = typeof Drop[keyof typeof Drop];

export const Difficulty = { Easy: 'Easy', Normal: 'Normal', Hard: 'Hard' } as const;
export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

// a turn's stages: driving and aiming, the shell in the air, everything coming to rest, the battle over
export const Phase = { Aim: 'aim', Flight: 'flight', Settle: 'settle', Over: 'over' } as const;
export type Phase = typeof Phase[keyof typeof Phase];

// online game messages (specs/007-tank-artillery/contracts/messages.md)
export const TankMsg = {
  Look: 'look', Mode: 'mode', Begin: 'begin', Turn: 'turn', Pose: 'pose', Fire: 'fire', Settle: 'settle', Drop: 'drop',
  Over: 'over', Hand: 'hand', Sync: 'sync',
} as const;
export type TankMsg = typeof TankMsg[keyof typeof TankMsg];

// the garage's Player 1 / Player 2 tabs in 2 Players
export const TankTab = { P1: 'Tank 1', P2: 'Tank 2' } as const;
export type TankTab = typeof TankTab[keyof typeof TankTab];

// which screen is up: the garage, a battle, or the result
export const Screen = { Garage: 'in-garage', Play: 'in-play', End: 'at-end' } as const;
export type Screen = typeof Screen[keyof typeof Screen];

// buttons on the result screen
export const ResultAction = { Again: 'play-again', Garage: 'to-garage' } as const;
export type ResultAction = typeof ResultAction[keyof typeof ResultAction];

// on-screen buttons held down to drive and aim
export const Hold = { DriveLeft: 'drive-left', DriveRight: 'drive-right', AimUp: 'aim-up', AimDown: 'aim-down', PowerDown: 'power-down', PowerUp: 'power-up' } as const;
export type Hold = typeof Hold[keyof typeof Hold];

// what the 3D camera is doing (specs/008-tank-focus-camera): following the tank in turn, framing a shot, held where a
// player moved it, or showing the whole field when the battle is over (not the overview map)
export const CameraMode = { Follow: 'follow', Shot: 'shot', Held: 'held', Whole: 'whole' } as const;
export type CameraMode = typeof CameraMode[keyof typeof CameraMode];

// the 3D ground's surfaces, each with its own look (specs/009-tank-semi-3d research R3–R4)
export const GroundPart = { Grass: 'grass', Soil: 'soil', Snow: 'snow', Ice: 'ice', Wood: 'wood', Water: 'water' } as const;
export type GroundPart = typeof GroundPart[keyof typeof GroundPart];
