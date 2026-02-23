# Contributing to sd-metadata

Thank you for your interest in contributing to sd-metadata! We welcome contributions from the community.

## How to Contribute

### Reporting Issues

If you encounter any bugs or have feature requests, please [open an issue](https://github.com/enslo/sd-metadata/issues) on GitHub.

### Sample Image Contribution

**We're actively seeking sample images to expand our tool support!** This is one of the most valuable contributions you can make.

#### What We Need

We're particularly interested in sample images from:

- **Experimental Tools** (not yet verified):
  - Easy Diffusion
  - Fooocus
  
- **Unsupported Tools**:
  - Any AI image generation tool not currently listed in our [Tool Support](packages/core/README.md#tool-support) table
  - Different versions of supported tools that may use different metadata formats

#### Sample Image Requirements

To be useful for testing and verification, sample images should:

1. **Be SFW (Safe For Work)** - Images must be appropriate for public repositories and open-source projects
2. **Contain metadata** - Images must have embedded generation metadata (prompt, parameters, etc.)
3. **Be representative** - Ideally include various features:
   - Different models (SD 1.5, SDXL, etc.)
   - Various parameters (steps, CFG, sampler, etc.)
   - Special features if applicable (hires fix, Upscaler, etc.)
4. **Format variety** - If the tool supports multiple formats (PNG/JPEG/WebP), samples in each format are helpful
5. **Be original** - Images should be directly from the tool's output, not modified or re-saved

#### Recommended Prompt Format

For consistency across samples, please use this prompt structure:

```text
{quality tags}, general,
1girl, solo, hatsune miku, #テスト
```

This prompt format is important because it includes:

- **Line breaks** - Tests multi-line prompt parsing
- **Non-ASCII characters** - Tests Unicode handling (the `#テスト` part contains Japanese characters)

Feel free to adjust quality tags based on the model (e.g., `masterpiece, best quality` for anime models).

#### Bonus: Feature Variations

If possible, providing additional samples with these features would be extremely helpful:

- **Hires.fix** - Upscaled images using the built-in hires.fix feature
- **Upscaler** - Images processed with external upscalers

#### How to Submit Samples

1. **Via GitHub Issue**:
   - [Create a new issue](https://github.com/enslo/sd-metadata/issues/new)
   - Title: `[Sample] Tool Name - Format`
   - Attach the image file(s)
   - Mention the tool name and version

2. **Via Pull Request**:
   - Fork the repository
   - Add your sample to `samples/` directory:
     - `samples/png/toolname-description.png`
     - `samples/jpg/toolname-description.jpg`
     - `samples/webp/toolname-description.webp`
   - Create a pull request with a description

> [!NOTE]
> By submitting sample images, you agree that they will be used for testing purposes and included in the repository. Please ensure you have the right to share the images.

### Code Contributions

#### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/enslo/sd-metadata.git
cd sd-metadata

# Install dependencies
pnpm install

# Run tests in watch mode (core)
pnpm --filter @enslo/sd-metadata test:watch
```

#### Development Workflow

1. **Fork and Clone** - Fork the repository and clone your fork
2. **Create a Branch** - Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Write Code** - Make your changes following our coding standards
4. **Write Tests** - Add tests for new functionality
5. **Run Tests** - Ensure all tests pass:
   ```bash
   pnpm --filter @enslo/sd-metadata test
   pnpm --filter @enslo/sd-metadata typecheck
   pnpm lint
   ```
6. **Commit** - Commit your changes with clear, descriptive messages:
   ```bash
   git commit -m "feat: add support for XYZ tool"
   ```
7. **Push and PR** - Push to your fork and create a pull request

#### Coding Standards

- **TypeScript** - All code must be written in TypeScript with proper types
- **Functional Programming** - Prefer pure functions and immutable data structures
- **Testing** - All new features must include tests
- **Documentation** - Update README.md and JSDoc comments as needed
- **Linting** - Code must pass Biome linting (`pnpm lint`)

#### Commit Message Format

We follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Build process or auxiliary tool changes

### Adding Support for New Tools

If you want to add support for a new AI tool:

1. **Provide Sample Images** - Start with sample images from the tool
2. **Analyze Metadata Format** - Examine how the tool stores metadata
3. **Create Parser** - Add a parser in `packages/core/src/parsers/`
4. **Create Converter** - Add a converter in `packages/core/src/converters/`
5. **Add Tests** - Add unit and sample tests
6. **Update Documentation** - Update README.md tool support table

See existing parsers and converters as examples.

## Development Commands

This is a pnpm workspace monorepo. Common commands:

```bash
# Install dependencies
pnpm install

# Build and test (core)
pnpm --filter @enslo/sd-metadata build
pnpm --filter @enslo/sd-metadata test

# Build and test (lite)
pnpm --filter @enslo/sd-metadata-lite build
pnpm --filter @enslo/sd-metadata-lite test

# Lint (entire workspace)
pnpm lint
pnpm lint:fix
```

You can also run commands directly inside a package directory:

```bash
cd packages/core
pnpm test:watch
pnpm test:coverage
```

## Questions?

If you have questions about contributing, feel free to:

- [Open an issue](https://github.com/enslo/sd-metadata/issues/new)
- Check existing issues and discussions

Thank you for helping make sd-metadata better! 🎉
