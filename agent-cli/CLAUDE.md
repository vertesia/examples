# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a sample CLI application that demonstrates how to use Vertesia's Agent Runner SDK. The project uses TypeScript and is set up with ESLint, Prettier for code quality.

## Environment Setup

The application requires three environment variables to be set in a `.env` file:

- `VERTESIA_ENVIRONMENT` - The URL for the Vertesia API (default: <https://api.vertesia.io>)
- `VERTESIA_API_KEY` - Your Vertesia API key

## Common Commands

### Development

- **Start the application**: `npm run start` (uses Bun to run the TypeScript directly)
- **Build the application**: `npm run build` (compiles TypeScript to JavaScript in the `lib` directory)
- **Clean build artifacts**: `npm run clean`

### Code Quality

- **Lint the code**: `npm run lint`
- **Format the code**: `npm run format`

## Project Structure

- `src/index.ts` - Main entry point
- `lib/` - Output directory for compiled JavaScript
- `.env` - Environment configuration file (not committed to the repository)

## Architecture

The application uses the `@vertesia/client` SDK to interact with Vertesia's API. The main workflow:

1. Load environment variables from `.env`
2. Initialize the Vertesia client with configuration
3. Execute an asynchronous interaction (conversation)
4. Stream and display the messages from the interaction

When extending this application, follow the pattern of using the Vertesia client's methods to create and manage interactions through their API.
