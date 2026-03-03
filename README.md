# AI Hall of Shame (AHOS)

Welcome to the AI Hall of Shame (AHOS), a humorous single-page application that showcases the quirks and mishaps of artificial intelligence. This project leverages Cloudflare D1 for database management and Cloudflare Workers for serverless functionality.

## Features

- **Passkey Login Flow**: Users can log in effortlessly using passkeys, ensuring a smooth and secure authentication experience.
- **Comment System**: Engage with posts by leaving comments and sharing your thoughts.
- **Upvote/Downvote Functionality**: Help highlight the best (and worst) content by voting on posts and comments.

## Project Structure

The project is organized as follows:

```
ahos
├── src
│   ├── app.html          # Main HTML entry point for the Svelte application
│   ├── app.css           # Global styles for the application
│   ├── lib
│   │   ├── components     # Svelte components for UI
│   │   ├── stores         # Svelte stores for state management
│   │   ├── types          # TypeScript types and interfaces
│   │   └── utils          # Utility functions for API and passkey management
│   └── routes             # Svelte routes for different pages
├── worker
│   ├── index.ts           # Entry point for Cloudflare Worker
│   ├── routes             # API routes for handling requests
│   ├── middleware         # Middleware for authentication
│   └── passkey            # Passkey registration and authentication logic
├── migrations              # SQL migration files for D1 database
├── package.json           # NPM configuration file
├── svelte.config.js       # Svelte application configuration
├── vite.config.ts         # Vite build tool configuration
├── tsconfig.json          # TypeScript configuration
├── wrangler.toml          # Cloudflare Worker deployment configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

## Getting Started

To get started with the AI Hall of Shame project, follow these steps:

1. **Clone the Repository**: 
   ```
   git clone <repository-url>
   cd ahos
   ```

2. **Install Dependencies**: 
   ```
   npm install
   ```

3. **Run the Development Server**: 
   ```
   npm run dev
   ```

4. **Deploy the Cloudflare Worker**: 
   ```
   wrangler publish
   ```

## Contributing

Contributions are welcome! If you have ideas for new features or improvements, feel free to submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

Enjoy exploring the humorous side of AI with AHOS!