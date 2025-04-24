# Semantic Layer Sample: Invoice Line Item Extraction

A command-line tool that uploads an invoice PDF file to Vertesia and triggers the semantic layer analysis.

## Features

- Upload a PDF and get a structured XML conversion that includes images OCR and also captures the meaning of the page layouts.
- Extract line items as a table in a custom format

## Installation

### Prerequisites

- Git
- Node.js (v18 or higher)
- npm
- A Vertesia Account and API Key

### Setup

1. Clone this repository:

```bash
git clone https://github.com/vertesia/examples.git
cd semantic-layer-invoice-line-item-extraction
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your api key:

```bash
cat << EOF > .env
STUDIO_URL=https://staging.vertesia.io
ZENO_URL=https://staging.vertesia.io
API_KEY=
EOF
```

## Usage

Basic usage with the provided sample file:

```bash
npm run start
```

or with your own pdf file

```bash
npx bun ./index.ts -- -i <your_file>
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
