/*!
 * @ganache/filecoin
 *
 * @author Tim Coulter
 * @license MIT
 */

import {
  FilecoinDefaults,
  FilecoinProviderOptions
} from "@ganache/filecoin-options";
import { Connector, FilecoinProvider } from "./src/connector";
export {
  Connector,
  FilecoinProvider as Provider,
  StorageDealStatus
} from "./src/connector";

export interface FilecoinFlavor {
  flavor: "@ganache/filecoin" | "filecoin";
  provider: FilecoinProvider;
  ProviderOptions: FilecoinProviderOptions;
  connector: Connector;
}

export const initialize = async function (
  provider: FilecoinProvider,
  serverSettings: { host: string; port: number }
) {
  const liveOptions = provider.getOptions();
  const accounts = await provider.getInitialAccounts();

  console.log("");
  console.log("Available Accounts");
  console.log("==================");

  const addresses = Object.keys(accounts);
  const attoFILinFIL = 1000000000000000000n;

  addresses.forEach(function (address, index) {
    const balance = accounts[address].balance;
    const strBalance = balance / attoFILinFIL;
    const about = balance % attoFILinFIL === 0n ? "" : "~";
    let line = `(${index}) ${address} (${about}${strBalance} FIL)`;

    if (!accounts[address].unlocked) {
      line += " 🔒";
    }

    console.log(line);
  });

  console.log("");
  console.log("Private Keys");
  console.log("==================");

  addresses.forEach(function (address, index) {
    console.log(`(${index}) ${accounts[address].secretKey}`);
  });

  console.log("");
  console.log(
    `Lotus RPC listening on ${serverSettings.host}:${serverSettings.port}`
  );
  console.log(
    `IPFS RPC listening on ${liveOptions.chain.ipfsHost}:${liveOptions.chain.ipfsPort}`
  );
};

export const defaults: typeof FilecoinDefaults & {
  server: {
    rpcEndpoint: { default: () => "/rpc/v0" };
    port: { default: () => 7777 };
  };
} = {
  server: {
    rpcEndpoint: { default: () => "/rpc/v0" },
    port: {
      default: () => 7777
    }
  },
  ...FilecoinDefaults
};
