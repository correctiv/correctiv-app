import { defineMessages } from 'react-intl';

/**
 * What the layout tool and the navigation tool both say about a link (ADR 0076), in ENGLISH;
 * the German that ships is `src/i18n/catalogue/de/home.ts`. One block, because the two tools
 * hand over a draft by the same button and a sentence written twice is two sentences to keep
 * the same. The ids keep the `home.document` prefix they were written under.
 */
export const SHARE_COPY = defineMessages({
  shareCopied: {
    id: 'home.document.shareCopied',
    defaultMessage:
      'The link is on your clipboard. Open it yourself to see what the person you send it to will see.',
    description:
      'After Share link, when the address went on the clipboard (ADR 0076). Says what the click did and what to check before it goes out, which is the half of sharing nobody thinks of.',
  },
  shareNoClipboard: {
    id: 'home.document.shareNoClipboard',
    defaultMessage:
      'The browser did not let this page use the clipboard. Copy the link from this field.',
    description:
      'After Share link, when the clipboard was refused. The link is in the field beside it, as the submission’s body is in its own.',
  },
  shareTooLong: {
    id: 'home.document.shareTooLong',
    defaultMessage: 'Too long as a link: {link} characters, not {limit}. Submit it instead.',
    description:
      'After Share link, when the address came out longer than the measured limit (ADR 0076 §2). Drawn in the popover at the Share button, over a bar 32 pixels high, and read there and nowhere else — so it is two short lines and not a paragraph, which is why the numbers lead and the way out is one clause. {link} is how long that address was and {limit} the limit, both as plain numbers, because the sentence says which of the two is the rule. The second sentence names no button: the one that submits is called Einreichen here and Submit in English, and a sentence that quoted one of those would be wrong in the other language.',
  },
  shareLinkField: {
    id: 'home.document.shareField',
    defaultMessage: 'The link',
    description:
      'The name read out for the field that holds the address when the clipboard was refused.',
  },
  sharedHeld: {
    id: 'home.document.sharedHeld',
    defaultMessage:
      'This draft came in a link. It is not saved on this machine: submit it, or reload to get your own document back.',
    description:
      'In the header of the layout tool and of the navigation tool, after a link with a draft in it was opened (ADR 0076 §3). Says the two things a person cannot see: where the document came from, and that nothing of it was written here.',
  },
  sharedDamaged: {
    id: 'home.document.sharedDamaged',
    defaultMessage:
      'This link carries no draft this tool can open, so it was left out. The tool is unchanged.',
    description:
      'Stands in for home.document.sharedHeld after a link whose draft would not open — damaged characters, or a document this editor cannot hold (ADR 0076 §3). One sentence for both, because nobody reading it can act on the difference.',
  },
});
