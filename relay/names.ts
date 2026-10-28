// Room names the relay makes up (FR-002): "Adjective Animal" from fixed, family-friendly lists, so no one types one.
import { randomInt } from 'node:crypto';

export const ADJECTIVES = [
  'Turbo', 'Rocket', 'Zippy', 'Speedy', 'Bouncy', 'Sunny', 'Lucky', 'Jolly', 'Brave', 'Clever',
  'Dizzy', 'Fizzy', 'Fluffy', 'Giddy', 'Happy', 'Jumpy', 'Mighty', 'Nifty', 'Peppy', 'Plucky',
  'Quick', 'Rapid', 'Shiny', 'Snappy', 'Sparky', 'Spinny', 'Super', 'Swift', 'Wacky', 'Zany',
  'Breezy', 'Cosmic', 'Dashing', 'Frosty', 'Golden', 'Mellow', 'Nimble', 'Sly', 'Stormy', 'Wobbly',
];
export const ANIMALS = [
  'Otter', 'Panda', 'Fox', 'Koala', 'Tiger', 'Penguin', 'Rabbit', 'Turtle', 'Badger', 'Beaver',
  'Falcon', 'Gecko', 'Hedgehog', 'Kitten', 'Lemur', 'Llama', 'Moose', 'Owl', 'Puffin', 'Quokka',
  'Raccoon', 'Seal', 'Sloth', 'Squirrel', 'Walrus', 'Wombat', 'Yak', 'Zebra', 'Alpaca', 'Bison',
  'Camel', 'Dolphin', 'Ferret', 'Goose', 'Hamster', 'Iguana', 'Kiwi', 'Lynx', 'Marmot', 'Platypus',
];

/** A random room name that `taken` doesn't already use. */
export function newName(taken: (name: string) => boolean, random: (max: number) => number = randomInt): string {
  for (let tries = 0; tries < 100; tries++) {
    const name = `${ADJECTIVES[random(ADJECTIVES.length)]} ${ANIMALS[random(ANIMALS.length)]}`;
    if (!taken(name)) return name;
  }
  throw new Error('no free room name');
}
