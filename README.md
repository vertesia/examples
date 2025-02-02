# LLM-powered Apps: Vertesia SDK Examples

This repository is the reference for [Vertesia SDK](https://docs.vertesiahq.com/). It features examples to showcase various use of Vertesia in various use cases and environment.

The examples are using public [Interactions](https://docs.vertesiahq.com/concepts#interactions), so you only need a Vertesia account, and an API to test and get started.

## List of examples

| name                                       | description                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [proodread-doc](./proofread-doc/)          | CLI script to proofread markdown documentation                                           |
| [story-generator-react](./story-generator) |  Story Generator in React, using Streaming and Parameters                                |
| [story-generator](./story-generator)       |  CLI Generate a story using various LLMs and input parameters, with or without streaming |

## How to use

We use [bun](https://bun.sh) to make it easier and less verbose to quickly execute and test the examples. Alternatively you can also use `node-ts --esm` to run them.

To run an example, in this case `proofread-doc`:

```bash
$ export VERTESIA_API_KEY=<your api key>
$ cd proofread-doc

#Run with Bun
$ bun index.ts README.md

#Alternatively, run with node-ts
$ node-ts --esm index.ts README.md
```

## About Vertesia

Vertesia is a set of tools, API service, and middleware to facilitate using LLMs — and generative AI models in general — in applications. It offers an advanced Prompt Studio, to compose and reuse prompts, an execution service to run tasks on many environements, TypeScript integration to keep everything typed and tidy, and many other aspects.

To learn more:

-   [Vertesia](https://vertesiahq.com)
-   [Docs](https://docs.vertesiahq.com)
