# yankee
**Easy release management with YAML changelogs**

## Installation

```sh
# As a global command:
npm install --global yankee

# …or locally for an npm project:
npm install --save-dev yankee
```

## Usage

```sh
yankee [<path>]
yankee --help
```

## Description

The file `Changelog.yaml` is the single source of information about your releases. It should be an object with one key per release and an optional `unreleased:` key at the top. Here’s an example:

```yaml
unreleased:
  new features:
    - The cool new flag `--verbose`.

2.0.1:
  date: 1992-02-09
  fixed bugs:
    - Got rid of a nasty IO bug.
    - Improved the docs.

2.0.0:
  date: 1982-03-15
  breaking changes:
    - API redesign. See the readme for details.

1.0.0:
  date: 1970-01-01
  note: Initial release.
```

When you call `yankee`, we’ll determine what version number comes next and update the file accordingly. We’ll replace `unreleased:` with the new version and add a `date:` property with the current day right below that.

If the `unreleased:` object contains the key `breaking changes:`, we’ll make it a major release (X.y.z). If it contains the key `new features:`, we’ll make a minor bump (x.Y.z). Otherwise, make sure your `unreleased:` changelog has the key `fixed bugs:` - we’ll release it as a patch (x.y.Z).

The version number against which we’ll be bumping is the first key in your `Changelog.yaml` except `unreleased:`. If there’s no other key, we’ll always tag the release as 1.0.0.

If you call `yankee` without any options, we’ll only output the version number, so that it’s easy for you to process with scripts.

## Options

<!-- @options start -->
#### `[path]`
The path to your project directory. Should contain a `Changelog.yaml`. Default: `$(pwd)`.

#### `-n, --npm`
Attempt to update the `version` field in `package.json` and `npm-shrinkwrap.json`.

#### `-c, --commit`
Commit changes. The commit message will be the raw version number.

#### `-t, --tag`
Tag the commit with an annotated tag. The tag name will be the raw version number preceeded with a “v”. Implies `--commit`.

#### `-h, --help`
You’re looking at it.
<!-- @options end -->

## Example

Here a simple example using `cat` and [here docs](https://en.wikipedia.org/wiki/Here_document#Unix_shells). When creating your package, you start off with a simple changelog:

```yaml
$ cat << --- > Changelog.yaml
  unreleased:
    note: Initial release.
  ---
```

When you’re ready for a 1.0.0 release, just call `yankee`:

```yaml
$ yankee
  1.0.0

$ cat Changelog.yaml
  1.0.0:
    date: 2016-05-20
    note: Initial release.
```

Working on new stuff, update the changelog accordingly:

```yaml
$ cat << --- > Changelog.yaml
  unreleased:
    new features:
      - Cool new stuff!

  $(cat Changelog.yaml)
  ---
```

When ready for a release, `yankee` will figure out what the release number should be:

```yaml
$ yankee
  1.1.0

$ cat Changelog.yaml
  1.1.0:
    date: 2016-05-20
    new features:
      - Cool new stuff!

  1.0.0:
    date: 2016-05-20
    note: Initial release.
```
