const fs = require('fs');
const yaml = require('js-yaml');
const tinyError = require('tiny-error');
const isObject = require('isobject');
const omit = require('object.omit');
const includes = require('array-includes');
const dateFormat = require('date-format');
const { spawnSync } = require('child_process');

// (Object, String) => Boolean
const has = (obj, key) => Object.hasOwnProperty.call(obj, key);

// (String) => Error
const prettyError = (message) => (
  tinyError(`Oops! Things went wrong. ${message}`)
);

// (
//    previousVersion: String,
//    bump: 'initial' | 'breaking' | 'feature' | 'bugfix'
// ) => String
const nextVersion = (previousVersion, bump) => {
  if (bump === 'initial') {
    return '1.0.0';
  }

  const versionNumbers = previousVersion.split('.').map(Number);
  return (
    (bump === 'breaking'
      && `${versionNumbers[0] + 1}.0.0`
    )
    || (bump === 'feature'
      && `${versionNumbers[0]}.${versionNumbers[1] + 1}.0`
    )
    || `${versionNumbers[0]}.${versionNumbers[1]}.${versionNumbers[2] + 1}`
  );
};

// (String) => String || null
const changelogFileName = (path) => fs.readdirSync(path)
  .find((file) => /changelog.y[a]?ml/.test(file.toLowerCase()));

/*                                                            (see git.io/rtype)
  ({
    path = process.cwd(): String,
      // Path to your project directory

    date = new Date(): Date,
      // Date of the release (will appear in the changelog)

    stream = process.stdout: WritableStream,
      // Stream to write messages to

    npm = false: Boolean,
      // If `true`, we’ll update the `version` in the `package.json`,
      // `package-lock.json` and `npm-shrinkwrap.json` (whichever are present)

    commit = false: Boolean,
      // If `true`, we’ll commit the results with git

    tag = false: Boolean,
      // If `true`, we’ll tag the results with git. Implies `commit`

  }) => {
    bump: 'breaking' | 'feature' | 'bugfix' | 'initial',
    previousVersion: String,
    newVersion: String,
  }
 */
module.exports = (paramsArg) => {
  const params = paramsArg || {};
  const path = params.path || process.cwd();
  const date = params.date || new Date();
  const npm = params.npm || false;
  const commit = params.commit || params.tag || false;
  const tag = params.tag || false;

  const changelogFile = changelogFileName(path);
  const changelogPath = `${path}/${changelogFile}`;
  const changelog = yaml.load(fs.readFileSync(changelogPath, 'utf8'));

  if (!isObject(changelog)) {
    throw prettyError('Make sure `Changelog.yaml` is a YAML object.');
  }

  const unreleasedTitle = has(changelog, 'unreleased') ? 'unreleased'
    : (has(changelog, 'master') && 'master');

  if (!unreleasedTitle) {
    throw prettyError(
      'Make sure you have a top-level `unreleased:` property in your '
      + '`Changelog.yaml`.',
    );
  }

  const releasedChangelog = omit(changelog, unreleasedTitle);
  const unreleasedData = changelog[unreleasedTitle];
  const unreleasedDataKeys = Object.keys(unreleasedData);
  const previousVersion = Object.keys(releasedChangelog)[0];
  const bump = (
    (!previousVersion && 'initial')
    || (includes(unreleasedDataKeys, 'breaking changes') && 'breaking')
    || (includes(unreleasedDataKeys, 'new features') && 'feature')
    || 'bugfix'
  );
  const newVersion = nextVersion(previousVersion, bump);

  const newVersionData = { date: dateFormat('yyyy-MM-dd', date), ...unreleasedData };
  const newChangelog = { [newVersion]: newVersionData, ...releasedChangelog };
  const newChangelogString = yaml.dump(newChangelog)
    // Reformat dates
    .replace(/(^\s*date:\s*)'(.*)'$/mg, '$1$2')
    .replace(/(^\s*date:\s*)(\d{4}-\d{2}-\d{2})[tT][\d:.+zZ]+$/mg, '$1$2')
    // Add more air
    .replace(/(.)\n([^\s])/g, '$1\n\n$2');

  fs.writeFileSync(changelogPath, newChangelogString);

  const tryUpdatingFile = (filename) => {
    let fileContents;
    try {
      fileContents = fs.readFileSync(`${path}/${filename}`, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      /* istanbul ignore next */
      throw error;
    }

    let data;
    try {
      data = JSON.parse(fileContents);
    } catch (error) {
      if (error instanceof SyntaxError) throw prettyError(
        `Make sure \`${filename}\` is valid JSON.`,
      );
    }
    if (typeof data !== 'object' || data === null) throw prettyError(
      `Make sure \`${filename}\` is a JSON object.`,
    );

    data.version = newVersion;
    fs.writeFileSync(
      `${path}/${filename}`,
      `${JSON.stringify(data, null, '  ')}\n`,
    );

    return filename;
  };

  const jsonFilesToUpdate = (npm
    ? ['package.json', 'npm-shrinkwrap.json', 'package-lock.json']
    : []
  );
  const updatedFiles = jsonFilesToUpdate
    .map(tryUpdatingFile)
    .filter((filename) => filename !== null);

  if (commit) {
    const args = [
      'commit', `--message=${newVersion}`, changelogFile,
    ].concat(
      updatedFiles,
    );

    process.stdout.write(`\n❭ git ${args.join(' ')}\n`);
    spawnSync('git', args, { cwd: path, stdio: 'inherit' });
  }

  if (tag) {
    const args = [
      'tag', '--annotate', `--message=${newVersion}`, `v${newVersion}`,
    ];

    process.stdout.write(`\n❭ git ${args.join(' ')}\n`);
    spawnSync('git', args, { cwd: path, stdio: 'inherit' });
  }

  return {
    bump,
    previousVersion,
    newVersion,
  };
};
