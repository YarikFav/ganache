import assert from "assert";
import { EthereumOptionsConfig } from "../src";
import sinon from "sinon";
import { resolve } from "path";
import { promises } from "fs";
const { unlink, readFile, open } = promises;
import { closeSync } from "fs";
import { URL } from "url";

describe("EthereumOptionsConfig", () => {
  describe("logging", () => {
    const validFilePath = resolve("./tests/test-file.log");

    describe("options", () => {
      let spy: any;
      beforeEach(() => {
        spy = sinon.spy(console, "log");
      });

      afterEach(() => {
        spy.restore();
      });

      describe("logger", () => {
        it("uses console.log by default", () => {
          const message = "message";
          const options = EthereumOptionsConfig.normalize({});
          options.logging.logger.log(message);
          assert.strictEqual(spy.withArgs(message).callCount, 1);
        });

        it("disables the logger when the quiet flag is used", () => {
          const message = "message";
          const options = EthereumOptionsConfig.normalize({
            logging: { quiet: true }
          });
          options.logging.logger.log(message);
          assert.strictEqual(spy.withArgs(message).callCount, 0);
        });

        it("calls the provided logger when quiet flag is used", () => {
          const logLines: string[][] = [];
          const options = EthereumOptionsConfig.normalize({
            logging: {
              quiet: true,
              logger: {
                log: (message: any, ...params: any[]) =>
                  logLines.push([message, ...params])
              }
            }
          });

          options.logging.logger.log("message", "param1", "param2");

          assert.deepStrictEqual(logLines, [["message", "param1", "param2"]]);
        });
      });

      describe("file", () => {
        it("resolves a file path to descriptor", async () => {
          const options = EthereumOptionsConfig.normalize({
            logging: { file: validFilePath }
          });
          try {
            assert(typeof options.logging.file === "number");
            assert.doesNotThrow(() => closeSync(options.logging.file));
          } finally {
            await unlink(validFilePath);
          }
        });

        it("resolves a file path as Buffer to descriptor", async () => {
          const options = EthereumOptionsConfig.normalize({
            logging: { file: Buffer.from(validFilePath, "utf8") }
          });
          try {
            assert(typeof options.logging.file === "number");
            assert.doesNotThrow(() => closeSync(options.logging.file));
          } finally {
            await unlink(validFilePath);
          }
        });

        it("resolves a file URL as Buffer to descriptor", async () => {
          const options = EthereumOptionsConfig.normalize({
            logging: { file: new URL(`file://${validFilePath}`) }
          });
          try {
            assert(typeof options.logging.file === "number");
            assert.doesNotThrow(() => closeSync(options.logging.file));
          } finally {
            await unlink(validFilePath);
          }
        });

        it("fails if an invalid file path is provided", async () => {
          const file = resolve("./eperm-file.log");
          try {
            const handle = await open(file, "w");
            // set no permissions on the file
            await handle.chmod(0);
            await handle.close();

            const error = { message: `Failed to open log file ${file}. Please check if the file path is valid and if the process has write permissions to the directory.` };

            assert.throws(
              () =>
                EthereumOptionsConfig.normalize({
                  logging: { file }
                })
              , error
            );

          } finally {
            await unlink(file);
          }
        });

        it("uses the provided logger, and file when both `logger` and `file` are provided", async () => {
          const calls: any[] = [];
          const logger = {
            log: (message: any, ...params: any[]) => {
              calls.push([message, ...params]);
            }
          };

          try {
            const options = EthereumOptionsConfig.normalize({
              logging: {
                logger,
                file: validFilePath
              }
            });

            options.logging.logger.log("message", "param1", "param2");
            assert.deepStrictEqual(calls, [["message", "param1", "param2"]]);

            const fromFile = await readFile(validFilePath, "utf8");
            assert(fromFile !== "", "Nothing written to the log file");

            const timestampPart = fromFile.substring(0, 24);

            const timestampRegex =
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
            assert(
              timestampPart.match(timestampRegex),
              `Unexpected timestamp from file ${timestampPart}`
            );

            const messagePart = fromFile.substring(25);

            assert.strictEqual(messagePart, "message param1 param2\n");
          } finally {
            await unlink(validFilePath);
          }
        });
      });
    });
  });
});
