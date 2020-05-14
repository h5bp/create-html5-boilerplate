const fs = require('fs-extra');
const cli = require("../cli");;
const os = require('os');
const packageName = 'html5-boilerplate';
const tempDir = os.tmpdir()+`/${packageName}-staging`;

const originalArgv = process.argv;

describe('Filesystem test', () => {
  beforeAll(async () => {
    process.argv.push('./out', '-r=7.2.0');
    await cli();
  });
  afterAll(async () => {
    fs.remove('./out');
    process.argv = originalArgv;
  });
  test('./out directory exists', async() => {
      const outDirExists = await fs.exists('./out');
      expect(outDirExists).toBe(true);
  });
  test('./out directory have files', async() => {//TODO: check files exists e.g index.html, package.json
      const dirContents = await fs.readdir('./out');
      expect(dirContents.length).toBeGreaterThanOrEqual(5);
  });
  test('Temp dir removed', async() => {
      const tempDirExists = await fs.exists(tempDir);
      expect(tempDirExists).toBe(false);
  });
  // test('Attempt 1', async() => {
  //     const spy = jest.spyOn(console, 'log');
  //     jest.spyOn(process, 'exit').mockImplementationOnce(() => {
  //       throw new Error('process.exit() was called.')
  //     });

      // expect(() => {
      // }).toThrow('process.exit() was called.');
      // expect(spy.mock.calls).toEqual([['Testing...']]);
      // expect(process.exit).toHaveBeenCalledWith(0);
  // });
});