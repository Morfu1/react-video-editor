# React Video Editor - Agent Guidelines

## Commands
- **Dev**: `pnpm dev` (frontend), `cd server && npm run dev` (backend)
- **Build**: `pnpm run build` (tsc + vite build)
- **Lint**: `pnpm run lint` (ESLint)
- **Format**: Use Prettier with Tailwind plugin
- **Server**: `cd server && npm start` or `npm run dev` (with nodemon)

## Code Style
- **Frontend**: TypeScript React with Vite, TSX files
- **Backend**: CommonJS Node.js, .js files with require()
- **Imports**: Use ES6 imports in frontend, require() in backend
- **Exports**: Default exports for components, named exports for utilities
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Types**: Use TypeScript interfaces and strict typing
- **Paths**: Use @/* alias for src/ imports
- **Components**: Functional components with hooks
- **State**: Zustand for global state management
- **UI**: Radix UI components with Tailwind CSS classes
- **Error Handling**: Try-catch blocks with console.error logging
- **Comments**: JSDoc for complex functions, especially in server code