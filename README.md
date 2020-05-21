# Create HTML5 Boilerplate

[![Coverage Status](https://coveralls.io/repos/github/h5bp/create-html5-boilerplate/badge.svg?branch=master)](https://coveralls.io/github/h5bp/create-html5-boilerplate?branch=master)

Quick start for HTML5 Boilerplate. Get up and running with one command.

## Getting Started

You can get started using one of three options- `npx`, `npm init`, or
`yarn create`

Using `npx`

```sh
npx create-html5-boilperlate new-site
cd new-site
npm install
npm start
```

Using `npm init`

```sh
npm init create-html5-boilperlate new-site
cd new-site
npm install
npm start
```

Using yarn

```sh
yarn create html5-boilperlate new-site
cd new-site
npm install
npm start
```

These commands are equivalent and do the following:

1. Dowloads and installs the latest version of HTML5-Boilerplate
2. Bundles site assets and tart a web server using [`parcel`](https://parceljs.org/)
3. Opens a web browser pointed to http://localhost:1234/

## Requirements

`create-html5-boilerplate` is cross-platform. It works whereever node and npm work.
The only requirements are for `npx`, which requires npm version 5.2 or greater and
`npm init` which requires an npm version greater than 6.0. If you're stuck on an
older version of npm you can still use `create-html5-boilerplate` by running the 
following command to install the project globally.

```sh
npm install -g create-html5-boilperlate
```

Then you can use create-html5-boilerplate as in the following example

```sh
create-html5-boilperlate new-site
cd new-site
npm install
npm start
```

## Installing Specific Versions

You can also install a specific version:

```sh
npx create-html5-boilerplate new-site --release=7.2.0
cd new-site
npm install
npm start
```
