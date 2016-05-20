'use strict'; // eslint-disable-line strict
  // http://stackoverflow.com/q/33063206

const fs = require('fs');
const yaml = require('js-yaml');
const tinyError = require('tiny-error');
const isObject = require('isobject');
const omit = require('object.omit');
const includes = require('array-includes');
const dateFormat = require('date-format');

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
    (bump === 'breaking' &&
      `${versionNumbers[0] + 1}.0.0`
    ) ||
    (bump === 'feature' &&
      `${versionNumbers[0]}.${versionNumbers[1] + 1}.0`
    ) ||
    `${versionNumbers[0]}.${versionNumbers[1]}.${versionNumbers[2] + 1}`
  );
};

/*                                                            (see git.io/rtype)
  ({
    path = process.cwd(): String,
      // Path to your project directory

    date = new Date(): Date,
      // Date of the release (will appear in the changelog)

    stream = process.stdout: WritableStream,
      // Stream to write messages to

    npm = false: Boolean,
      // If `true`, we’ll update the `version` in the `package.json`
      // and `npm-shrinkwrap.json`
  }) =>
    Void
 */
module.exports = (paramsArg) => {
  const params = paramsArg || {};
  const path = params.path || process.cwd();
  const date = params.date || new Date();
  const npm = params.npm || false;

  const changelogPath = `${path}/Changelog.yaml`;
  const changelog = yaml.safeLoad(fs.readFileSync(changelogPath, 'utf8'));

  if (!isObject(changelog)) {
    throw prettyError('Make sure `Changelog.yaml` is a YAML object.');
  }

  if (!changelog.hasOwnProperty('master')) {
    throw prettyError(
      'Make sure you have a top-level `master:` property in your ' +
      '`Changelog.yaml`.'
    );
  }

  const changelogWithoutMaster = omit(changelog, 'master');
  const masterData = changelog.master;
  const masterDataKeys = Object.keys(masterData);
  const previousVersion = Object.keys(changelogWithoutMaster)[0];
  const bump = (
    (!previousVersion && 'initial') ||
    (includes(masterDataKeys, 'breaking changes') && 'breaking') ||
    (includes(masterDataKeys, 'new features') && 'feature') ||
    'bugfix'
  );
  const newVersion = nextVersion(previousVersion, bump);

  const newVersionData = Object.assign({
    date: dateFormat('yyyy-MM-dd', date),
  }, masterData);
  const newChangelog = Object.assign({
    [newVersion]: newVersionData,
  }, changelogWithoutMaster);
  const newChangelogString = yaml.safeDump(newChangelog)
    // Reformat dates
    .replace(/(^\s*date:\s*)'(.*)'$/mg, '$1$2')
    .replace(/(^\s*date:\s*)(\d{4}-\d{2}-\d{2})[tT][\d:\.+zZ]+$/mg, '$1$2')
    // Add more air
    .replace(/(.)\n([^\s])/g, '$1\n\n$2');

  fs.writeFileSync(changelogPath, newChangelogString);

  const tryUpdatingFile = (filename) => {
    let fileContents;
    try {
      fileContents = fs.readFileSync(`${path}/${filename}`, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    let data;
    try {
      data = JSON.parse(fileContents);
    } catch (error) {
      if (error instanceof SyntaxError) throw prettyError(
        `Make sure \`${filename}\` is valid JSON.`
      );
    }
    if (typeof data !== 'object' || data === null) throw prettyError(
      `Make sure \`${filename}\` is a JSON object.`
    );

    data.version = newVersion;
    fs.writeFileSync(
      `${path}/${filename}`,
      `${JSON.stringify(data, null, '  ')}\n`
    );
  };

  if (npm) {
    ['package.json', 'npm-shrinkwrap.json'].forEach(tryUpdatingFile);
  }

  return {
    bump,
    previousVersion,
    newVersion,
  };
};
