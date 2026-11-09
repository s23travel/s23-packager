# ui_kits/app — S23 Travel applied kit

This directory is the applied UI kit for the S23 Travel design system. It
documents the applied kit structure, every component file, the usage workflow,
the design notes and the source basis behind the interface, so a future agent can
reuse it like a Claude Design package.

## What is inside

- `index.html` — the full applied homepage.
- `app.css` — the shared, token-only stylesheet.
- `components/` — seven standalone snippets covering buttons, cards, search, badges, navigation, footer and feedback.

## Source context

Source basis: the token sheet `colors_and_type.css`, the reference assets in `assets/`, the original layout notes in `source_examples/original-DESIGN.md`, the review cards in `preview/` and the copy-ready handoff in `handoff/`.

Derived from the S23 Travel DESIGN.md, the live site captures, the official
logos and the delivered Poppins and Instrument Serif files.

## When to use

Use this kit when building any S23 Travel surface: destination catalog, campaign
hero, search and filters, booking-adjacent flows or support entry points.

## How to use

Copy the tokens and fonts, then copy the homepage or the snippets, rewrite the
asset paths and replace the sample catalog with real content.

## Overview

`index.html` is a complete homepage built only from tokens in
`../../colors_and_type.css`: navy header, campaign hero, search bar, six
destination cards, values band, editorial band, pagination, footer and the
WhatsApp launcher. `app.css` is the same stylesheet embedded in `index.html`; use
it directly in a new project.

## Structure

```text
ui_kits/app/
  README.md
  index.html
  app.css
  components/
    buttons.html
    cards.html
    search-form.html
    badges.html
    navigation.html
    footer.html
    feedback.html
```

| File | Purpose |
| --- | --- |
| `index.html` | Full applied homepage. CSS embedded for review; links the component snippets. |
| `app.css` | Token-only component styles shared by the homepage and every snippet. |

## Components

| File | Component |
| --- | --- |
| [components/buttons.html](components/buttons.html) | Primary, ghost, compact and icon buttons with default, hover, focus-visible, pressed, disabled and loading states. |
| [components/cards.html](components/cards.html) | Destination card, hover, skeleton loading and empty state. |
| [components/search-form.html](components/search-form.html) | Search and filters, focus, validation error and loading. |
| [components/badges.html](components/badges.html) | Destination badge, neutral badge and regional frosted chip. |
| [components/navigation.html](components/navigation.html) | Navy header with active item plus circular pagination. |
| [components/footer.html](components/footer.html) | Four-column navy footer and WhatsApp launcher. |
| [components/feedback.html](components/feedback.html) | Error, success, field validation and empty state. |

## Usage

1. Copy `../../colors_and_type.css` and `../../fonts/` to the project root and
   link the stylesheet in the document head.
2. Copy `index.html` and `app.css`, or only the snippets you need.
3. Rewrite asset paths (`../../assets/...`) for your repository structure.
4. Replace the sample destinations with the real catalog.
5. Delete the "Biblioteca de componentes" section — it exists for review only.
6. Run the review checklist in `../../SKILL.md` §5 before shipping.

## Design notes

- Every value comes from a token: color, type, spacing, radius, shadow, motion.
- Terracotta is an accent. Small text never sits on `#D4641C`; buttons use
  `#B0500F` (5.25:1) and badges use `#9A4100` (6.71:1).
- Poppins runs the interface; Instrument Serif appears only in display ≥24px.
- Cards use a 16:10 media frame, a 16px radius, `--shadow-1` at rest and
  `--shadow-2` with a 2px lift on hover.
- The page ships one theme only. Navy bands use `--color-inverse-bg`; there is no
  dark mode.
- No clean destination photography was supplied, so cards use the system's
  editorial media frame (contour lines plus the destination name) instead of a
  grey placeholder.

## Source basis

The kit derives from `source_examples/original-DESIGN.md`, the live site captures
(`assets/screenshot-1794165842684.png` and
`assets/Captura de tela_8-11-2026_192433_www.s23.travel.jpeg`), the official
logos and the delivered font files. Decisions, conflicts and derivations are
recorded in `../../context/provenance.md`; open items are in
`../../context/open-questions.md`.

## Gaps

- Clean destination photos are missing; the editorial media frame is the
  documented fallback.
- Phone numbers, email and the Cadastur number are placeholders from the brief,
  not verified data.
## Reuse guide

Reuse this kit as the starting point for any S23 Travel surface. Keep the token
layer, replace the sample catalog, preserve every interaction state and follow
../../DESIGN.md for anything not covered here.

## Reuse checklist

- [ ] Tokens imported from ../../colors_and_type.css, fonts present.
- [ ] All states preserved: default, hover, focus-visible, active, disabled,
      loading, error, empty.
- [ ] Contrast pairs unchanged.
- [ ] Real copy, real catalog, no invented price or certification.
## File map

- ui_kits/app/index.html — applied homepage (all sections, token-only).
- `app.css` — the shared, token-only stylesheet.
- ui_kits/app/components/buttons.html — 8 button states.
- ui_kits/app/components/cards.html — card, hover, loading, empty.
- ui_kits/app/components/search-form.html — search, focus, error, loading.
- ui_kits/app/components/badges.html — campaign badge, neutral badge, chip.
- ui_kits/app/components/navigation.html — header, active state, pagination.
- ui_kits/app/components/footer.html — footer columns, legal line, launcher.
- ui_kits/app/components/feedback.html — error, success, empty.

## States and responsiveness

Every interactive component covers default, hover, focus-visible, active,
disabled and loading; lists and forms also cover error and empty. The laid-out
homepage is responsive across the 12 / 8 / 4 column breakpoints, respects
prefers-reduced-motion, keeps a visible focus ring and maintains 44px touch
targets. Accessibility and motion rules are documented in ../../DESIGN.md.

## Design tokens

All color, typography, spacing, radius, shadow and motion values come from
`../../colors_and_type.css`. Components never hard-code a hex value, a font
family or a duration. If a value is missing, add it to the token file first.

## Getting started

Copy the token stylesheet and the `fonts/` folder, link the CSS, then open
`index.html` or any file in `components/` to see the component in isolation.
