import { useEffect, useRef } from 'react';
import { mount } from './game.ts';
import './game.css';

export default function SnakeDuel() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = 'Snake Duel';
    return mount(ref.current!);
  }, []);
  return <div ref={ref} />;
}
