# eStory Design System Documentation

> **Design Philosophy:** "Narrative Luminance" — A refined, editorial aesthetic where stories breathe through generous space, subtle motion, and emotional color.

This document serves as a comprehensive guide for maintaining visual consistency and implementing new features in the eStory application.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Tech Stack](#tech-stack)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Component Patterns](#component-patterns)
6. [Animation Guidelines](#animation-guidelines)
7. [3D Background System](#3d-background-system)
8. [Responsive Design](#responsive-design)
9. [Accessibility](#accessibility)
10. [File Structure](#file-structure)
11. [Implementation Guide](#implementation-guide)

---

## Design Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Restraint** | One gradient CTA per page. Solid colors dominate; gradients are rare and earned. |
| **Typography-Led** | Let text communicate. Reduce icon noise. Use display fonts for hierarchy. |
| **Emotional Color** | Colors have meaning. Tones map to emotions, domains map to life areas. |
| **Subtle Motion** | One hero animation per page. Everything else quiet and purposeful. |
| **Space to Breathe** | Generous padding. Not every pixel needs content. |

### What This Design Is NOT

- No AI-generated pattern aesthetics (rainbow gradients, mechanical color rotation)
- No ubiquitous glow effects on every element
- No staggered animations on every grid
- No cookie-cutter identical cards

---

## Tech Stack

### Frontend Framework
```
Next.js 15.5.9 (App Router)
React 19
TypeScript 5.x
```

### Styling
```
Tailwind CSS 4
CSS Custom Properties (design tokens)
Framer Motion (animations)
```

### UI Components
```
shadcn/ui (Radix primitives)
Lucide React (icons)
```

### 3D Graphics
```
Three.js
@react-three/fiber
@react-three/drei
```

### State & Data
```
React Context (app state)
TanStack Query (server state)
Wagmi + Viem (Web3)
Supabase (database)
```

---

## Color System

### Memory Space Theme

The color system is built around four semantic color scales plus emotional tones.

#### Core Scales (HSL format in CSS variables)

```css
/* Void (Background Depths) */
--void-deep: 233 10% 4%;      /* Deepest background */
--void-medium: 233 10% 8%;    /* Elevated surfaces */
--void-light: 233 10% 12%;    /* Cards, inputs */
--void-surface: 233 10% 16%;  /* Interactive surfaces */

/* Memory Blue (Primary - Trust & Stability) */
--memory-500: 217 91% 50%;    /* Primary actions */
--memory-600: 217 91% 40%;    /* Hover states */

/* Insight Purple (Secondary - Cognition & Wisdom) */
--insight-500: 258 90% 55%;   /* AI features, insights */
--insight-600: 258 90% 45%;

/* Story Amber (Accent - Personal Warmth) */
--story-500: 38 92% 50%;      /* Canonical stories, rewards */
--story-600: 38 92% 40%;

/* Growth Emerald (Success - Progress) */
--growth-500: 160 84% 45%;    /* Success, streaks */
--growth-600: 160 84% 35%;
```

#### Emotional Tone Colors

Used for story card borders and mood indicators:

```css
--tone-reflective: 220 60% 50%;   /* Blue - contemplation */
--tone-joyful: 45 90% 55%;        /* Yellow - happiness */
--tone-anxious: 0 70% 55%;        /* Red - worry */
--tone-hopeful: 170 70% 45%;      /* Teal - optimism */
--tone-melancholic: 250 40% 50%;  /* Purple - sadness */
--tone-grateful: 330 70% 55%;     /* Pink - appreciation */
--tone-frustrated: 15 80% 50%;    /* Orange - anger */
--tone-peaceful: 180 50% 45%;     /* Cyan - calm */
--tone-excited: 35 90% 55%;       /* Amber - enthusiasm */
--tone-uncertain: 200 20% 50%;    /* Gray-blue - doubt */
```

#### Life Domain Colors

Used for categorizing stories:

```css
--domain-work: 220 70% 50%;
--domain-relationships: 340 75% 55%;
--domain-health: 150 70% 45%;
--domain-identity: 280 65% 55%;
--domain-creativity: 30 85% 55%;
--domain-family: 350 70% 55%;
--domain-adventure: 195 85% 50%;
--domain-learning: 45 80% 50%;
```

### Usage Patterns

```tsx
// Primary button (gradient - use sparingly)
className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"

// Secondary button (solid)
className="btn-solid-memory"

// Card with emotional tone border
className="card-tone card-tone-joyful"

// Subtle badge
className="badge-subtle"

// Text gradient (headlines only)
className="text-gradient-cosmic"
```

---

## Typography

### Font Stack

```css
--font-display: 'Fraunces', Georgia, serif;  /* Headlines */
--font-body: system-ui, -apple-system, sans-serif;  /* Body text */
```

### Hierarchy Classes

```css
/* Hero titles - largest, most prominent */
.heading-display-lg {
  font-family: var(--font-display);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

/* Section headers */
.heading-section {
  font-family: var(--font-display);
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

/* Display font utility */
.font-display {
  font-family: var(--font-display);
}
```

### Usage Examples

```tsx
// Hero headline
<h1 className="heading-display-lg text-4xl md:text-6xl lg:text-7xl">
  <span className="text-gradient-cosmic">Your Life Stories,</span>
  <br />
  <span className="text-foreground">Immortalized Forever</span>
</h1>

// Section header
<h2 className="heading-section text-3xl md:text-4xl text-foreground">
  Built for <span className="text-gradient-memory">Modern Storytelling</span>
</h2>

// Body text
<p className="text-muted-foreground leading-relaxed">
  Description text here...
</p>
```

---

## Component Patterns

### Cards

#### Elevated Card (Default)
```tsx
<Card className="card-elevated hover-shadow-subtle">
  {/* Standard card with subtle shadow hover */}
</Card>
```

#### Canonical Card (Important Stories)
```tsx
<Card className="card-canonical border-[hsl(var(--story-500)/0.3)]">
  {/* Amber glow, special treatment */}
</Card>
```

#### Tone Card (Emotional Stories)
```tsx
<Card className="card-tone card-tone-joyful">
  {/* Left border colored by emotional tone */}
</Card>
```

### Buttons

#### Primary CTA (ONE per page)
```tsx
<Button className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] hover:from-[hsl(var(--memory-500))] hover:to-[hsl(var(--insight-500))] text-white">
  Primary Action
</Button>
```

#### Secondary Actions (Solid)
```tsx
<Button className="btn-solid-memory">Secondary</Button>
<Button className="btn-solid-insight">Insight Action</Button>
<Button className="btn-solid-story">Story Action</Button>
<Button className="btn-solid-growth">Success Action</Button>
```

#### Outline Button
```tsx
<Button
  variant="outline"
  className="border-[hsl(var(--memory-500)/0.2)] hover:border-[hsl(var(--memory-500)/0.4)] hover:bg-[hsl(var(--memory-500)/0.05)]"
>
  Outline
</Button>
```

### Badges

#### Subtle Badge
```tsx
<span className="badge-subtle inline-flex items-center gap-2">
  <Icon className="w-3.5 h-3.5" />
  Badge Text
</span>
```

#### shadcn Badge
```tsx
<Badge variant="secondary" className="badge-subtle text-xs">
  Tag
</Badge>
```

### Icon Usage

**Guidelines:**
- Reduce icon noise. Not every feature needs an icon.
- Icons should be 16-20px for inline, 24px for feature cards
- Use consistent icon weight (Lucide default)

```tsx
// Inline with text
<Icon className="w-4 h-4 mr-1" />

// Feature card icon
<div className="w-10 h-10 rounded-lg bg-[hsl(var(--memory-500)/0.1)] flex items-center justify-center">
  <Icon className="w-5 h-5 text-[hsl(var(--memory-500))]" />
</div>
```

---

## Animation Guidelines

### Core Rule: Restraint

Each page gets **ONE** orchestrated animation moment — typically the hero section entrance. Everything else appears statically.

### Hero Entrance (Framer Motion)

```tsx
<motion.section
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
>
  {/* Hero content */}
</motion.section>
```

### What NOT to Animate

- Feature grids (static appearance)
- Stats cards (static)
- Testimonials (static)
- List items (static)
- Navigation items (static)

### Allowed Animations

| Animation | Use Case |
|-----------|----------|
| Hero entrance | Page load, single section |
| Hover transforms | Cards (translateY(-2px)) |
| Loading spinners | Async operations |
| 3D background | Ambient, non-intrusive |
| Record pulse | Recording indicator |

### CSS Transition Utilities

```css
.hover-shadow-subtle:hover {
  box-shadow: 0 8px 30px hsl(0 0% 0% / 0.12);
  transform: translateY(-2px);
}

.transition-fast { transition-duration: 150ms; }
.transition-normal { transition-duration: 250ms; }
.transition-slow { transition-duration: 400ms; }
```

---

## 3D Background System

### Architecture

```
contexts/BackgroundContext.tsx   → Provider & hooks
types/background.ts              → Type definitions
components/three/
  ├── GlobalBackground.tsx       → Main canvas + fallback
  ├── GlobalBackgroundDynamic.tsx → SSR-safe wrapper
  ├── BackgroundParticles.tsx    → Floating dust motes
  └── BackgroundOrbs.tsx         → Large soft glows
```

### Page Modes

Each page sets its background mode via hook:

```tsx
import { useBackgroundMode } from '@/contexts/BackgroundContext';

export default function RecordPage() {
  useBackgroundMode('record');
  // ...
}
```

| Mode | Character |
|------|-----------|
| `home` | Slow drift, warm tones, mouse parallax |
| `record` | Subtle pulse, focused feel |
| `library` | Vertical scroll parallax, archival calm |
| `story` | Color tinted by emotional_tone |
| `profile` | Orbital slow motion |
| `social` | Network connections visible |

### Performance Considerations

The system automatically:
- Falls back to CSS gradient on mobile/low-power devices
- Respects `prefers-reduced-motion`
- Limits pixel ratio to 2x
- Uses `low-power` GPU preference

```tsx
// Device capability check
const { shouldUse3D, supportsWebGL } = useDeviceCapability();
const prefersReducedMotion = useReducedMotion();
```

---

## Responsive Design

### Breakpoints (Tailwind)

```
sm: 640px   → Mobile landscape
md: 768px   → Tablet
lg: 1024px  → Desktop
xl: 1280px  → Large desktop
2xl: 1536px → Extra large
```

### Common Patterns

```tsx
// Grid responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Typography responsive
<h1 className="text-4xl md:text-6xl lg:text-7xl">

// Spacing responsive
<section className="space-y-8 md:space-y-12 lg:space-y-16">

// Flex direction
<div className="flex flex-col sm:flex-row gap-4">
```

### Mobile-First Approach

Always start with mobile styles, add larger breakpoints:

```tsx
// Correct
className="p-4 md:p-6 lg:p-8"

// Avoid
className="lg:p-8 md:p-6 p-4"  // Works but harder to read
```

---

## Accessibility

### Color Contrast

- All text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- Don't rely on color alone for meaning (use icons + text)

### Reduced Motion

```tsx
import { useReducedMotion } from '@/app/hooks/useReducedMotion';

const prefersReducedMotion = useReducedMotion();

// CSS also respects this
@media (prefers-reduced-motion: reduce) {
  .animate-* { animation: none !important; }
}
```

### Focus States

```css
.focus-ring-memory:focus-visible {
  outline: 2px solid hsl(var(--memory-500));
  outline-offset: 2px;
}
```

### Semantic HTML

- Use proper heading hierarchy (h1 → h2 → h3)
- Use `<button>` for actions, `<a>` for navigation
- Include `aria-label` for icon-only buttons

---

## File Structure

### Design System Files

```
styles/
  └── design-system.css    → All design tokens & utilities

app/
  └── globals.css          → Imports, base styles

types/
  └── background.ts        → 3D background types

contexts/
  └── BackgroundContext.tsx → Background state

components/
  ├── ui/                  → shadcn/ui components
  └── three/               → 3D background components

app/hooks/
  ├── useReducedMotion.ts  → Motion preference
  └── useDeviceCapability.ts → Device detection
```

### Adding New Design Tokens

1. Add CSS variable to `styles/design-system.css`
2. Add Tailwind mapping in `app/globals.css` `@theme inline` block
3. Document in this file

---

## Implementation Guide

### Adding a New Page

```tsx
"use client";

import { useBackgroundMode } from "@/contexts/BackgroundContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewPage() {
  // 1. Set background mode
  useBackgroundMode('home'); // or appropriate mode

  return (
    <div className="space-y-16">
      {/* 2. Hero section with SINGLE animation */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-8"
      >
        <h1 className="heading-display-lg text-4xl md:text-6xl">
          Page Title
        </h1>

        {/* 3. ONE gradient CTA */}
        <Button className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]">
          Primary Action
        </Button>
      </motion.section>

      {/* 4. Static content sections */}
      <section className="space-y-8">
        <h2 className="heading-section text-3xl">Section Title</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card key={item.id} className="card-elevated hover-shadow-subtle">
              {/* Card content */}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Adding a New Component

```tsx
// components/MyComponent.tsx
import { cn } from "@/lib/utils";

interface MyComponentProps {
  variant?: 'default' | 'canonical';
  className?: string;
  children: React.ReactNode;
}

export function MyComponent({
  variant = 'default',
  className,
  children
}: MyComponentProps) {
  return (
    <div
      className={cn(
        // Base styles
        "rounded-xl p-4",
        // Variant styles
        variant === 'default' && "card-elevated hover-shadow-subtle",
        variant === 'canonical' && "card-canonical",
        // Allow override
        className
      )}
    >
      {children}
    </div>
  );
}
```

### Checklist for New Features

- [ ] Uses design tokens (not hardcoded colors)
- [ ] ONE gradient button max per page
- [ ] No staggered animations on grids
- [ ] Proper heading hierarchy
- [ ] Mobile-responsive
- [ ] Respects reduced motion
- [ ] Uses semantic HTML
- [ ] Consistent spacing (`space-y-*`, `gap-*`)

---

## Quick Reference

### Common Classes

| Class | Purpose |
|-------|---------|
| `card-elevated` | Standard card with shadow |
| `card-canonical` | Important story card with glow |
| `card-tone` | Card with emotional border |
| `card-tone-{emotion}` | Specific emotion border |
| `hover-shadow-subtle` | Shadow + lift on hover |
| `badge-subtle` | Understated badge |
| `btn-solid-{color}` | Solid color button |
| `heading-display-lg` | Hero headlines |
| `heading-section` | Section headers |
| `text-gradient-cosmic` | Multi-color gradient text |
| `text-gradient-memory` | Blue gradient text |

### Color Usage Cheatsheet

| Context | Color |
|---------|-------|
| Primary actions | memory-500/600 |
| AI/Insights | insight-500/600 |
| Canonical/Rewards | story-500/600 |
| Success/Growth | growth-500/600 |
| Background | void-deep/medium/light/surface |
| Emotions | tone-{emotion} |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial design system with Memory Space theme |
| 1.1.0 | Jan 2026 | Added "Narrative Luminance" philosophy, 3D backgrounds |

---

*This document should be updated whenever significant design changes are made.*
