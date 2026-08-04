import { DEFAULT_TUNING } from '../config/tuning';
import { leaderEarnSummary } from './leaderHelp';

type Props = {
  open: boolean;
  onClose: () => void;
  thresholds?: [number, number, number];
};

export function PlayerAidModal({
  open,
  onClose,
  thresholds = DEFAULT_TUNING.leaderUnlockGlory,
}: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal panel" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>Player Aid</h2>
        <p style={{ color: 'var(--ink-dim)', fontSize: '0.9rem' }}>
          Canaan: Tribes of the Covenant — Twelve Banners
        </p>

        <h3 style={{ color: 'var(--bronze)', marginTop: '0.75rem' }}>Banners & Supply</h3>
        <ul>
          <li>
            Track affinity: <strong>Warriors → Military</strong>,{' '}
            <strong>Faith → Moral</strong>, <strong>Goods → Provision</strong>.
          </li>
          <li>
            <strong>Banner</strong> — paid with the track’s own resource. Counts for the
            threshold <em>and</em> for Champion, and costs you 1 Loyalty if the track
            fails.
          </li>
          <li>
            <strong>Supply</strong> — paid with anything else. Counts for the threshold
            only: it can never win the track, and it never risks anything.
          </li>
          <li>
            A track that succeeds pays <strong>1 matching resource</strong> to every
            contributor; the Champion takes the Champion reward instead. A track carried
            entirely by Supply succeeds with <strong>no Champion</strong>.
          </li>
          <li>
            <strong>Loyalty</strong> — resilience & primary tie-breaker. <strong>Glory</strong>{' '}
            — victory points (also unlocks Leader upgrades).
          </li>
        </ul>

        <h3 style={{ color: 'var(--bronze)', marginTop: '0.75rem' }}>Round income</h3>
        <ul>
          <li>
            At the start of rounds 2+, every tribe collects its unique income (Faith, Warriors,
            Goods, and sometimes Loyalty). Round 1 uses printed starting resources only.
          </li>
          <li>
            Loyalty income only applies when below your starting Loyalty. Your tribe’s amount is
            shown on the setup screen and under your resources during play.
          </li>
        </ul>

        <h3 style={{ color: 'var(--bronze)', marginTop: '0.75rem' }}>Leader upgrades</h3>
        <ul>
          <li>{leaderEarnSummary(thresholds)}</li>
          <li>
            Your tribe’s three upgrades are listed under your resources during play. Hover any
            player chip to see their progression.
          </li>
          <li>
            When you unlock a level, a banner appears and the Chronicle records the upgrade.
          </li>
        </ul>

        <h3 style={{ color: 'var(--bronze)', marginTop: '0.75rem' }}>Round sequence</h3>
        <ul>
          <li>Draw & reveal 1 Crisis card</li>
          <li>Place Influence (face-down) + take 1 Standard or Unique Action</li>
          <li>Reveal Influence → determine Champions</li>
          <li>Resolve tracks → Covenant changes</li>
          <li>Champion rewards → clean up</li>
        </ul>
        <h3 style={{ color: 'var(--bronze)' }}>Standard actions</h3>
        <ul>
          <li>
            <strong>Place Influence</strong> — 1 Faith/Warrior/Goods = 1 token on any
            track (affinity = Banner, otherwise Supply)
          </li>
          <li>
            <strong>Recruit</strong> — 1 Goods → 2 Warriors, or Faith → +1 Warrior
          </li>
          <li>
            <strong>Gather</strong> — 1 Warrior or Faith → 2 Goods
          </li>
          <li>
            <strong>Pray</strong> — Rest → 2 Faith, or 1 Goods → Faith + Loyalty
          </li>
          <li>
            <strong>Convert</strong> — 2:1 resource trades
          </li>
          <li>
            <strong>Rest & Recover</strong> — +1 Loyalty (capped at starting) and peek at the
            top Crisis card
          </li>
        </ul>
        <h3 style={{ color: 'var(--bronze)' }}>Winning</h3>
        <ul>
          <li>Highest Glory at game end</li>
          <li>Tie-break: Loyalty → remaining resources → Championships</li>
        </ul>
        <p style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>
          Tip: hover buttons, resources, player chips, and track titles for more detail.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
