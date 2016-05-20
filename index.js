const fs = require('fs');
const yaml = require('js-yaml');
const tinyError = require('tiny-error');
const isObject = require('isobject');
const omit = require('object.omit');
const includes = require('array-includes');
const dateFormat = require('date-format');

// (String) => Error
const error = (message) => (
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
  }) =>
    Void
 */
module.exports = (paramsArg) => {
  const params = paramsArg || {};
  const path = params.path || process.cwd();
  const date = params.date || new Date();

  const changelogPath = `${path}/Changelog.yaml`;
  const changelog = yaml.safeLoad(fs.readFileSync(changelogPath, 'utf8'));

  if (!isObject(changelog)) {
    throw error('Make sure `Changelog.yaml` is a YAML object.');
  }

  if (!changelog.hasOwnProperty('master')) {
    throw error(
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

  return {
    bump,
    previousVersion,
    newVersion,
  };
};
