# Create HTML5 Boilerplate

[![Coverage Status](https://coveralls.io/repos/github/h5bp/create-html5-boilerplate/badge.svg?branch=master)](https://coveralls.io/github/h5bp/create-html5-boilerplate?branch=master)

Quick start for HTML5 Boilerplate. Get up and running with one command.

## Getting Started

You can get started using one of three options- `npx`, `npm init`, or
`yarn create`

Using `npx`

```
npx create-html5-boilerplate new-site
cd new-site
npm install
npm start
```

Using `npm init`

```
npm init html5-boilerplate new-site
cd new-site
npm install
npm start
```

Using yarn

```
yarn create html5-boilerplate new-site
cd new-site
yarn install
yarn start
```

These commands are equivalent and do the following:

1. Download and install the latest version of HTML5 Boilerplate
2. Installs dependencies
3. Bundles site assets and start a web server using [Parcel](https://parceljs.org/)
4. Opens a web browser pointed to http://localhost:1234/

## Requirements

`create-html5-boilerplate` is cross-platform. It works wherever node and npm work.
The only requirements are for `npx`, which requires npm version 5.2 or greater and
`npm init` which requires an npm version greater than 6.0. If you're stuck on an
older version of npm you can still use `create-html5-boilerplate` by running the
following command to install the project globally.

```
npm install -g create-html5-boilerplate
```

Then you can use `create-html5-boilerplate` as in the following example

```
create-html5-boilerplate new-site
cd new-site
npm install
npm start
```

## Installing Specific Versions

You can also install a specific version:

```
npx create-html5-boilerplate new-site --release=7.2.0
cd new-site
npm install
npm start
```

## CONTRIBUTING

### Setting Up a Local Copy

1. Clone the repo with `git clone https://github.com/h5bp/create-html5-boilerplate.git`
2. Run `npm install` in the root `create-html5-boilerplate` folder.
3. Run `npm link` to make npm run local copy instead of downloading from registry
4. Now you can use `npm init html5-boilerplate` and `npx create-html5-boilerplate`

note: you can use `npx create-html5-boilerplate ./out/example` from `create-html5-boilerplate` without running `npm link`
also its possible to run directly NodeJS entry point `node index.js ./out/example` or `npm start`
`./out` is git ignored folder, so you should use this folder for tests.

If you want to try out the end-to-end flow with the global CLI, you can do this too:

```
npx create-html5-boilerplate ./out/new-site
cd new-site
npm install
npm start
```

### Tests

Tests are written using [jest](https://jestjs.io/) and located in `tests/test.js`
run `npm test`

run coverage reports `npm run coverage`
