import { defineMessages } from 'react-intl';

import { cn } from '../lib/cn';
import { href } from '../router';
import {
  ArrowMarker,
  BOLD,
  BOUNDARY,
  BOX_CORE,
  CALLOUT,
  CHIP,
  CHIP_PORT,
  DASHED,
  DiagramFigure,
  DRAWING,
  GHOST,
  HALO,
  MONO,
  MUTED,
  NODE_STRUCK,
  ON_ALTERNATIVE,
  T11,
  T12,
  T13,
  T16,
  WIRE,
} from './shared';

/**
 * What this drawing is CALLED, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/signIn.ts`.
 *
 * **Two ids and not the drawing.** Every label inside the picture, the caption
 * and the list under it are still literals in this file, which
 * `test/rendered-literals.test.ts` counts and ADR 0052 §1 puts in scope. They
 * are left to a pass of their own, and the reason is a collision rather than
 * effort: `test/diagrams-sign-in.test.ts` reads this drawing's ENGLISH PROSE out
 * of the drawing through `drawnText`, and holds "1500 ms", "under 4 characters",
 * "30 days" and the four session states to the constants in
 * `packages/app-core/src/services/auth.service.ts`. `drawnText` reads the file
 * and never the render, so a label moved into a descriptor disappears from it
 * and takes its check with it. Moving this drawing means deciding what that
 * check reads instead, which is a decision and not a translation.
 *
 * Named rather than called `COPY` for the reason every drawing's block is:
 * another module imports it.
 */
export const SIGN_IN_COPY = defineMessages({
  title: {
    id: 'signIn.title',
    defaultMessage: 'How somebody signs in, and what is behind the door',
    description:
      'The drawing’s name, as the heading of its own page and on the card that opens it.',
  },
  lede: {
    id: 'signIn.lede',
    defaultMessage:
      'The door is real and everything past it is not. The root layout renders it instead of the route tree, and what it asks is a function that waits a second and a half and reads a table of email addresses. Above the red line is what this repository does; below it is what the whiteboard plans, drawn as an absence because that is what it is.',
    description: 'The paragraph under that heading.',
  },
});

/**
 * The drawing on its own, with no description attached by default.
 *
 * `alt` is off here and on in the figure, for the reason the other drawings give:
 * the description it names lives in the figure, so a drawing rendered by itself
 * would point at an element that is not on the page.
 */
export function SignInDrawing({ alt = false }: { alt?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 1100 864"
      className={cn(DRAWING, 'block h-[864px] w-[1100px] max-w-none')}
      aria-labelledby="d5-title"
      aria-describedby={alt ? 'd5-alt' : undefined}
    >
      <title id="d5-title">
        Signing in: above the red line, the door this repository has today and the simulated seam
        behind it; below the line, the identity system the whiteboard plans, which no code here
        reaches
      </title>
      <defs>
        <ArrowMarker id="d5-arrow" />
      </defs>

      {/*
        The upper half is drawn the way four of the other drawings draw a fact: a
        solid frame, solid boxes, ordinary weight. Everything below the red line
        is dashed. That is the one distinction this picture has to carry, because
        a reader in a meeting takes an undifferentiated diagram as built.
      */}
      <rect x="40" y="28" width="1020" height="464" rx="8" className={BOX_CORE} />
      <text x="60" y="56" className={cn(BOLD, T16)}>
        What this repository does today
      </text>
      <text x="1040" y="56" textAnchor="end" className={cn(MUTED, T12)}>
        all of it, and there is not much
      </text>

      {/* The branch. It is the whole of what "gated" means in this app. */}
      <rect x="60" y="84" width="240" height="112" rx="6" className={CHIP} />
      <text x="74" y="108" className={cn(MONO, BOLD, T13)}>
        app/_layout.tsx
      </text>
      <text x="74" y="132" className={T11}>
        a render branch, not a redirect
      </text>
      <text x="74" y="152" className={T11}>
        admitted: the whole route tree
      </text>
      <text x="74" y="172" className={T11}>
        not admitted: the door below
      </text>

      <line x1="180" y1="198" x2="180" y2="210" className={WIRE} markerEnd="url(#d5-arrow)" />

      <rect x="60" y="216" width="240" height="100" rx="6" className={CHIP} />
      <text x="74" y="240" className={cn(MONO, BOLD, T12)}>
        components/gate/LoginGate
      </text>
      <text x="74" y="262" className={cn(T11, MUTED)}>
        one surface, four states:
      </text>
      <text x="74" y="282" className={cn(MONO, T11)}>
        signed-out, signing-in,
      </text>
      <text x="74" y="300" className={cn(MONO, T11)}>
        failed, signed-in
      </text>

      <line x1="302" y1="266" x2="350" y2="266" className={WIRE} markerEnd="url(#d5-arrow)" />

      {/*
        The seam takes the port grammar — a contract rather than a block — because
        that is exactly what it is: the shape of the answer is decided, and what
        answers is not.
      */}
      <rect x="356" y="84" width="300" height="232" rx="6" className={CHIP_PORT} />
      <text x="372" y="108" className={cn(MONO, BOLD, T13)}>
        services/auth.service.ts
      </text>
      <text x="372" y="130" className={cn(T11, MUTED)}>
        the seam to beabee
      </text>
      <rect x="372" y="144" width="170" height="22" rx="11" className={NODE_STRUCK} />
      <text x="386" y="155" className={cn(T11, ON_ALTERNATIVE)}>
        simulated, no network
      </text>
      <text x="372" y="186" className={T11}>
        <tspan className={MONO}>simulatedSignIn()</tspan> waits 1500 ms,
      </text>
      <text x="372" y="204" className={T11}>
        then reads a directory of rules:
      </text>
      <text x="372" y="228" className={T11}>
        fails: no <tspan className={MONO}>@</tspan>, or a password under 4 characters
      </text>
      <text x="372" y="248" className={T11}>
        <tspan className={MONO}>frei</tspan> in the address: no app access
      </text>
      <text x="372" y="266" className={T11}>
        <tspan className={MONO}>test</tspan> a trial, 30 days
      </text>
      <text x="372" y="284" className={T11}>
        <tspan className={MONO}>lokal</tspan> a local-newsletter bundle
      </text>
      <text x="372" y="302" className={T11}>
        <tspan className={MONO}>soli</tspan> the Soli tier; anything else pays
      </text>

      <line x1="658" y1="200" x2="686" y2="200" className={WIRE} markerEnd="url(#d5-arrow)" />

      <rect x="692" y="84" width="348" height="160" rx="6" className={CHIP} />
      <text x="708" y="108" className={cn(BOLD, T13)}>
        The answer, which is the contract
      </text>
      <text x="708" y="132" className={T12}>
        <tspan className={MONO}>Account</tspan>
        <tspan className={MUTED}> — email, name</tspan>
      </text>
      <text x="708" y="158" className={cn(MONO, T12)}>
        Entitlement
      </text>
      <text x="708" y="180" className={cn(MONO, T11)}>
        tier, appAccess, source,
      </text>
      <text x="708" y="198" className={cn(MONO, T11)}>
        validUntil, localAreas, memberSince
      </text>
      <text x="708" y="224" className={cn(T11, MUTED)}>
        No amount anywhere: a trial pays 0 € and has the app.
      </text>

      <line x1="866" y1="246" x2="866" y2="260" className={WIRE} markerEnd="url(#d5-arrow)" />

      <rect x="692" y="266" width="348" height="76" rx="6" className={CHIP} />
      <text x="708" y="288" className={cn(MONO, BOLD, T12)}>
        stores/session
      </text>
      <text x="708" y="308" className={T11}>
        persisted: account and entitlement,
      </text>
      <text x="708" y="326" className={T11}>
        JSON through the <tspan className={MONO}>KeyValueStore</tspan> port
      </text>

      {/*
        Two notes rather than more boxes. Both are corrections to the sketch, and a
        correction is a sentence; drawing it as a node would claim it is a step.
      */}
      <rect x="60" y="356" width="470" height="120" rx="6" className={CALLOUT} />
      <text x="76" y="380" className={cn(BOLD, T12)}>
        The sketch draws saving an article through this door
      </text>
      <text x="76" y="404" className={T11}>
        Today it is <tspan className={MONO}>stores/savedArticles</tspan>, on the device,
      </text>
      <text x="76" y="424" className={T11}>
        through the same <tspan className={MONO}>KeyValueStore</tspan> port as the session.
      </text>
      <text x="76" y="444" className={T11}>
        Nothing about a saved article leaves the phone, and no
      </text>
      <text x="76" y="464" className={T11}>
        request for one carries anybody&apos;s identity.
      </text>

      <rect x="560" y="356" width="480" height="120" rx="6" className={CALLOUT} />
      <text x="576" y="380" className={cn(BOLD, T12)}>
        Where the door sends people instead
      </text>
      <text x="576" y="404" className={cn(MONO, T11)}>
        https://correctiv.org/unterstuetzen/
      </text>
      <text x="576" y="424" className={T11}>
        Upgrade, join and password reset are all three this one
      </text>
      <text x="576" y="444" className={T11}>
        address, opened in the system browser. beabee owns no
      </text>
      <text x="576" y="464" className={T11}>
        account page yet, so there is nothing else to point at.
      </text>

      {/* The line, and the sentence it exists to make unmissable. */}
      <text x="550" y="512" textAnchor="middle" className={cn(BOLD, T12, HALO)}>
        Nothing below this line exists in this repository.
      </text>
      <line x1="40" y1="524" x2="1060" y2="524" className={BOUNDARY} />

      <rect x="40" y="548" width="1020" height="296" rx="8" className={DASHED} />
      <text x="60" y="578" className={cn(BOLD, T16, MUTED)}>
        What the whiteboard plans
      </text>
      <text x="1040" y="578" textAnchor="end" className={cn(MUTED, T12)}>
        drawn as an absence, because that is what it is
      </text>

      <rect x="60" y="600" width="300" height="104" rx="6" className={GHOST} />
      <text x="76" y="624" className={cn(MONO, BOLD, T12)}>
        auth.community.correctiv.org
      </text>
      <text x="76" y="646" className={T11}>
        Zitadel, says the sketch. That name
      </text>
      <text x="76" y="664" className={cn(T11, MUTED)}>
        appears nowhere in this repository, so
      </text>
      <text x="76" y="682" className={cn(T11, MUTED)}>
        it is a claim here and not a fact.
      </text>

      <rect x="380" y="600" width="300" height="104" rx="6" className={GHOST} />
      <text x="396" y="624" className={cn(MONO, BOLD, T12)}>
        community.correctiv.org
      </text>
      <text x="396" y="646" className={T11}>
        beabee: one login for the website
      </text>
      <text x="396" y="664" className={T11}>
        and the app, and the entitlement the
      </text>
      <text x="396" y="682" className={T11}>
        door above already knows how to read.
      </text>

      {/*
        One box for the whole back end, which is the decision this drawing was
        asked to take. The sketch has six services behind here; naming them
        without drawing them is the honest amount, because not one of them is
        something this repository could ever be wrong about out loud.
      */}
      <rect x="700" y="600" width="340" height="104" rx="6" className={GHOST} />
      <text x="716" y="624" className={cn(BOLD, T12)}>
        Behind that door, per the sketch
      </text>
      <text x="716" y="646" className={T11}>
        an identity provider, contacts, newsletter, a
      </text>
      <text x="716" y="664" className={T11}>
        notification centre (not in the first version)
      </text>
      <text x="716" y="682" className={T11}>
        and its provider, and on to Salesforce.
      </text>

      <rect x="60" y="720" width="620" height="104" rx="6" className={GHOST} />
      <text x="76" y="744" className={cn(BOLD, T12)}>
        What arrives with a real sign-in, and does not exist yet
      </text>
      <text x="76" y="766" className={T11}>
        A token. A secure-storage port. An <tspan className={MONO}>Authorization</tspan> header in{' '}
        <tspan className={MONO}>services/http.ts</tspan>.
      </text>
      <text x="76" y="788" className={T11}>
        None of the three is here. Until then the session is two JSON fields in the
      </text>
      <text x="76" y="806" className={T11}>
        <tspan className={MONO}>KeyValueStore</tspan>, and ADR 0016 says why none of it is here yet.
      </text>

      {/*
        The one open question in the accent, so it does not read as another
        missing part. A named open question is honest; the same question resolved
        in a picture nobody argued over is not.
      */}
      <rect x="700" y="720" width="340" height="104" rx="6" className={CHIP_PORT} />
      <rect x="716" y="732" width="124" height="22" rx="11" className={NODE_STRUCK} />
      <text x="730" y="743" className={cn(T11, ON_ALTERNATIVE)}>
        open question
      </text>
      <text x="716" y="770" className={T13}>
        A native sign-in, or a webview?
      </text>
      <text x="716" y="792" className={T11}>
        ADR 0020 puts the sign-in shape outside its
      </text>
      <text x="716" y="810" className={T11}>
        own scope and leaves it to a later record.
      </text>
    </svg>
  );
}

/**
 * The fifth drawing: how somebody signs in, from the app's side.
 *
 * Only what the app sees. The whiteboard it was drawn from has a load balancer, a
 * website core, a mailwall, a form plugin, a push provider and two media hosts on
 * it; none of those is something the app asks about identity, and a diagram that
 * claimed them would be claiming things this repository can never check.
 */
export function SignIn({ alt = true }: { alt?: boolean }) {
  return (
    <DiagramFigure
      number={5}
      altId="d5-alt"
      alt={alt}
      drawing={<SignInDrawing alt={alt} />}
      caption={
        <>
          <strong>There is no sign-in in this repository, and that is the drawing.</strong> The door
          is real: the root layout renders it instead of the route tree, so no route is mounted and
          nothing can be deep-linked past it. What it asks is a function that waits a second and a
          half and reads a table of email addresses.{' '}
          <code>packages/app-core/src/services/auth.service.ts</code> holds no network call, and no
          token, secure store, redirect address or identity library exists anywhere here. So the
          contract is what was decided and the client is what was not, which is why the seam is
          drawn as a port and everything past it as an absence. The app does read beabee, for the
          callouts on the Mitmachen screen, and correctiv.org for everything else; that is the{' '}
          <a
            href={href('/diagrams/services')}
            className="underline decoration-accent underline-offset-2"
          >
            third drawing
          </a>{' '}
          and a different question, because none of it asks who anybody is.
        </>
      }
    >
      <dl>
        <dt>The door, in the host</dt>
        <dd>
          <code>apps/mobile/src/app/_layout.tsx</code> renders one of two things: the route tree
          when <code>isAdmitted(session, now)</code> is true, and{' '}
          <code>apps/mobile/src/components/gate/LoginGate</code> when it is not. A branch and not a
          redirect, so an address cannot reach past it. Inside the app nothing is gated at all. The
          door is one surface in four states, which are the four values of{' '}
          <code>SessionStatus</code>: signed-out, signing-in, failed, signed-in.
        </dd>
        <dt>The seam, in the core</dt>
        <dd>
          <code>packages/app-core/src/services/auth.service.ts</code> is where a real client would
          go. Today <code>simulatedSignIn()</code> waits 1500 ms and reads a directory of rules so
          that every state of the door is reachable on a device with no back end: an address with no{' '}
          <code>@</code> in it fails, and so does a password under four characters;{' '}
          <code>frei</code> in the address answers signed in with no app access; <code>test</code>{' '}
          answers with a thirty-day trial; <code>lokal</code> with a local-newsletter bundle;{' '}
          <code>soli</code> with the Soli tier; anything else is a paying member. Nothing in the
          file reaches a network.
        </dd>
        <dt>The answer, which is the part that is decided</dt>
        <dd>
          An <code>Account</code> (email, name) and an <code>Entitlement</code>: the tier, whether
          the app is included (<code>appAccess</code>), why (<code>source</code>), until when (
          <code>validUntil</code>), which local areas, and since when. No amount, because a trial
          pays 0 € and has the app and a local bundle has the app without being an app membership.{' '}
          <code>stores/session</code> persists two of those fields, the account and the entitlement,
          as JSON through the <code>KeyValueStore</code> port. Not a secure store: there is no
          secret in it.
        </dd>
        <dt>Where the door sends people</dt>
        <dd>
          Upgrade, join and password reset are all three{' '}
          <code>https://correctiv.org/unterstuetzen/</code>, opened in the system browser. The
          membership system owns no account page yet, so there is nothing else to point at.
        </dd>
        <dt>Two corrections to the sketch it was drawn from</dt>
        <dd>
          <ul>
            <li>
              Saving an article and loading saved articles are drawn there as calls into the
              membership system. They are <code>stores/savedArticles</code> on the device, kept
              through the same <code>KeyValueStore</code> port, and nothing about them leaves the
              phone.
            </li>
            <li>
              The app is drawn there doing an OIDC login. It does not. The only mention of OIDC in
              this repository is one line of ADR 0020 ruling the question out of that
              decision&apos;s scope.
            </li>
          </ul>
        </dd>
        <dt>Below the red line: planned, and not here</dt>
        <dd>
          <ul>
            <li>
              <code>auth.community.correctiv.org</code>, Zitadel according to the sketch. The name
              appears nowhere in this repository, so the diagram carries it as a claim.
            </li>
            <li>
              <code>community.correctiv.org</code>, the beabee instance: one login for the website
              and the app, and the answer the door already knows how to read.
            </li>
            <li>
              Behind it, per the sketch and drawn as one box: an identity provider, a contacts
              service, a newsletter service, a notification centre marked as not in the first
              version and its provider, feeding on to Salesforce. The app sees a door, not a
              building.
            </li>
            <li>
              What a real sign-in brings with it: a token, a secure-storage port, and an{' '}
              <code>Authorization</code> header in{' '}
              <code>packages/app-core/src/services/http.ts</code>. ADR 0016 lists the port and the
              header as open and names the token as what both of them wait on. None of the three is
              here.
            </li>
          </ul>
        </dd>
        <dt>The open question, marked as one</dt>
        <dd>
          A native sign-in or a webview. ADR 0020 reaches the nearest question — whether
          browser-based OIDC is what Apple and Google want at a login — only to rule it outside its
          own scope, and says in as many words that the sign-in shape is left to a later ADR. So the
          diagram names the question rather than answering it.
        </dd>
        <dt>What the sketch has that this leaves out</dt>
        <dd>
          The load balancer, the website core, the website&apos;s own auth, the mailwall, the
          newsletter subscribe form, the push provider, and the audio and video hosting. The app
          asks none of them who somebody is. Where the app does read them for content, that is the
          third drawing, and it is a different question.
        </dd>
      </dl>
    </DiagramFigure>
  );
}
