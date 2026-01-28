# My Stock App (Troqks) - Complete Project Documentation
## 📚 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Configuration Files Deep Dive](#configuration-files-deep-dive)
5. [Styling System](#styling-system)
6. [Components](#components)
7. [Build & Development Flow](#build--development-flow)
---
## 🎯 Project Overview
**Project Name:** Troqks (my-stock-app)  
**Version:** 0.1.0  
**Type:** Stock Market Tracking Application  
**Description:** Track real-time stock prices, get personalized alerts, explore detailed company insights and more
### Key Features (Planned)
- Real-time stock price tracking
- Personalized price alerts
- Detailed company insights
- Dark mode interface
- Responsive design
---
## 🛠️ Technology Stack
### Core Framework & Libraries
| Package | Version | Purpose |
|---------|---------|---------|
| **next** | 16.1.5 | React framework with SSR, SSG, and optimization |
| **react** | 19.2.3 | UI library for building components |
| **react-dom** | 19.2.3 | React rendering for browser DOM |
| **typescript** | ^5 | Type safety for JavaScript |
### Styling
| Package | Version | Purpose |
|---------|---------|---------|
| **tailwindcss** | ^4 | Utility-first CSS framework |
| **@tailwindcss/postcss** | ^4 | PostCSS plugin for Tailwind |
| **tailwind-merge** | ^3.4.0 | Intelligent class merging |
| **clsx** | ^2.1.1 | Conditional class builder |
| **tw-animate-css** | ^1.4.0 | Animation utilities for Tailwind |
### Component Library & UI
| Package | Version | Purpose |
|---------|---------|---------|
| **class-variance-authority** | ^0.7.1 | Component variant management |
| **@radix-ui/react-slot** | ^1.2.4 | Polymorphic component rendering |
| **lucide-react** | ^0.563.0 | Icon library (5000+ icons) |
### Development Tools
| Package | Version | Purpose |
|---------|---------|---------|
| **eslint** | ^9 | Code quality and linting |
| **eslint-config-next** | 16.1.5 | Next.js ESLint rules |
| **babel-plugin-react-compiler** | 1.0.0 | React code optimization |
| **@types/node** | ^20 | TypeScript definitions for Node.js |
| **@types/react** | ^19 | TypeScript definitions for React |
| **@types/react-dom** | ^19 | TypeScript definitions for React DOM |
---
## 📁 Project Structure
```
my-stock-app/
├── app/                          # Next.js App Router directory
│   ├── layout.tsx               # Root layout wrapper
│   ├── page.tsx                 # Home page (/)
│   ├── globals.css              # Global styles & theme
│   └── favicon.ico              # Browser tab icon
│
├── components/                  # Reusable React components
│   └── ui/                      # UI component library
│       └── button.tsx           # Button component
│
├── lib/                         # Utility functions & helpers
│   └── utils.ts                 # cn() utility function
│
├── public/                      # Static assets
│   └── assets/
│       ├── icons/               # SVG icons
│       │   ├── logo.svg
│       │   └── star.svg
│       └── images/              # Images
│           ├── logo.png
│           ├── dashboard.png
│           └── dashboard-preview.png
│
├── Configuration Files
│   ├── package.json             # Project metadata & dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   ├── next.config.ts           # Next.js configuration
│   ├── postcss.config.mjs        # CSS processing config
│   ├── components.json          # shadcn/ui configuration
│   ├── eslint.config.mjs        # Code quality rules
│   ├── next-env.d.ts            # Generated Next.js types
│   └── README.md                # Project documentation
```
---
## ⚙️ Configuration Files Deep Dive
### 1. package.json - Project Manifest
```json
{
  "name": "my-stock-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",        // Development server
    "build": "next build",    // Production build
    "start": "next start",    // Production server
    "lint": "eslint"          // Code quality check
  }
}
```
**Key Concepts:**
- `private: true` - Prevents accidental npm publishing
- Scripts run with `npm run <script>`
- Each script invokes Next.js CLI commands
### 2. tsconfig.json - TypeScript Configuration
**Key Settings:**
| Option | Value | Explanation |
|--------|-------|-------------|
| `target` | ES2017 | Compile to 2017 JavaScript standard |
| `lib` | dom, esnext | Use browser APIs and latest JS |
| `strict` | true | Enable all type checking |
| `jsx` | react-jsx | Use new JSX transform (no React import needed) |
| `moduleResolution` | bundler | Webpack-style module resolution |
| `paths` | @/* | Create `@/` path alias |
**Path Aliases:**
```typescript
// Instead of:
import Button from '../../../components/ui/button'
// You write:
import { Button } from '@/components/ui/button'
```
### 3. next.config.ts - Next.js Configuration
```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,  // Enable React Compiler optimization
};
```
**React Compiler Benefits:**
- Automatic component memoization
- Prevents unnecessary re-renders
- No manual `useMemo`/`useCallback` needed
### 4. postcss.config.mjs - CSS Processing
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},  // Tailwind CSS plugin
  },
};
```
**Processing Pipeline:**
```
globals.css (@import "tailwindcss")
    ↓
PostCSS with Tailwind plugin
    ↓
Final optimized CSS
    ↓
Browser (no unused CSS)
```
### 5. components.json - shadcn/ui Setup
```json
{
  "style": "new-york",
  "rsc": true,                    // React Server Components
  "tsx": true,                    // TypeScript
  "baseColor": "slate",           // Color scheme
  "cssVariables": true,           // Use CSS variables
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```
**What it enables:**
- Install components: `npx shadcn-ui@latest add button`
- Auto-generates TypeScript components
- Consistent theming across library
### 6. eslint.config.mjs - Code Quality
```javascript
import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
const eslintConfig = defineConfig([
  ...nextVitals,   // Web vitals & best practices
  ...nextTs,       // TypeScript rules
]);
```
**Rules Check For:**
- Unused variables
- Unreachable code
- Type mismatches
- Next.js best practices
---
## 🎨 Styling System
### Color Architecture
Your app uses **OKLCH color space** (modern alternative to RGB/HSL):
```
OKLCH = Perceptually Uniform Color Space
├── Lightness (0-1)     : 1 = white, 0 = black
├── Chroma (saturation) : 0 = gray, higher = more color
└── Hue (0-360)         : Color wheel angle
```
### Color Palette
#### Light Mode (`:root`)
```css
--background: oklch(1 0 0);              /* White */
--foreground: oklch(0.129 0.042 264.695); /* Dark blue */
--primary: oklch(0.208 0.042 265.755);   /* Darker blue */
--secondary: oklch(0.968 0.007 247.896); /* Very light gray */
--destructive: oklch(0.577 0.245 27.325); /* Red */
```
#### Dark Mode (`.dark`)
```css
--background: oklch(0.129 0.042 264.695); /* Dark blue */
--foreground: oklch(0.984 0.003 247.858); /* Near white */
--primary: oklch(0.929 0.013 255.508);   /* Light gray-blue */
```
### Extended Color Palette
```css
--color-gray-900:    #050505  /* Almost black (backgrounds) */
--color-gray-800:    #141414  /* Dark gray */
--color-blue-600:    #5862FF  /* Primary blue */
--color-yellow-400:  #FDD458  /* CTA yellow */
--color-teal-400:    #0FEDBE  /* Success teal */
--color-red-500:     #FF495B  /* Error red */
```
### CSS Variables in Action
```css
/* Definition in globals.css */
--background: oklch(1 0 0);
/* Usage in components */
.bg-background { background: var(--background); }
.text-background { color: var(--background); }
/* JavaScript runtime change */
document.documentElement.style.setProperty('--background', 'oklch(0.5 0 0)');
```
### Tailwind Layer System
```css
@layer base {
  /* Lowest priority - global defaults */
  * { border-color: var(--border); }
  body { background: var(--background); }
}
@layer components {
  /* Medium priority - component classes */
  .button { /* styles */ }
}
@layer utilities {
  /* High priority - utility classes */
  .flex { display: flex; }
  .gap-4 { gap: 1rem; }
}
```
**Specificity Order:** `utilities > components > base`
### Custom Utility Classes
#### Layout Utilities
```css
.container              /* Max-width container, responsive padding */
.home-wrapper          /* Flex column, responsive gaps */
.home-section          /* Grid layout, responsive columns */
```
#### Form Utilities
```css
.form-title           /* Large, bold text */
.form-label           /* Small, medium font */
.form-input           /* Styled input field */
```
#### Component Specific
```css
.watchlist-table      /* Stock table styling */
.news-item            /* News card styling */
.alert-item           /* Alert notification styling */
```
---
## 🧩 Components
### Button Component Architecture
**Location:** `components/ui/button.tsx`
#### CVA (Class Variance Authority)
Manages component variants cleanly:
```typescript
const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent",
        secondary: "bg-secondary hover:bg-secondary/80",
        ghost: "hover:bg-accent",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-6 px-2 text-xs",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
        "icon-xs": "size-6",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```
#### Variant Descriptions
| Variant | Use Case | Example |
|---------|----------|---------|
| **default** | Primary actions | Submit, Save, Create |
| **destructive** | Dangerous actions | Delete, Remove, Logout |
| **outline** | Secondary actions | Cancel, Reset, Go Back |
| **secondary** | Alternative actions | Less important buttons |
| **ghost** | Minimal style | Icon buttons, links |
| **link** | Text links | Inline navigation |
#### Size Options
| Size | Height | Use Case |
|------|--------|----------|
| **xs** | 24px | Compact layouts, tags |
| **sm** | 32px | Secondary actions |
| **default** | 36px | Standard buttons |
| **lg** | 40px | Primary CTA |
| **icon*** | 24-40px | Icon-only buttons |
#### Features
✅ **Polymorphic rendering** - Can render as `<button>`, `<a>`, or custom element  
✅ **Accessibility** - Keyboard focus, error states (aria-invalid)  
✅ **Dark mode** - Automatic dark mode support  
✅ **Icon support** - Auto-sizing SVG children  
✅ **Type safe** - Full TypeScript support
#### Usage Examples
```typescript
// Default button
<Button>Click me</Button>
// With variants
<Button variant="destructive" size="lg">Delete</Button>
<Button variant="ghost" size="icon"><Heart /></Button>
<Button variant="link">Learn more</Button>
// As link
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>
// Custom styling
<Button className="w-full">Full Width</Button>
```
---
## 🔧 Utilities
### lib/utils.ts - cn() Function
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
#### What it does:
**clsx** - Builds class strings with conditionals:
```typescript
clsx('flex', isActive && 'bg-blue')
// Result: 'flex' or 'flex bg-blue'
```
**twMerge** - Merges conflicting Tailwind classes:
```typescript
twMerge('px-2 px-4')
// Result: 'px-4' (keeps last, not both)
```
#### Usage Examples
```typescript
// Conditional classes
className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-blue-500',
  isLoading && 'opacity-50 cursor-not-allowed'
)}
// Merge custom with defaults
className={cn(buttonVariants({ variant, size }), customClass)}
// Complex conditionals
className={cn(
  'flex items-center gap-2',
  {
    'bg-red-500': hasError,
    'bg-green-500': isSuccess,
    'bg-gray-200': isLoading
  }
)}
```
---
## 🚀 Build & Development Flow
### Development Server
```bash
$ npm run dev
```
**What happens:**
1. **Next.js starts server** on `http://localhost:3000`
2. **TypeScript compiler** checks types (tsconfig.json)
3. **ESLint** validates code quality (eslint.config.mjs)
4. **PostCSS** processes CSS (postcss.config.mjs)
   - Tailwind plugin converts utilities to CSS
5. **Hot Reload** - Changes refresh instantly
6. **Browser opens** with development server
### Production Build
```bash
$ npm run build
```
**Build Process:**
```
Source Code (.ts, .tsx)
    ↓
TypeScript Compiler (type checking)
    ↓
Next.js Compiler (optimization)
    ↓
Code Splitting
    ├── Server code
    ├── Client code
    └── Static assets
    ↓
CSS Processing
    ├── Remove unused styles
    ├── Minify
    └── Optimize for production
    ↓
Output: .next/ folder (ready to deploy)
```
### Production Server
```bash
$ npm start
```
**Performance Optimizations:**
- ✅ Minified JavaScript
- ✅ Tree-shaking (unused code removed)
- ✅ Code splitting (smaller bundles)
- ✅ Image optimization (next/image)
- ✅ Font optimization (next/font)
- ✅ CSS purging (unused styles removed)
### Code Quality Check
```bash
$ npm run lint
```
**Checks for:**
- Unused variables
- Type errors
- Next.js best practices
- Code style issues
- Potential bugs
---
## 📋 Next.js App Router
### File-Based Routing
```
app/layout.tsx      → Root layout (wraps everything)
app/page.tsx        → Home page (/)
app/dashboard/page.tsx     → /dashboard
app/settings/page.tsx      → /settings
app/api/stocks/route.ts    → POST /api/stocks
```
### Layout Structure
```
app/layout.tsx (Root Layout)
    ├── imports globals.css (all styles)
    ├── imports Geist fonts
    ├── sets metadata (SEO)
    └── renders {children}
        └── app/page.tsx (Home)
            └── Renders content
```
### Metadata (SEO)
```typescript
export const metadata: Metadata = {
  title: "Troqks",
  description: "Track real-time stock prices...",
};
```
**Rendered in HTML:**
```html
<title>Troqks</title>
<meta name="description" content="Track real-time stock prices...">
```
---
## 🎓 Key Concepts
### 1. React Server Components (RSC)
- Components render on server by default
- Smaller bundle size (no JavaScript sent)
- Use `"use client"` for interactive components
- Better security (API keys stay server-side)
### 2. Utility-First CSS (Tailwind)
- Don't write CSS classes
- Compose from utility classes: `flex gap-4 p-6`
- Rapid development
- Consistent spacing/colors
### 3. Type Safety (TypeScript)
- Catch errors at compile time
- Auto-complete in editor
- Refactoring safety
- Self-documenting code
### 4. CSS Variables for Theming
- Change colors at runtime
- No build step needed
- Easy dark mode
- Dynamic theming
### 5. Component Variants (CVA)
- Organize component variations
- Type-safe variant selection
- Cleaner than if-else statements
- Scalable design system
---
## 📝 Development Workflow
### 1. Start Development
```bash
npm run dev
# Open http://localhost:3000
# Files auto-reload on changes
```
### 2. Check Code Quality
```bash
npm run lint
# Fix issues
npx eslint --fix
```
### 3. Build for Production
```bash
npm run build
npm start
# Test production build locally
```
### 4. Deploy
```bash
# Push to git
git push origin main
# Deploy to Vercel (one-click from GitHub)
# Auto-builds and deploys on push
```
---
## 🔗 Resources
- **Next.js Docs:** https://nextjs.org/docs
- **React Docs:** https://react.dev
- **TypeScript Docs:** https://www.typescriptlang.org/docs
- **Tailwind Docs:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com
- **Radix UI:** https://www.radix-ui.com
---
## ✅ Ready to Build
Your project is fully configured with:
- ✅ Modern React 19
- ✅ TypeScript for type safety
- ✅ Tailwind CSS for styling
- ✅ shadcn/ui component library
- ✅ Dark mode support
- ✅ Performance optimizations
- ✅ Code quality tools
**Next Steps:**
1. Create pages in `/app`
2. Build components in `/components`
3. Add API routes in `/app/api`
4. Deploy to Vercel
Happy coding! 🚀
