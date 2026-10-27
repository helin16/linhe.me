import { useEffect, useRef } from 'react';
import { mount } from './game.ts';
import './game.css';

export default function TurboTumble() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = 'Turbo Tumble';
    return mount(ref.current!);
  }, []);
  return <div ref={ref} />;
}
