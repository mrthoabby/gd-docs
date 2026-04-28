import { pcEffects } from './pc/effect.js';
import { pcVirtualEffects } from './pc-virtual/effect.js';
import { statsEffects } from './stats/effect.js';

export function tableEffects() {
  statsEffects();
  pcEffects();
  pcVirtualEffects();
}
