# Magic PDF Sample Script 

A command-line tool that uploads a PDF file to Vertesia and triggers the Magic PDF analysis

## Features
- Upload a PDF and get a structured XML conversion that includes images OCR and also captures the meaning of the page layouts. 

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
cd magic-pdf
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your api key:
```
API_KEY=your_api_key
```

## Usage

Basic usage:

```bash
npx start -- -i mypdf.pdf
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
