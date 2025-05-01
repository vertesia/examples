# Environment Configurator

A command-line tool to easily configure Execution environments in Vertesia

## Features

- Configure an Execution Environment for AWS Bedrock using OpenID Connect (OIDC)

## Installation

### Prerequisites

- Git
- Node.js (v22 or higher)
- npm
- A Vertesia Account and [API Key](https://cloud.vertesia.io/settings#keys)
- [AWS CLI](https://aws.amazon.com/cli/)

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

3. Install your API KEY in an environment file

```bash
cat << EOF > .env
VERTESIA_API_KEY=
EOF
```

or if you already have configured the [Vertesia CLI](https://docs.vertesiahq.com/cli), simply run

```bash
export VERTESIA_API_TOKEN=$(vertesia auth token)
```


## AWS Bedrock 

First, refresh your credentials using the AWS CLI

```bash
aws sso login
```

Then run 

```bash
npm run aws -- -r <BEDROCK_REGION>
```

The list of all the parameters can be displayed using 

```
npm run aws -- -h
```

Finally, activate models and select the default one in [Vertesia Studio](https://staging.cloud.vertesia.io/studio/environments)


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.