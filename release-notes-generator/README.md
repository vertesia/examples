# LLM-powered Release Notes Generator with Vertesia

A command-line tool that automatically generates release notes by analyzing GitHub repositories, comparing git tags, extracting issues, and using AI to create concise, readable summaries, using Vertesia.

## Features

- Compare two git tags and extract meaningful changes
- Fetch referenced GitHub issues and link them to commits
- Analyze code diffs to understand technical changes
- Filter and process content to reduce token usage
- Generate comprehensive release notes with AI assistance via Vertesia
- Intelligent caching to reduce API usage and improve speed

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git
- A GitHub Personal Access Token (for higher API rate limits)
- A Vertesia Auth Token

### Setup

1. Clone this repository:
```bash
git clone https://github.com/yourusername/release-notes-generator.git
cd release-notes-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your tokens:
```
GITHUB_TOKEN=your_github_token_here
VERTESIA_AUTH_TOKEN=your_vertesia_token_here
```

## Usage

Basic usage:

```bash
npx ts-node index.ts --repo owner/repo --start-tag v1.0.0 --end-tag v1.1.0
```

```bash
bun run index.ts --repo owner/repo --start-tag v1.0.0 --end-tag v1.1.0
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --repo <owner/repo>` | GitHub repository in owner/repo format | (Required) |
| `-s, --start-tag <tag>` | Starting tag for comparison | (Required) |
| `-e, --end-tag <tag>` | Ending tag for comparison | (Required) |
| `-o, --output-dir <directory>` | Output directory for generated files | `./output` |
| `-g, --github-token <token>` | GitHub API token | From env var |
| `-v, --verbose` | Enable verbose output | `false` |
| `-t, --vertesia-auth-token <token>` | Vertesia auth token | From env var |
| `--hips <text>` | High-level importance points for the release | `""` |
| `--skip-custom-function` | Skip custom function and use Vertesia only | `false` |
| `--token-limit <number>` | Maximum token limit for API requests | `80000` |
| `--model <string>` | Model to use for AI generation | `publishers/google/models/gemini-2.0-flash-001` |
| `--environment <string>` | Vertesia environment ID | `67814731ffb102cc19c2a58d` |

### Examples

Generate release notes with high-level points:

```bash
npx ts-node index.ts --repo microsoft/vscode --start-tag 1.68.0 --end-tag 1.69.0 --hips "This release focuses on performance improvements and accessibility features"
```

Enable verbose logging:

```bash
npx ts-node index.ts --repo facebook/react --start-tag v17.0.0 --end-tag v18.0.0 --verbose
```

Set a custom token limit:

```bash
npx ts-node index.ts --repo angular/angular --start-tag 13.0.0 --end-tag 14.0.0 --token-limit 50000
```

Use a different model and environment:

```bash
npx ts-node index.ts --repo tensorflow/tensorflow --start-tag v2.8.0 --end-tag v2.9.0 --model "publishers/anthropic/models/claude-3-haiku-20240307" --environment "your-environment-id"
```

## How It Works

1. **Repository Analysis**: The tool clones or fetches the target repository and checks out the relevant tags.
2. **Commit Extraction**: Identifies all commits between the specified tags.
3. **Issue Identification**: Parses commit messages to find referenced issues.
4. **Data Collection**: Fetches full issue details and code diffs.
5. **Intelligent Filtering**: Processes and filters content to focus on the most relevant changes.
6. **Token Management**: Counts and optimizes token usage for API requests.
7. **Release Note Generation**: Uses Vertesia's AI to generate well-structured, human-readable release notes.

## Output

The tool generates the following outputs in the specified directory:

- `release-highlights-[start-tag]-[end-tag].md`: The final release notes
- `issues/`: Directory containing individual markdown files for each issue
- `issues/issues.json`: JSON file with all issue data
- `diffs/`: Directory containing code diffs
- `diffs/combined-diff.md`: Combined code diff in markdown format

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
