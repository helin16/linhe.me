import { useEffect, useRef } from 'react';
import { mount } from './game.ts';
import './game.css';

export default function CritterHop() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = 'Critter Hop';
    return mount(ref.current!);
  }, []);
  return <div ref={ref} />;
}
