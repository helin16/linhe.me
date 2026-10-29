import { useEffect, useRef } from 'react';
import { mount } from './game.ts';
import './game.css';

export default function TankClash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = 'Tank Clash';
    return mount(ref.current!);
  }, []);
  return <div ref={ref} />;
}
