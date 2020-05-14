const fs = require('fs-extra');
const cli = require("../cli");;
const os = require('os');
const packageName = 'html5-boilerplate';
const tempDir = os.tmpdir()+`/${packageName}-staging`;


// TODO: fetch all versions:
// const { packument } = require('pacote');
// const versions = await packument(packageName);
// cases = ['', 'latest', '-r=7.3.0', ...Object.keys(versions)];
const all_versions = ['0.0.1','5.3.0',
'6.0.0', '6.0.1',
'6.1.0', '7.0.0',
'7.0.1', '7.1.0',
'7.2.0', '7.3.0'];
const cases = ['-r=7.2.0','-r=v7.2.0','-r=v7.2', '--release=7.3.0', ...all_versions.map(v=>'-r='+v)];
describe.each(cases)(
    "Downloading %s",
    (version) => {
      beforeAll(async () => {
        jest.spyOn(process, 'exit').mockImplementationOnce(() => {
          throw new Error('process.exit() was called.'+version)
        });
        process.argv.push(`./out/${version}`);
        if(version){
          process.argv.push(version)
        }
        await cli();
        process.argv = process.argv.filter(v=>v!==version && v !== `./out/${version}`);//revert process args
      });
      afterAll(async () => {
        await fs.remove(`./out/${version}`);
      });

      if(version){
        test(`version ${version}`, async() => {
            const cssContent = await fs.readFile(`./out/${version}/css/main.css`, 'utf-8');
            let versionClear = version.replace(/(-r=|--release=|v)/gi, '');
            if(versionClear === '7.0.0'){ versionClear = '6.1.0'}
            if(versionClear === '0.0.1'){ versionClear = '5.3.0'}
            expect(cssContent.indexOf(`HTML5 Boilerplate v${versionClear}`) > -1).toBe(true);
        });
      }

      test('./out directory exists', async() => {
          const outDirExists = await fs.exists(`./out/${version}`);
          expect(outDirExists).toBe(true);
      });
      test('./out directory have files', async() => {
          const dirContents = await fs.readdir(`./out/${version}`);
          expect(dirContents.length).toBeGreaterThanOrEqual(5);
      });
      test('./out directory specific files', async() => {
          const dirContents = await fs.readdir(`./out/${version}`);
          const check = ['index.html', 'robots.txt','tile.png', 'css', 'js', 'img'].filter(v=>dirContents.indexOf(v)=== -1);
          expect(check.length === 0).toBe(true);
      });
      test('Temp dir removed', async() => {
          const tempDirExists = await fs.exists(tempDir);
          expect(tempDirExists).toBe(false);
      });
    }
  );
  // test('Attempt 1', async() => {
  //     const spy = jest.spyOn(console, 'log');

      // expect(() => {
      // }).toThrow('process.exit() was called.');
      // expect(spy.mock.calls).toEqual([['Testing...']]);
      // expect(process.exit).toHaveBeenCalledWith(0);
  // });