/**
 * Einstiegspunkt des AutoCell-Players. Registriert <autocell-player>.
 *
 *   <script type="module" src="https://delbonum.github.io/autocell/player/autocell-player.js"></script>
 *   <autocell-player src="projekt.acp" controls autoplay></autocell-player>
 */
import { AutoCellPlayer } from './player';

export { AutoCellPlayer };
export { PLAYER_TEMPLATES } from './source';

declare global {
  interface HTMLElementTagNameMap {
    'autocell-player': AutoCellPlayer;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('autocell-player')) {
  customElements.define('autocell-player', AutoCellPlayer);
}
