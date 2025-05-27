# Vertesia Agent CLI

A command-line interface for interacting with Vertesia's AI agents. This CLI allows you to run conversations with Vertesia agents directly from your terminal.

## Installation

### From Source

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Link the CLI to make it available globally:

   ```bash
   npm link
   ```

## Configuration

Create a `.env` file in the project root with the following variables:

```env
VERTESIA_API_KEY=<your_vertesia_api_key>
```

## Usage

### Getting Help

```bash
agent --help
```

### Running a Simple Agent Conversation

```bash
agent run "Generate 5 creative business ideas for a tech startup and store those as individual content objects in a collection"
```

### Running an Interactive Conversation

```bash
agent run "Help me debug my React application" --interactive
```

### Specifying Agent Type

```bash
agent run "Create a marketing plan" --agent MarketingAgent
```

## Command Options

- `--interactive`, `-i`: Enable interactive mode where you can converse with the agent
- `--agent`, `-a`: Specify the agent type to use (default: MultipurposeAgent)

## Features

- Markdown rendering: Agent responses are rendered as markdown in the terminal
- Interactive mode: Have real-time conversations with agents
- Configurable agent types: Use different specialized agents for different tasks
- Color-coded messages: Easily distinguish between user and agent messages
- Link transformation: Resource references like `store:abc123` and `collection:xyz789` are automatically converted to clickable URLs
- Styled hyperlinks: Links appear with white text and underline for better visibility

## Development

- Run in development mode: `npm run dev`
- Build the project: `npm run build`
- Run linting: `npm run lint`
- Format code: `npm run format`

## License

APL-2.0 © Vertesia
