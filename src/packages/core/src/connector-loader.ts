import { Executor, RequestCoordinator } from "@ganache/utils";
import { ConstructorReturn, Flavor } from "@ganache/flavor";
import { FlavorOptions } from "@ganache/flavor";
import { TruffleColors } from "@ganache/colors";
import chalk from "chalk";
import EthereumFlavor from "@ganache/ethereum";

const NEED_HELP = "Need help? Reach out to the Truffle community at";
const COMMUNITY_LINK = "https://trfl.io/support";

function getConnector<F extends Flavor>(
  flavor: F["flavor"],
  providerOptions: ConstructorParameters<F["Connector"]>[0],
  executor: Executor
): ConstructorReturn<F["Connector"]> {
  if (flavor === EthereumFlavor.flavor) {
    return new EthereumFlavor.Connector(
      providerOptions,
      executor
    ) as ConstructorReturn<F["Connector"]>;
  }
  try {
    if (flavor === "filecoin") {
      flavor = "@ganache/filecoin";
    }
    const { default: f } = eval("require")(flavor);
    // TODO: remove the `typeof f.default != "undefined" ? ` check once the
    // published filecoin plugin is updated
    const Connector = (
      typeof f.default != "undefined" ? f.default.Connector : f.Connector
    ) as F["Connector"];
    return new Connector(providerOptions, executor) as ConstructorReturn<
      F["Connector"]
    >;
  } catch (e: any) {
    if (e.message.includes(`Cannot find module '${flavor}'`)) {
      // we print and exit rather than throw to prevent webpack output from being
      // spat out for the line number
      console.warn(
        chalk`\n\n{red.bold ERROR:} Could not find Ganache flavor "{bold ${flavor}}"; ` +
          `it probably\nneeds to be installed.\n` +
          ` ▸ if you're using Ganache as a library run: \n` +
          chalk`   {blue.bold $ npm install ${flavor}}\n` +
          ` ▸ if you're using Ganache as a CLI run: \n` +
          chalk`   {blue.bold $ npm install --global ${flavor}}\n\n` +
          chalk`{hex("${TruffleColors.porsche}").bold ${NEED_HELP}}\n` +
          chalk`{hex("${TruffleColors.turquoise}") ${COMMUNITY_LINK}}\n\n`
      );
      process.exit(1);
    } else {
      throw e;
    }
  }
}

/**
 * Loads the connector specified by the given `options.flavor` with the given
 * options, or the `ethereum` flavor is `options.flavor` is not specified.
 * @param options
 * @returns
 */
export const loadConnector = <F extends Flavor = EthereumFlavor>(
  options: FlavorOptions<F> = {
    flavor: EthereumFlavor.flavor,
    chain: { asyncRequestProcessing: true }
  } as FlavorOptions<F>
) => {
  const flavor = (options.flavor || EthereumFlavor.flavor) as F["flavor"];

  // Set up our request coordinator to either use FIFO or or async request
  // processing. The RequestCoordinator _can_ be used to coordinate the number
  // of requests being processed, but we don't use it for that (yet), instead
  // of "all" (0) or just 1 as we are doing here:
  let asyncRequestProcessing: boolean;

  if (
    "chain" in options &&
    "asyncRequestProcessing" in (options.chain as any)
  ) {
    asyncRequestProcessing = options.chain["asyncRequestProcessing"];
  } else if ("asyncRequestProcessing" in options) {
    asyncRequestProcessing = options["asyncRequestProcessing"] as boolean;
  } else {
    asyncRequestProcessing = true;
  }
  const requestCoordinator = new RequestCoordinator(
    asyncRequestProcessing ? 0 : 1
  );

  // The Executor is responsible for actually executing the method on the
  // chain/API. It performs some safety checks to ensure "safe" method
  //  execution before passing it to a RequestCoordinator.
  const executor = new Executor(requestCoordinator);

  const connector = getConnector(flavor, options, executor);

  // Purposely not awaiting on this to prevent a breaking change
  // to the `Ganache.provider()` method
  // TODO: remove the `connector.connect ? ` check and just use
  // `connector.connect()` after publishing the `@ganache/filecoin` with the
  // connector.connect interface
  const connectPromise = connector.connect
    ? connector.connect()
    : ((connector as any).initialize() as Promise<void>);

  // The request coordinator is initialized in a "paused" state; when the
  // provider is ready we unpause.. This lets us accept queue requests before
  // we've even fully initialized.

  // The function referenced by requestcoordinator.resume will be changed when
  // requestCoordinator.stop() is called. Ensure that no references to the
  // function are held, otherwise internal errors may be surfaced.
  return {
    connector,
    promise: connectPromise.then(() => requestCoordinator.resume())
  };
};
