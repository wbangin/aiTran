import { normalizeFloatingBallTransparency } from '../shared/constants';
import { AIT_MONOGRAM } from './monogram';
import styles from './floating-toolbar.css?inline';

/** Reuse the real entry's artwork and CSS without mounting its page actions. */
export function createFloatingBallPreview(host: HTMLElement): (transparency: number) => void {
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${styles}
    .ball:hover { --visible-alpha:var(--ball-alpha,.6); }
  </style><div class="dock"><span class="ball" aria-hidden="true">${AIT_MONOGRAM}</span></div>`;
  const ball = root.querySelector<HTMLElement>('.ball')!;
  host.setAttribute('role', 'img');
  return (value) => {
    const transparency = normalizeFloatingBallTransparency(value);
    ball.style.setProperty('--ball-alpha', String(1 - transparency / 100));
    host.setAttribute('aria-label', `悬浮球预览：30 像素，透明度 ${transparency}%`);
  };
}
