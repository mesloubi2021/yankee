require('./test/formatter');

const test = require('tape-catch');
const u = require('untab');
const mockFs = require('mock-fs');
const fs = require('fs');
const qs = require('q-stream');

const yankee = require('.');

test('Detects the initial release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      note: Initial release
  ` });

  const stream = qs((chunk) => {
    is.equal(chunk, 'Detected version 1.0.0\n');
    is.end();
  });

  yankee({ path: '/my/project', date: new Date('2016-05-14'), stream });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.0.0:
      date: 2016-05-14
      note: Initial release
  `);
});

test('Detects a breaking release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      breaking changes: Whatever

    1.2.3:
      note: Whatever
  ` });

  const stream = qs((chunk) => {
    is.equal(chunk, 'Detected version 2.0.0\n');
    is.end();
  });

  yankee({ path: '/my/project', date: new Date('2016-05-14'), stream });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    2.0.0:
      date: 2016-05-14
      breaking changes: Whatever

    1.2.3:
      note: Whatever
  `);
});

test('Detects a feature release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      new features: Whatever

    1.2.3:
      note: Whatever
  ` });

  const stream = qs((chunk) => {
    is.equal(chunk, 'Detected version 1.3.0\n');
    is.end();
  });

  yankee({ path: '/my/project', date: new Date('2016-05-14'), stream });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.3.0:
      date: 2016-05-14
      new features: Whatever

    1.2.3:
      note: Whatever
  `);
});

test('Detects a bugfix release', (is) => {
  mockFs({ '/my/project/Changelog.yaml': u`
    master:
      fixed bugs: Whatever

    1.2.3:
      note: Whatever
  ` });

  const stream = qs((chunk) => {
    is.equal(chunk, 'Detected version 1.2.4\n');
    is.end();
  });

  yankee({ path: '/my/project', date: new Date('2016-05-14'), stream });

  is.equal(fs.readFileSync('/my/project/Changelog.yaml', 'utf8'), u`
    1.2.4:
      date: 2016-05-14
      fixed bugs: Whatever

    1.2.3:
      note: Whatever
  `);
});
