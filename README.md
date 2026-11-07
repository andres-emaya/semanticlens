# SemanticLens

🔗 **Live demo:** https://andres-emaya.github.io/semanticlens/

An NLP-based retrieval website for the **CLEF IAPR TC-12** image annotation collection (20,000 English annotations). It combines lexical search, query operators, stemming, query expansion and TF-IDF ranking, and shows *why* each result was returned.

Final project for an NLP course by **Andres Emaya, Ahmed, Sanabel and Carl**.

## Features

- **Query syntax:** Boolean (`church AND NOT mountain`), exact phrases (`"palm trees"`), proximity (`palm /2 tree`), wildcards (`bea*`) and regular expressions
- **Zone search:** title, description, notes, location or date
- **Stemming:** simplified Porter-style, Lancaster-style and manual suffix rules
- **Spelling correction** (edit distance) and **autocomplete** from co-occurring terms
- **Query expansion:** a small hand-curated, WordNet-style dictionary plus co-occurrence statistics from the collection
- **Ranking:** TF-IDF cosine scoring combined with match evidence
- **Explanations:** every result lists the matching strategies that contributed to it

Dataset images are not included in this repository. Results show a stock photo clearly labeled *"Internet fallback – not from the dataset"*. When running locally, put the dataset images in `public/iaprtc12/images` and the real images are shown instead.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Data

`public/data/iaprtc12-eng.json` contains the 20,000 English annotations, compiled from the official IAPR TC-12 archive with:

```bash
npm run build:data   # reads data/iaprtc12/annotations/**/*.eng
```

The live demo is a static build (`npm run build:static`) where the same retrieval engine runs in the browser. It is published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Dataset

[IAPR TC-12 Benchmark](https://www.imageclef.org/photodata) (ImageCLEF), available free of charge and without copyright restrictions.

> Grubinger, M., Clough, P., Müller, H., & Deselaers, T. (2006). The IAPR TC-12 Benchmark: A New Evaluation Resource for Visual Information Systems. *Proceedings of LREC 2006*, 13–23.

**Built with:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion
