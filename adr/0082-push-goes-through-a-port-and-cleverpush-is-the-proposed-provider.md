# ADR 0082 — Push goes through a port, and CleverPush is the proposed provider

Status: proposed, 2026-10-08. Nothing is built. §1 to §4 hold whichever provider is
chosen and can be built before one is; §5 names the provider and is the half that
needs a decision outside this repository, on price and on a trial.

## Context

The app already asks for push and sends nothing. The onboarding's last step and the
settings screen both draw a switch bound to `settings.pushOptIn` in
`packages/app-core/src/stores/settings.ts`. The value is persisted, and no code reads
it.

The request for a provider came with three requirements:

- the communications team sends pushes **by hand**, from a tool with an editorial
  interface, not from code;
- a reader subscribes to **topics** inside the app;
- topics and the general pushes are **switched separately**: a reader can leave one
  topic, leave the general pushes and keep the topics, or turn everything off.

Two facts hold for every answer. iOS delivers only through APNs, and an Android phone
with Google services only through FCM. A provider is therefore an editorial tool and a
device register in front of those two transports, never a transport of its own, and
that is what makes the choice reversible.

The first requirement decides most of it. The open-source senders that were looked at
(Gorush, Novu, Appwrite Messaging, Expo's push service) bring a transport and at most
a register, and none brings an editorial tool for a broadcast: Gorush has no interface
at all, Novu is built for per-user transactional messages, and Appwrite's console comes
with an Appwrite user backend while this app's identity is beabee's. Choosing one of
them means building the editor, and the editor is the part the team asked to have.

## Decision

### 1. Push is a port in the core, with a no-op default

`PushService` joins the ports in `packages/app-core/src/ports/index.ts` and inherits
that file's rule, the same way `ErrorReporter` did in
[ADR 0032](0032-a-port-for-the-error-report-before-a-provider-for-it.md): an
unconfigured core degrades instead of throwing. Its shape, roughly:

```ts
export interface PushService {
  /** Asks the system, registers with the provider; false when the reader declines. */
  enable(): Promise<boolean>;
  disable(): Promise<void>;
  availableTopics(): Promise<readonly PushTopic[]>;
  setTopics(ids: readonly string[]): Promise<void>;
}
```

The provider's SDK is imported in `apps/mobile/src/lib/platform/expo.ts` and nowhere
else, and `packages/app-core/test/boundary.test.ts` keeps it out of the core. The web
export and the tests get the no-op. A tapped push carries a link and opens through
`openLink` / `openArticle`, the path every other link takes, so a push adds no route
of its own.

### 2. The reader's choice lives in the core, and the provider holds a copy

`settings` keeps `pushOptIn` and gains the selected topic ids, persisted beside it.
The provider is told after every change and again after every successful `enable()`.

The reason is what turning push off does at the provider. In CleverPush's React Native
SDK, `unsubscribe()` ends the subscription and a later `subscribe()` starts a new one;
the topics the old one carried go with it. That is read from the SDK's documentation on
2026-10-08 and not measured. Keeping the choice in the core makes "all off, then on
again" return to the same topics whatever the provider does, and makes a change of
provider lose nothing a reader chose.

"All off" is `pushOptIn: false` and `disable()`. The topic selection stays stored and
is not sent until push is on again.

### 3. Every push names a topic, and the general pushes are a topic

A push without a target reaches the whole channel, including a reader who switched
the general pushes off and kept one topic. So "general" is a topic like the others,
selected by default when a reader opts in, and **no push goes to the whole channel**.

The app cannot enforce this; the sending tool can. Whether CleverPush can be set to
refuse an untargeted send is not known, so until it is, this is a rule for the team,
written into their guide when the provider is set up.

### 4. The topic list is the provider's

Topics are created in the provider's tool, so the team adds one without an app
release. The app reads the list at runtime through `availableTopics()` and draws it as
switches in the settings, in the app's own components. The provider's ready-made topic
dialog is not used, because it brings the provider's design into the app.

A selected topic that has disappeared from the list is dropped at the next sync,
without a message.

The topics are not the onboarding's interests in `packages/app-core/src/data/interests.ts`.
Those weight the home screen. Whether picking an interest should also subscribe to a
topic of the same name is left open below.

### 5. CleverPush, proposed as the first provider

What it brings, read from its documentation, API reference and SDK on 2026-10-08:

- **The editorial tool**: a dashboard with topics, segments, scheduling and team
  roles, which is the first requirement as stated.
- **Topic methods in the React Native SDK**: `getAvailableTopics`,
  `getSubscriptionTopics`, `setSubscriptionTopics`, `addSubscriptionTopic`,
  `removeSubscriptionTopic`, beside `subscribe`, `unsubscribe` and `isSubscribed`.
  §1 maps onto these without a gap. The SDK is maintained
  (`cleverpush-react-native` 1.7.33, published 2026-09-28).
- **A German company with data stored in Germany**, and a processing agreement
  accepted at sign-up. Delivery still runs through APNs and FCM, as it does for every
  provider.
- **Credentials that stay ours**: the Android setup adds the app's own Firebase
  project, and iOS takes the app's own APNs credentials. The device tokens belong to the app,
  not to CleverPush, so a change of provider is an SDK swap behind §1.
- **A REST API** for sending, segments, tags and statistics. A compose screen inside
  the workbench stays possible later without changing provider.

What it costs:

- The SDK's licence permits use only together with CleverPush's services. It is
  readable, not open source.
- Android allows one `FirebaseMessagingService`. CleverPush's is it, and
  `expo-notifications` is not added beside it; doing so would need the proxy service
  CleverPush documents.
- Topics can be read through the API and not created. §4 does not need more.
- Its Expo config plugin needs `expo prebuild`, which this app already runs.

## Alternatives considered

| Option | Why not proposed |
| --- | --- |
| Batch (France) | The one comparable choice: an editorial tool, an EU company, an official Expo plugin. Only the plugin has been checked; price, hosting and SDK are not. It is the comparison the trial should run against. |
| OneSignal | Comparable in function; a US company. |
| Firebase console | Free and can send to topics by hand, but a Google tool with a thin editorial side. |
| Open-source senders | No editorial tool, see the context. |
| UnifiedPush | Not on iOS, and on Android it needs a distributor app the reader installs. Possible later as a second adapter behind §1 for an Android build without Google services; not proposed for the readership. |

## What this does not decide

1. The price at the expected number of subscribers, and which plan includes app push
   and the API. That is decided outside this repository.
2. Whether CleverPush's plugin and SDK build with this app's Expo and React Native
   versions under the New Architecture. A spike on its free tier answers it, and
   covers §2's off-and-on, a topic switch and a tapped push opening an article, on
   iOS and Android.
3. Batch, compared on the same points.
4. Whether an interest subscribes to a topic of the same name (§4).
5. Web push, the desktop host, and an Android build without Google services.
6. Whether a push may ever target a member rather than a topic. That needs beabee's
   identity and a decision of its own.

## Consequences

- §1 to §4 can be built now with the no-op, as ADR 0032 did: the settings rows, the
  stored selection and the port. Choosing a provider is then one file.
- The settings screen gains a topic list it reads at runtime, so it needs an empty
  and a failed state.
- The communications team owns a rule (§3) that no check in this repository holds.

## What this retires

Nothing.
