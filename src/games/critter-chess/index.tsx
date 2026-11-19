import { useEffect, useRef } from 'react';
import { mount } from './game.ts';
import './game.css';

export default function CritterChess() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = 'Critter Chess';
    return mount(ref.current!);
  }, []);
  return <div ref={ref} />;
}
