# Open World Assembly Specifications

## Document status

This document describes the currently implemented structure of the repo as it exists in code today.

It does not treat aspirational copy, placeholder text, or long-range planning documents as implemented behavior.

Sections marked **Provisional** reflect incomplete, placeholder, or ambiguous implementation.

## Current product surface

The current app is a small Expo Router application that presents a public-facing OWA shell.

Implemented scope today:

- a shared application shell with a persistent header and footer
- a public landing page
- placeholder public information pages
- placeholder authentication entry screens
- a placeholder portal entry screen

Not implemented today:

- authenticated user state
- form submission
- data fetching
- persistent storage
- domain models in active use
- interactive assembly, proposal, or participation workflows

## Current routes and screens

The route tree is file-based and defined by the `app` directory.

### `/`

Screen component: `HomePage`

Role:

- public landing page for OWA
- introduces the site as a civic coordination layer
- presents three call-to-action links: `Learn More`, `Read the Docs`, and `Enter Portal`

Implemented content blocks:

- hero section
- short explanatory section
- three summary cards

### `/about`

Screen component: `AboutPage`

Role:

- placeholder public explanation page

Status:

- **Provisional**
- contains static placeholder copy only

### `/docs`

Screen component: `DocsPage`

Role:

- placeholder document hub page

Status:

- **Provisional**
- contains static placeholder copy only
- does not currently render or link the canon, implementation guide, or other repo docs

### `/login`

Screen component: `LoginPage`

Role:

- placeholder authentication entry point

Status:

- **Provisional**
- contains static placeholder copy only
- no form, validation, auth provider, or session handling is implemented

### `/signup`

Screen component: `SignupPage`

Role:

- placeholder account creation entry point

Status:

- **Provisional**
- contains static placeholder copy only
- no form, validation, account creation, or onboarding flow is implemented

### `/portal`

Route file: `app/portal/index.tsx`

Screen component: `PortalPage`

Role:

- placeholder portal landing page
- described in copy as the future authenticated participation surface

Status:

- **Provisional**
- contains static placeholder copy only
- no protected routing, portal modules, or authenticated workspace behavior is implemented

## Current navigation structure

Navigation is implemented with Expo Router and a top-level stack inside `app/_layout.tsx`.

### Shared shell

Every route renders inside a persistent shell composed of:

- `Header`
- main stack content area
- `Footer`

The stack has `headerShown: false`, so navigation chrome is handled by the shared layout components rather than native stack headers.

### Header navigation

The header is the primary global navigation surface.

Top-level header links:

- `Home` -> `/`
- `About` -> `/about`
- `Docs` -> `/docs`
- `Login` -> `/login`
- `Sign Up` -> `/signup`

Current behavior:

- the active link is highlighted by comparing the current pathname to the item `href`
- the brand label `OWA` links to `/`

### Portal access

The portal route is registered in the app stack, but it is not included in the header navigation list.

Current portal entry path:

- CTA button on the home page linking to `/portal`

### Footer

The footer is informational rather than navigational.

Current footer content:

- `Open World Assembly`
- short descriptive subtext about theory, documentation, and portal shell

## Existing workflows

The implemented workflows are simple navigation flows rather than functional product workflows.

### Public orientation workflow

Implemented flow:

1. user lands on `/`
2. user reads public framing and summary cards
3. user navigates to `/about`, `/docs`, or `/portal`

### Public site navigation workflow

Implemented flow:

1. user uses the persistent header on any route
2. user moves among the public pages
3. current page is indicated by active header link styling

### Portal discovery workflow

Implemented flow:

1. user reaches the landing page
2. user selects `Enter Portal`
3. user is taken to the placeholder portal page

Status:

- **Provisional**
- this is route navigation only, not a real participation flow

### Authentication workflow

Status:

- **Provisional**
- `/login` and `/signup` exist as destinations only
- there is no implemented sign-in, sign-up, identity, session, or access control workflow

### Documentation workflow

Status:

- **Provisional**
- `/docs` exists as a destination only
- there is no implemented document index, file rendering, or canon browsing workflow inside the app

## Major entities and their roles

The current implementation contains very few product-level entities.

### Implemented application entities

#### App shell

Defined by `app/_layout.tsx`.

Role:

- wraps the whole app in a theme provider
- applies the persistent shell
- defines the stack route list

#### Header

Defined by `components/layout/header.tsx`.

Role:

- renders the global brand and top-level navigation
- determines which nav item is active based on pathname

#### Footer

Defined by `components/layout/footer.tsx`.

Role:

- renders persistent site footer copy

#### Screen components

Defined by the route files under `app`.

Role:

- each route owns its own visible page content
- pages are currently self-contained and mostly static

### Domain-level entities

Status:

- **Provisional**
- no active domain entity system is implemented in the app today

Important note:

- terms such as `assemblies`, `proposals`, and `participation` appear in page copy only
- they are not currently backed by route-specific modules, data schemas in use, or runtime workflows

### Data and schema entities

Status:

- **Provisional**
- `data/schemas` exists as a directory, but no active schema files are present there
- `domain` and `lib` directories are present in the repo, but there is no implemented application behavior currently using them

## Current architecture patterns

### Routing pattern

- Expo Router file-based routing
- one top-level stack in `app/_layout.tsx`
- direct route files for simple pages
- nested folder route for `/portal` via `app/portal/index.tsx`

### Layout pattern

- one shared shell for all routes
- header and footer live outside the stack content
- page components render inside a centered content container

### Component pattern

- function components throughout
- route screens use default exports
- layout pieces are split into reusable components under `components/layout`

### Styling pattern

- styling is done with `StyleSheet.create`
- screens define local `styles` objects in the same file
- active route files do not use NativeWind classes

### Import pattern

- path alias imports use `@/`
- active layout code imports shared components and hooks through the alias

### Theme pattern

- app shell uses `ThemeProvider` from `@react-navigation/native`
- color scheme is resolved through `useColorScheme`
- active route styling mostly uses explicit hard-coded colors rather than shared theme tokens

### State and data pattern

- current pages are stateless
- there is no app-wide state container
- there are no API calls or persisted app data flows in the active routes

## Current naming patterns

The implemented naming is consistent with a small React and Expo codebase.

### Route file naming

- route filenames are lowercase
- route files match URL segments directly
- nested routes use directory plus `index.tsx`

Examples:

- `app/index.tsx`
- `app/about.tsx`
- `app/portal/index.tsx`

### Component naming

- React component names use PascalCase
- route components end with `Page`
- layout components use plain descriptive names such as `Header` and `Footer`

Examples:

- `HomePage`
- `AboutPage`
- `PortalPage`
- `Header`
- `Footer`

### Style object naming

- each file uses a local `styles` constant
- style keys are descriptive and tied to UI role

Examples:

- `page`
- `hero`
- `actions`
- `primaryButton`
- `navTextActive`

## Repo structure in current use

### Active implementation areas

- `app`
  - route files and app shell
- `components/layout`
  - shared header and footer used by the live app
- `hooks`
  - color scheme and theme helpers
- `constants/theme.ts`
  - shared theme constants and font mappings

### Present but not active in the current route surface

- `components`
  - includes several starter or generic UI helpers that are not used by the current route files
- `data`
  - contains an empty `schemas` directory
- `domain`
  - present but not currently part of the implemented route behavior
- `lib`
  - present but not currently part of the implemented route behavior

## Implementation boundaries

The current codebase is still at a shell stage.

What is implemented:

- public route structure
- persistent layout
- static content pages
- basic link-based navigation

What remains unimplemented but is referenced by copy or planning docs:

- document browsing inside the app
- authentication and account flows
- portal feature modules
- domain objects for assemblies or proposals
- data architecture connected to runtime behavior

## Provisional notes

The following areas should be treated as provisional until implemented in code:

- meaning of the portal beyond its placeholder page
- authentication requirements and flow shape
- document hub structure
- domain model for assemblies, proposals, actions, or records
- use of `domain`, `data`, and `lib` directories
- any architecture described in `docs/implementation-guide.md` that is not yet represented in executable code
