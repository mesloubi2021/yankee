require('tap-spec-integrated');
const test = require('tape-catch');
const u = require('untab');
const mockFs = require('mock-fs');
const fs = require('fs');
const proxyquire = require('proxyquire');
const includes = require('array-includes');

const yankee = require('.');

const date = new Date('2016-05-20');
const path = '/my/project';

test('Detects the initial release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      note: Initial release
  ` });

  const result = yankee({ path, date });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.0.0:
      date: 2016-05-20
      note: Initial release
  `);

  is.deepEqual(
    result,
    { previousVersion: undefined, newVersion: '1.0.0', bump: 'initial' },
    'reports correct bump data'
  );
  is.end();
});

test('Detects a breaking release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      breaking changes: Whatever

    1.2.3:
      date: 2016-05-19
      note: Whatever
  ` });

  const result = yankee({ path, date });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    2.0.0:
      date: 2016-05-20
      breaking changes: Whatever

    1.2.3:
      date: 2016-05-19
      note: Whatever
  `);

  is.deepEqual(
    result,
    { previousVersion: '1.2.3', newVersion: '2.0.0', bump: 'breaking' },
    'reports correct bump data'
  );
  is.end();
});

test('Detects a feature release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      new features: Whatever

    1.2.3:
      date: 2016-05-19
      note: Whatever
  ` });

  const result = yankee({ path, date });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.3.0:
      date: 2016-05-20
      new features: Whatever

    1.2.3:
      date: 2016-05-19
      note: Whatever
  `);

  is.deepEqual(
    result,
    { previousVersion: '1.2.3', newVersion: '1.3.0', bump: 'feature' },
    'reports correct bump data'
  );
  is.end();
});

test('Detects a bugfix release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      fixed bugs: Whatever

    1.2.3:
      date: 2016-05-19
      note: Whatever
  ` });

  const result = yankee({ path, date });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.2.4:
      date: 2016-05-20
      fixed bugs: Whatever

    1.2.3:
      date: 2016-05-19
      note: Whatever
  `);

  is.deepEqual(
    result,
    { previousVersion: '1.2.3', newVersion: '1.2.4', bump: 'bugfix' },
    'reports correct bump data'
  );
  is.end();
});

test('Fails when the `Changelog.yaml` is not an object', (is) => {
  is.plan(1);

  mockFs({ '/my/project/Changelog.yaml': 'Just a string' });

  try {
    yankee({ path, date });
  } catch (error) {
    is.ok(/a yaml object/i.test(error),
      'fails with a helpful message'
    );
  }

  is.end();
});

test('Fails when the `Changelog.yaml` doesn’t contain `master:`', (is) => {
  is.plan(1);

  mockFs({ '/my/project/Changelog.yaml': u`
    any old: object
  ` });

  try {
    yankee({ path, date });
  } catch (error) {
    is.ok(/a top-level `master:` property/i.test(error),
      'fails with a helpful message'
    );
  }

  is.end();
});

const testInitialRelease = (title, callback) => {
  test(title, (is) => {
    const mockFsProxy = (options) => mockFs(
      Object.assign(
        { '/my/project/Changelog.yaml': u`
          master:
            note: Initial release
        ` },
        options
      )
    );

    const yankeeProxy = (options) => yankee(
      Object.assign(
        { path, date },
        options
      )
    );

    callback(mockFsProxy, yankeeProxy, is);
  });
};

testInitialRelease('`npm` works', (mockFsProxy, yankeeProxy, is) => {
  mockFsProxy({
    '/my/project/package.json': '{ "version": "0.0.0" }',
    '/my/project/npm-shrinkwrap.json': '{}',
  });

  yankeeProxy({ npm: true });

  is.equal(
    fs.readFileSync('/my/project/package.json', 'utf8'),
    u`
      {
        "version": "1.0.0"
      }
    `,
    'updates the `version` in the `package.json`'
  );

  is.equal(
    fs.readFileSync('/my/project/npm-shrinkwrap.json', 'utf8'),
    u`
      {
        "version": "1.0.0"
      }
    `,
    'adds a `version` to the `npm-shrinkwrap.json`'
  );

  is.end();
});

testInitialRelease((
  'File update fails silently if file doesn’t exist'
), (mockFsProxy, yankeeProxy, is) => {
  mockFsProxy({});

  try {
    yankeeProxy({ npm: true });
  } catch (_) {
    is.fail('no error is thrown');
  }

  is.end();
});

testInitialRelease((
  'File update fails gracefully if file is not valid JSON'
), (mockFsProxy, yankeeProxy, is) => {
  is.plan(1);

  mockFsProxy({
    '/my/project/package.json': 'invalid JSON',
  });

  try {
    yankeeProxy({ npm: true });
  } catch (error) {
    is.ok(/valid json/i.test(error),
      'with a helpful message'
    );
  }

  is.end();
});

testInitialRelease((
  'File update fails gracefully if file is not a JSON object'
), (mockFsProxy, yankeeProxy, is) => {
  is.plan(1);

  mockFsProxy({
    '/my/project/package.json': 'null',
  });

  try {
    yankeeProxy({ npm: true });
  } catch (error) {
    is.ok(/a json object/i.test(error),
      'with a helpful message'
    );
  }

  is.end();
});

testInitialRelease('`commit` works', (mockFsProxy, _, is) => {
  is.plan(4);

  mockFs.restore();  // Needed for proxyquire to work

  const yankeeStub = proxyquire('.', {
    child_process: {
      spawnSync: (command, args, options) => {
        is.deepEqual(
          [command, args[0], options.cwd],
          ['git', 'commit', path],
          'calls `git commit`'
        );

        is.equal(
          args[1],
          '--message=1.0.0',
          'commit message equals raw version number'
        );

        is.equal(
          args[2],
          'Changelog.yaml',
          'ignores staged files and commits `Changelog.yaml`'
        );

        is.ok(
          ([
            'package.json', 'npm-shrinkwrap.json',
          ].every(file => includes(args, file))),
          'plays well with `npm`'
        );
      },
    },
  });

  mockFsProxy({});

  yankeeStub({ npm: true, commit: true, path });

  is.end();
});
