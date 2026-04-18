# AGENTS.md

## Project Overview
Flower Life e-commerce demo built with Node.js, Express, SQLite, EJS, Vue 3, and Tailwind CSS.

## Common Commands
- npm install
- npm run start
- npm run dev:server
- npm run dev:css
- npm run css:build
- npm run openapi
- npm run test

## Key Development Rules
- Use consistent API response format: { data, error, message }
- Admin APIs require authentication and role check
- Cart supports both JWT (user) and session (guest)
- Keep business logic explicit and close to the route flow unless a shared abstraction is clearly needed

## Docs
- ./docs/README.md
- ./docs/ARCHITECTURE.md
- ./docs/DEVELOPMENT.md
- ./docs/FEATURES.md
- ./docs/TESTING.md
- ./docs/CHANGELOG.md