import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — Venom Arena',
  description:
    'How TRILLINAIRE Games collects, uses, and protects your data in Venom Arena.',
};

const EMAIL = 'venomarena@support.com';
const UPDATED = 'September 5, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 sm:p-6">
      <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-indigo-500 inline-block" />
        {title}
      </h2>
      <div className="space-y-3 text-[13px] sm:text-sm leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14 space-y-5">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-400">
            Venom Arena — a global multiplayer championship snake game by{' '}
            <span className="text-slate-200 font-semibold">TRILLINAIRE Games</span>
          </p>
          <p className="text-xs text-slate-500 font-mono">Last updated: {UPDATED}</p>
        </div>

        <Section title="1. Who We Are">
          <p>
            Venom Arena (&quot;the Game&quot;) is operated by <strong className="text-slate-200">TRILLINAIRE Games</strong>{' '}
            (&quot;we&quot;, &quot;us&quot;). This policy explains what data the Game collects, why, and the
            choices you have. It applies to the web version and the mobile app.
          </p>
          <p>
            You can reach us at any time for privacy questions or data requests at{' '}
            <a href={`mailto:${EMAIL}`} className="text-indigo-400 hover:text-indigo-300 font-mono underline underline-offset-2">
              {EMAIL}
            </a>.
          </p>
        </Section>

        <Section title="2. Data We Collect">
          <p>
            <strong className="text-slate-200">Account data.</strong> When you create an account we store your
            chosen Challenger Handle, a permanent Ledger Tag, and — if you register with email — your email
            address, a hashed password (we never store or see your plain password), and an optional 4-digit
            security PIN used only for password recovery. You may optionally add a country, profile picture,
            and public social handles (Instagram, YouTube, Twitch).
          </p>
          <p>
            <strong className="text-slate-200">Guest players.</strong> If you play as a guest, a randomly
            generated player identifier is created for you. No email or password is required.
          </p>
          <p>
            <strong className="text-slate-200">Gameplay data.</strong> Match results (score, kills, duration,
            chips carried and banked), your in-game wallet balances (chips, tickets, season pass state),
            leaderboard placements, clan memberships, cosmetic inventory, and referral activity. This data
            is what makes the global championship, leaderboards, and economy work — it is tied to your
            player identity and is visible to other players in the form of ranks, scores, and public profiles.
          </p>
          <p>
            <strong className="text-slate-200">Technical data.</strong> Your IP address is used at signup to
            auto-detect your country/region (via a country-lookup service) and to route your connection to
            the nearest game server region. We also keep minimal connection logs for integrity and abuse
            prevention.
          </p>
          <p>
            <strong className="text-slate-200">On-device settings.</strong> Preferences you choose in Settings
            (music, sound, vibration, orientation, performance mode) are stored locally on your device via
            browser local storage. They are not uploaded to our servers.
          </p>
        </Section>

        <Section title="3. Virtual Currency">
          <p>
            Chips and tickets are virtual in-game items. They have no real-world monetary value and cannot be
            exchanged for cash. Chip wallets are subject to the published season reset (January 1 each year),
            which is part of the championship design and disclosed in-game.
          </p>
        </Section>

        <Section title="4. Ads and Purchases">
          <p>
            <strong className="text-slate-200">Rewarded ads.</strong> The Game may offer optional rewarded
            video ads. On the mobile app these are served through Google AdMob, which receives device
            information (such as advertising identifiers) to serve and measure ads. Ad delivery is governed
            by Google&apos;s own privacy policy. Watching rewarded ads is always optional.
          </p>
          <p>
            <strong className="text-slate-200">In-app purchases.</strong> Chip packs, season passes, and time
            passes are processed entirely by the Google Play billing system. We receive only the order
            confirmation data needed to credit your purchase (order ID, product ID, and status). We never
            see or store your payment card details.
          </p>
        </Section>

        <Section title="5. How We Use Data">
          <p>We use the data described above to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Operate the Game: matches, matchmaking, economy, extraction, and season progression;</li>
            <li>Rank players on leaderboards and run the global championship;</li>
            <li>Keep the economy fair: anti-cheat, anti-abuse, and integrity investigations;</li>
            <li>Provide support when you contact us, including issue reports you email us;</li>
            <li>Process purchases and ad rewards you explicitly choose to trigger.</li>
          </ul>
          <p>
            We do not sell your personal data, and we do not use it for third-party advertising profiles
            beyond the ad SDK described in Section 4.
          </p>
        </Section>

        <Section title="6. Sharing">
          <p>
            We only share data with: (a) infrastructure and service providers that host the Game servers and
            databases; (b) Google (AdMob for optional ads, Google Play for purchases); (c) the country-lookup
            service used once at signup for region detection; and (d) authorities where required by law.
            Service providers are bound to process data only on our instructions.
          </p>
        </Section>

        <Section title="7. Retention and Deletion">
          <p>
            Account and gameplay data are kept for as long as your account exists so the championship and
            economy remain intact. You can delete your account yourself at any time:{' '}
            <strong className="text-slate-200">Profile → Delete Account</strong>. This erases your account,
            wallet, inventory, and match records. You can also email{' '}
            <a href={`mailto:${EMAIL}`} className="text-indigo-400 hover:text-indigo-300 font-mono underline underline-offset-2">
              {EMAIL}
            </a>{' '}
            with the subject &quot;Data Request&quot; for access, correction, export, or deletion of your data —
            we respond personally.
          </p>
        </Section>

        <Section title="8. Children">
          <p>
            Venom Arena is not directed at children under 13, and we do not knowingly collect personal
            information from children under 13. If you believe a child has provided personal data, contact us
            at {EMAIL} and we will delete it promptly.
          </p>
        </Section>

        <Section title="9. Security">
          <p>
            Passwords are stored as salted hashes, sessions use signed tokens, and all traffic between your
            device and our game servers travels over the network in encrypted form where the platform
            supports it. No system is perfectly secure, but we design the Game to collect the minimum data
            needed to run it, and we review access regularly.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            If we change this policy, we will update the date above and, for material changes, announce it
            inside the Game. Continued play after a change means you accept the updated policy.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            <strong className="text-slate-200">TRILLINAIRE Games</strong> — Venom Arena
            <br />
            Support &amp; privacy:{' '}
            <a href={`mailto:${EMAIL}`} className="text-indigo-400 hover:text-indigo-300 font-mono underline underline-offset-2">
              {EMAIL}
            </a>
          </p>
        </Section>

        <div className="pt-4 text-center">
          <a
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition text-xs font-bold uppercase tracking-wider"
          >
            ← Back to Venom Arena
          </a>
        </div>
      </div>
    </main>
  );
}
