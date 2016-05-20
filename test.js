require('tap-spec-integrated');
const test = require('tape-catch');
const u = require('untab');
const mockFs = require('mock-fs');
const fs = require('fs');

const yankee = require('.');

test('Detects the initial release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      note: Initial release
  ` });

  const result = yankee({ path: '/my/project', date: new Date('2016-05-14') });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.0.0:
      date: 2016-05-14
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
      note: Whatever
  ` });

  const result = yankee({ path: '/my/project', date: new Date('2016-05-14') });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    2.0.0:
      date: 2016-05-14
      breaking changes: Whatever

    1.2.3:
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
      note: Whatever
  ` });

  const result = yankee({ path: '/my/project', date: new Date('2016-05-14') });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.3.0:
      date: 2016-05-14
      new features: Whatever

    1.2.3:
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
      note: Whatever
  ` });

  const result = yankee({ path: '/my/project', date: new Date('2016-05-14') });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.2.4:
      date: 2016-05-14
      fixed bugs: Whatever

    1.2.3:
      note: Whatever
  `);

  is.deepEqual(
    result,
    { previousVersion: '1.2.3', newVersion: '1.2.4', bump: 'bugfix' },
    'reports correct bump data'
  );
  is.end();
});

testInitialRelease = (title, callback) => {
  test(title, (is) => {
    mockFs({ '/my/project/Changelog.yaml': u`
      master:
        note: Initial release
    ` });

    const yankeeProxy = (options) => yankee(
      Object.assign(
        { path: '/my/project', date: new Date('2016-05-14') },
        options
      )
    );

    callback(yankeeProxy, is);
  });
};
