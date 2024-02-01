import { ethers } from 'ethers';
import {
  Finding,
  HandleTransaction,
  TransactionEvent,
  FindingSeverity,
  FindingType,
} from 'forta-agent';
import Web3 from 'web3';

const SWAP_EVENT_ABI = "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)";
const ARBITRAGE_THRESHOLD = 0.01; // 1% price discrepancy for example

const RPC_ENDPOINT = 'YOUR_RPC_ENDPOINT';
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_ENDPOINT));

const FLASH_BOT_CONTRACT_ADDRESS = 'YOUR_FLASH_BOT_CONTRACT_ADDRESS';
const flashBotContractABI = /* ABI of your FlashBot contract */;
const flashBotContract = new web3.eth.Contract(flashBotContractABI, FLASH_BOT_CONTRACT_ADDRESS);

const PRIVATE_KEY = 'YOUR_PRIVATE_KEY'; // Must be securely managed
const WALLET_ADDRESS = 'YOUR_WALLET_ADDRESS';

// Cache for storing price data
const swapEventCache = new Map();

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  const swapEvents = txEvent.filterLog(SWAP_EVENT_ABI);
  swapEvents.forEach(async (swapEvent) => {
    const swapEventData = ethers.utils.defaultAbiCoder.decode(
      ['address', 'uint', 'uint', 'uint', 'uint', 'address'],
      swapEvent.data
    );

    const price = swapEventData.amount1Out / swapEventData.amount0In;
    const tokenPairKey = `${swapEvent.address}-${swapEvent.topics[1]}-${swapEvent.topics[2]}`;

    const cachedPriceData = swapEventCache.get(tokenPairKey);
    if (cachedPriceData) {
      const priceDifference = Math.abs(cachedPriceData.price - price);
      const priceDiscrepancy = priceDifference / cachedPriceData.price;

      if (priceDiscrepancy >= ARBITRAGE_THRESHOLD) {
        findings.push(Finding.fromObject({
          name: "Arbitrage Opportunity Detected",
          description: `A significant price discrepancy of ${priceDiscrepancy * 100}% detected for token pair ${tokenPairKey}`,
          alertId: "ARBITRAGE-1",
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          metadata: {
            tokenPair: tokenPairKey,
            priceDifference: priceDifference.toString(),
            newPrice: price.toString(),
            cachedPrice: cachedPriceData.price.toString(),
            timestamp: cachedPriceData.timestamp.toString(),
          },
        }));

        // Execute transaction on FlashBot contract
        try {
          const txData = flashBotContract.methods.YOUR_FLASHBOT_METHOD(/* parameters */).encodeABI();
          const tx = {
            from: WALLET_ADDRESS,
            to: FLASH_BOT_CONTRACT_ADDRESS,
            data: txData,
            // Other necessary transaction fields like gas, gasPrice, etc.
          };

          const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
          const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
          console.log('FlashBot transaction receipt:', receipt);
        } catch (error) {
          console.error('Error executing FlashBot transaction:', error);
        }
      }
    }

    swapEventCache.set(tokenPairKey, {
      price,
      timestamp: txEvent.timestamp
    });
  });

  return findings;
};

// Cache cleanup logic (optional)
setInterval(() => {
  const now = Date.now();
  const threshold = 5 * 60 * 1000; // 5 minutes in milliseconds
  swapEventCache.forEach((value, key) => {
    if (now - value.timestamp > threshold) {
      swapEventCache.delete(key);
    }
  });
}, 60 * 1000); // Cleanup every minute

export default {
  handleTransaction,
};

