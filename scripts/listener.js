const { ethers } = require('ethers');
const express = require('express');
const app = express();
app.use(express.json());

const provider = new ethers.providers.JsonRpcProvider('RPC_ENDPOINT');
const wallet = new ethers.Wallet('PRIVATE_KEY', provider);

const flashBotContractAddress = 'DEPLOYED_CONTRACT_ADDRESS';
const flashBotAbi = [
  // ... ABI of your deployed FlashBot contract
];
const flashBotContract = new ethers.Contract(flashBotContractAddress, flashBotAbi, wallet);

app.post('/alert', async (req, res) => {
  try {
    const alertData = req.body;
    // Validate the alert data contains the necessary information
    if (alertData && alertData.pool0 && alertData.pool1) {
      console.log('Received alert for arbitrage opportunity:', alertData);
      // The off-chain service calls the smart contract's flashArbitrage function
      const tx = await flashBotContract.flashArbitrage(alertData.pool0, alertData.pool1, {
        gasLimit: '500000', // Set appropriate gas limit
      });
      console.log('Arbitrage transaction sent:', tx.hash);

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        console.log('Arbitrage transaction confirmed:', tx.hash);
        res.status(200).send('Arbitrage executed successfully');
      } else {
        console.error('Arbitrage transaction failed:', tx.hash);
        res.status(500).send('Arbitrage transaction failed');
      }
    } else {
      console.error('Invalid alert data received', alertData);
      res.status(400).send('Invalid alert data');
    }
  } catch (error) {
    console.error('Error handling alert:', error);
    res.status(500).send('Error executing arbitrage');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
