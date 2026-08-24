# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the app's own creator/developer, tracking their personal gym workouts. Usage is mixed — planning routines and reviewing progress from home (phone/desktop), and logging sets live during the gym session.

## Product Purpose

Gymbro Tracker lets a user create exercises, build workouts from them, and log sets/progress over time, replacing a spreadsheet or a generic fitness app with a tool built to the user's exact workflow.

## Positioning

It is a personally-built tracker, not a competitor chasing feature parity with Strong/Hevy. The differentiator is full ownership of the data model and UX — no free-tier limits, no ads, no unrelated social/gamification features — shaped exactly around how its own user trains.

## Operating Context

- Planning happens at home (routines, exercise catalog).
- Live logging happens in the gym, between sets — likely one-handed, on a phone, in low-attention conditions.
- Existing routes: dashboard, exercise catalog (create/update/list/filter), workouts (create/list/detail), auth (login/register).

## Capabilities and Constraints

- Next.js 15 App Router + React 19 + TypeScript, Tailwind CSS 3.4, shadcn/ui (Radix primitives), Prisma/PostgreSQL, Next-Auth 5.
- Current UI runs on the unmodified shadcn default theme — no distinct visual identity yet.

## Brand Commitments

Name is fixed: "Gymbro Tracker". No logo, palette, or other visual asset is defined yet — full creative freedom for the design system.

## Evidence on Hand

`README.md` has reference screenshots of the current (undifferentiated) UI: sidebar menu, create exercise, exercise list, add exercise to workout, create workout, workout list (`public/assets/images/readme/`).

## Product Principles

1. Fast, low-friction logging during a workout — the app must not get in the way mid-set.
2. Personal-tool honesty over feature-parity chasing — build what this user's training actually needs, not a commercial app's checklist.
3. Minimalist, gym/fitness-inspired identity (moodboard: Gymshark, YoungLA) — bold enough to feel intentional, restrained enough to stay out of the way during use.
