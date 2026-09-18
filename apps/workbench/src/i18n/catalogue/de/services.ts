/**
 * German for the `services.*` ids: the third drawing, the app and what it talks
 * to.
 *
 * One namespace per drawing, named after the drawing's own module rather than
 * after its route: the route segments carry hyphens, `test/i18n.test.ts` reads an
 * id as `[\w.]+`, and a namespace it cannot match is a file quietly excused from
 * the check that keeps every id under the name of the file it sits in. A camel
 * back is checked; a hyphen is not.
 *
 * **What is NOT here is every name in the picture.** `correctiv.org`,
 * `salon5.correctiv.net`, `icecast.correctiv.net`, `tube.funfacts.de`, `YouTube`,
 * `Faktenforum`, `abriss-atlas.de`, `beabee CrowdNewsroom`, `packages/app-core`,
 * `apps/mobile` and `services/auth.service.ts` are drawn as literals in
 * `src/diagrams/Services.tsx` and stay in their own spelling. A host is not a
 * word, and `test/diagrams.test.ts` reads two of those rows off the source to
 * hold what is drawn as a file to what `content/sources.manifest.ts` still stands
 * in for.
 *
 * The vocabulary is the app's own, so the two read alike: "Stufe" for a tier
 * (`profile.membership.tier`), "Behauptung" for a claim the community checks
 * (`claim.screenTitle`), "Mitmach-Aufruf" for a callout (`callout.screenTitle`).
 * "Statusübersicht der Quellen" is `nav.sources`, so the link in the caption and
 * the rail say the same thing.
 */
export const services: Record<string, string> = {
  'services.title': 'Die App und womit sie spricht',
  'services.lede':
    'Eines davon ist anders als die anderen. beabee beantwortet, wer jemand ist und ob die App in der Mitgliedschaft enthalten ist; alles andere beantwortet, was dieser Person gezeigt wird. Die meisten Inhalte sind heute live, die Identitätshälfte ist weiterhin simuliert.',

  'services.svg.title':
    'Die App, das Identitätssystem, das sie nach der Mitgliedschaft fragt, und die Inhaltsquellen, die sie liest',

  'services.app': 'die App',
  'services.app.requests': 'unten fragt immer der Core',

  'services.beabee.role': 'Identität und Mitgliedschaft',
  'services.beabee.answer.1': 'ein Login für Website und App: die Stufe,',
  'services.beabee.answer.2': 'ob die App enthalten ist, warum und wie lange',
  'services.ask': 'wer ist das, und ist Zutritt erlaubt',
  'services.simulated': 'heute simuliert',

  'services.content': 'INHALTE',

  'services.row.wordpress': 'WordPress REST: Beiträge, Newsletter, Suche',
  'services.row.castopod': 'Castopod, Podcast-RSS je Sendung',
  'services.row.icecast': 'Liveradio, drei Mounts',
  'services.row.peertube': 'PeerTube, neun Kanäle',
  'services.row.atom': 'Atom-Feeds',
  'services.row.faktenforum': 'GraphQL, die Behauptungen',
  'services.row.atlas': 'keine öffentliche API vorhanden',
  'services.row.crowdnewsroom': 'die Mitmach-Aufrufe',

  'services.legend.live': 'heute live, über das Netz',
  'services.legend.sample': 'eine Datei im Repository, geformt wie die künftige API',

  'services.caption.lead': 'beabee ist die Tür; der Rest ist das, was dahinter liegt.',
  'services.caption':
    'Diese Antwort entscheidet, ob die App ihre Routen überhaupt rendert, was keine Inhaltsquelle tut, deshalb hängt sie an einer eigenen Leitung. Die Antwort ist heute simuliert, in <code>services/auth.service.ts</code>, und ihre Form ist der Vertrag. Fünf Inhaltsquellen sind live, drei sind Dateien in der Form der API, die sie einmal ersetzen soll. Welche welche ist, und die Zahlen dahinter, steht in der <board>Statusübersicht der Quellen</board>.',

  'services.alt.beabee.lead': 'beabee, Identität und Mitgliedschaft.',
  'services.alt.beabee':
    'Ein Login für die Website und die App. beabee antwortet mit der Stufe, ob die App enthalten ist, warum und wie lange. Die App fragt einmal an der Tür und rendert ihre Routen nur bei einem Ja. Heute simuliert in <code>packages/app-core/src/services/auth.service.ts</code>; nichts erreicht ein Netz, und der Bildschirm, der es aufruft, sagt das.',
  'services.alt.live.heading': 'Inhalte, die die App live liest',
  'services.alt.live.wordpress':
    '<code>correctiv.org</code>, WordPress REST: Artikel nach Kategorie, das Newsletter-Archiv und die Suche.',
  'services.alt.live.castopod':
    '<code>salon5.correctiv.net</code>, CORRECTIVs eigenes Castopod, Standard-Podcast-RSS je Sendung.',
  'services.alt.live.icecast': '<code>icecast.correctiv.net</code>, Liveradio, drei Mounts.',
  'services.alt.live.peertube':
    '<code>tube.funfacts.de</code>, CORRECTIVs eigenes PeerTube, neun Kanäle.',
  'services.alt.live.youtube': 'YouTube, Atom-Feeds.',
  'services.alt.sample.heading': 'Inhalte, die eine Datei anstelle eines Dienstes sind',
  'services.alt.sample.faktenforum': 'Faktenforum, ein GraphQL-Backend, für die Behauptungen.',
  'services.alt.sample.atlas': 'abriss-atlas.de, wofür es keine öffentliche API gibt.',
  'services.alt.sample.crowdnewsroom': 'beabee CrowdNewsroom, für die Mitmach-Aufrufe.',
  'services.alt.closing':
    'Die Zahlen, die Tage, an denen jede Zahl gemessen wurde, und die gewünschten Funktionen ohne jede Quelle stehen in der Statusübersicht der Quellen.',
};
