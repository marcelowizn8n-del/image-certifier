# Image Certifier

## Overview

Image Certifier is a web application that detects whether images are AI-generated or authentic. Users can upload images via file, URL, or camera to receive analysis results including confidence scores, artifact detection, and metadata analysis. The application supports single image analysis, batch processing, and maintains a history dashboard of past analyses.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Internationalization System (i18n)
- Added multi-language support: Portuguese, English, Spanish, French, German, Chinese
- Language selector in header with language code display (PT, EN, ES, FR, DE, ZH)
- Translations stored in `client/src/lib/i18n.ts`
- LanguageContext provider in `client/src/contexts/LanguageContext.tsx`
- Language preference persisted to localStorage

### Admin Dashboard
- New Admin page at `/admin` with statistics cards
- Shows total analyses, original images, AI-generated, and AI-modified counts
- Displays recent analysis history

### Footer & Legal Pages
- Footer with MFA developer logo, contact email, and legal links
- Privacy Policy page at `/privacy`
- Terms of Use page at `/terms`
- About page at `/about` with features list

### Component Refactoring
- Extracted reusable Header component with navigation
- Extracted reusable Footer component

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for theme
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Animations**: Framer Motion for loading animations and transitions
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Framework**: Express.js 5 on Node.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api` prefix
- **Image Processing**: Base64 encoding for image data transmission
- **Analysis Engine**: GPT-4o vision model via Replit AI Integrations for high-accuracy AI detection
  - Combines AI vision analysis with technical EXIF/noise/artifact analysis
  - Uses `response_format: { type: "json_object" }` for structured responses
  - EXIF boost for camera-confirmed photos increases confidence
  - Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Current Storage**: In-memory storage (`MemStorage` class) for development
- **Database Ready**: Schema configured for PostgreSQL with `gen_random_uuid()` for IDs
- **Key Tables**: 
  - `users` - Basic authentication (username/password)
  - `analyses` - Image analysis results with metadata, artifacts, and debug scores

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components
│       ├── contexts/     # React contexts (theme)
│       ├── hooks/        # Custom hooks
│       ├── lib/          # Utilities and query client
│       └── pages/        # Route components
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data access layer
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared types and schemas
│   └── schema.ts     # Drizzle schema + Zod validation
└── migrations/       # Database migrations (Drizzle Kit)
```

### Build Process
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Key scripts: `npm run dev`, `npm run build`, `npm run db:push`

## External Dependencies

### Database
- **PostgreSQL**: Required for production (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Schema push command `npm run db:push` syncs schema to database

### UI Framework Dependencies
- **Radix UI**: Full suite of accessible component primitives
- **shadcn/ui**: Pre-configured component styling (new-york style, neutral base color)
- **Tailwind CSS**: Utility-first CSS with custom design tokens

### State and Data Fetching
- **TanStack Query**: Server state management with caching
- **Zod**: Runtime type validation (integrated with Drizzle via drizzle-zod)

### Animation and UX
- **Framer Motion**: Animation library for React
- **Sonner**: Toast notification system
- **Embla Carousel**: Carousel/slider functionality

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development environment indicator