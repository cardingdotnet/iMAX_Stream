# EgMax — Brand Guide

A short, opinionated guide to keep new screens consistent with the rest of the app.

---

## 1. Voice

Editorial. Quiet. Confident. Closer to a magazine masthead than a streaming service shouting at you.

- Headlines are short, declarative. End with a period — sentences, not slogans.
- Body copy is plain language. Avoid marketing puff ("amazing", "incredible").
- Single accent word per headline if it earns italic emphasis: *welcome*, *beautifully*, *first playlist*.
- Never use emoji in UI strings (toast text, button labels, empty states). Emoji are fine in user-generated content (playlist names) — that's the user's voice, not the brand's.

---

## 2. Color tokens

Use the Tailwind tokens — never raw hex in components.

| Token            | Hex        | Use                                          |
| ---------------- | ---------- | -------------------------------------------- |
| `ink-900`        | `#0B0B0E`  | App body                                     |
| `ink-800`        | `#131317`  | Sidebars, sticky bars, modals                |
| `ink-700`        | `#1A1A20`  | Card surfaces, inputs                        |
| `ink-600`        | `#25252D`  | Hover states                                 |
| `ink-500`        | `#383842`  | Strong borders                               |
| `cream-50`       | `#F5F1EA`  | Headlines (warm off-white)                   |
| `cream-100`      | `#E7E2D8`  | Body text                                    |
| `cream-300`      | `#A09CA0`  | Subdued / metadata                           |
| `cream-500`      | `#6B6770`  | Quiet labels, eyebrows                       |
| **`coral-500`**  | `#FF5E3A`  | **Primary accent.** Use sparingly.           |
| `coral-400`      | `#FF7A5C`  | Hover                                        |
| `coral-600`      | `#E84A2A`  | Pressed                                      |
| `ember-500`      | `#FFB347`  | Secondary highlight (warnings, hot states)   |
| `purple-ink`     | `#2C1A48`  | Editorial gradient anchor                    |

**Coral budget**: One coral element per viewport. Two if both are tiny (eyebrow + button icon). The accent earns its energy by being rare.

---

## 3. Typography

Two faces, one Arabic face.

| Face        | Variable       | Use                                            |
| ----------- | -------------- | ---------------------------------------------- |
| Fraunces    | `--font-serif` | Display, headlines, masthead, brand wordmark   |
| Inter       | `--font-sans`  | UI controls, body, eyebrows, metadata          |
| Plex Arabic | `--font-arabic`| Any `[lang="ar"]` element                      |

### Type scale

| Class           | Use                                  |
| --------------- | ------------------------------------ |
| `text-eyebrow`  | All-caps tracking labels (`eyebrow`) |
| `text-sm`       | Body, metadata                       |
| `text-display-sm` (2.25 rem) | Section H1 on mobile     |
| `text-display`    (3.5 rem)  | Page H1, hero            |
| `text-display-lg` (5 rem)    | Hero on desktop          |
| `text-display-xl` (7 rem)    | Editorial showpiece only |

### Italic policy

Italic is reserved for **two** uses:
1. The accent word inside a serif headline (`<span className="italic font-light">welcome</span>`).
2. Quiet pull-quote strings ("EgMax — music, beautifully streamed.") that act as design elements rather than UI text.

Never italicize entire paragraphs or button labels.

---

## 4. The brand mark

`<BrandMark size={32} variant="mark|wordmark|stacked" />`

- Lives at `components/brand/BrandMark.tsx`.
- The accent dot (the play-head) is the only place coral appears inside the mark itself — keep it.
- Minimum size: 16 px (favicon). Never distort.

The wordmark sets the **M** in coral. The wordmark and the mark can be used independently.

---

## 5. Layout

- Page side padding: `px-6 sm:px-12 lg:px-16`. Generous, editorial.
- Section vertical padding: `py-12 sm:py-16`. Air around content.
- Cards have **no** background by default; the cover art and the content carry the color. A border or `card-elevated` is used only when the surface needs to be distinct (modals, share card, the user menu).
- Rules (`<div className="rule" />`) separate sections. Use them instead of background color shifts.

### Hero blocks

The `hero-gradient grain` combo is the official editorial hero. Use it on:
- Login / signup left panel
- Home page hero
- Playlist hero header

Never on a tiny element — heroes need width and breathing room to feel intentional.

---

## 6. Iconography

Base set: `lucide-react`, stroke width **1.5** (default) or **1.75** (for emphasis). Never `2.5` — that's a Spotify-clone tell.

Custom icons (in `components/brand/`):
- `<BrandMark />` — logo / favicon
- `<PlayBadge />` — primary play action (playlist hero)
- `<NowPlayingBars />` — audio activity indicator

If a lucide icon needs more than a stroke-width tweak to fit, draw a custom SVG instead of layering effects on top.

---

## 7. Motion

- Duration `150–300ms`, never longer for UI transitions.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (defined as `ease-out` curve in keyframes).
- No bouncy / spring / over-shoot animations.
- Hover lift: 1–2 px max.
- The "now playing" indicator is the only continuously animated UI element on a static page.

---

## 8. The two stream URLs (keep this language)

| Surface label                     | What it is                       |
| --------------------------------- | -------------------------------- |
| **IMVU radio · recommended**      | `/radio/{code}.mp3` — for IMVU   |
| Playlist URL · VLC / browsers     | `/stream/{code}` — M3U           |
| .m3u with extension               | `/stream/{code}.m3u`             |

The IMVU one is always primary, in a coral-tinted card. The other two sit below in the secondary surface treatment.

---

## 9. What we are not

- **Not Spotify**: green is not in our palette; cards don't have heavy gradients; copy isn't enthusiastic.
- **Not Apple Music**: we are dark, not light. We don't use SF Pro.
- **Not SoundCloud**: orange is not our accent (coral is warmer and more saturated); we don't surface waveform thumbnails on every track.

If a new screen could be screenshotted and mistaken for one of those three apps, redo it.
