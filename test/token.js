const Token = artifacts.require('Token.sol');
const truffleAssert = require('truffle-assertions');

contract('Token', accounts=> {
  let token;
  const [admin, holder] = accounts;
  const TOTAL_SUPPLY = web3.utils.toWei('100000000');

  before(async () => {
    token = await Token.new();
  });

  describe('balances tests', function () {
    it('should have total supply of 100,000,000', async () => {
      const totalSupply = await token.totalSupply();
      assert(totalSupply.toString() === TOTAL_SUPPLY);
    });

    it('admin should have total supply', async () => {
      const balanceAdmin = await token.balanceOf(admin);
      assert(balanceAdmin.toString() === TOTAL_SUPPLY);
    });
  });

  describe('pausing tests', function () {
    beforeEach(async function () {
      const paused = await token.paused();

      if (paused) {
        await token.unpause({ from: admin });
      }
    });

    it('admin can pause', async function () {
      const { logs } = await token.pause({ from: admin });

      assert.equal(logs.length, 1);
      assert.equal(logs[0].event, 'Paused');

      assert.equal(await token.paused(), true);
    });

    it('admin can unpause', async function () {
      await token.pause({ from: admin });
      const { logs } = await token.unpause({ from: admin });

      assert.equal(logs.length, 1);
      assert.equal(logs[0].event, 'Unpaused');

      assert.equal(await token.paused(), false);
    });

    it('only admin can pause', async function () {
      await truffleAssert.reverts(token.pause({ from: holder }));
    });

    it('only admin can unpause', async function () {
      await token.pause({ from: admin });
      assert.equal(await token.paused(), true);

      await truffleAssert.reverts(token.unpause({ from: holder }));
    });

    it('transfers happen when not paused', async function () {
      const amountToTransfer = 1000;
      const initialHolderBalance = (await token.balanceOf(holder)).toNumber();
      await token.transfer(holder, amountToTransfer, {from: admin});

      const expectedTotalHolderBalance = initialHolderBalance + amountToTransfer;
      const currentBalance = (await token.balanceOf(holder)).toNumber();

      assert(currentBalance === expectedTotalHolderBalance, true);
    });

    it('no transfers when paused', async function () {
      await token.pause({ from: admin });
      await truffleAssert.reverts(token.transfer(holder, 100, {from: admin}));
    });

    it('transfers work after pausing and unpausing', async function () {
      await token.pause({ from: admin });
      await token.unpause({ from: admin });

      const amountToTransfer = 1000;
      const initialHolderBalance = (await token.balanceOf(holder)).toNumber();

      await token.transfer(holder, amountToTransfer, {from: admin});

      const expectedTotalHolderBalance = initialHolderBalance + amountToTransfer;
      const currentBalance = (await token.balanceOf(holder)).toNumber();

      assert(currentBalance === expectedTotalHolderBalance, true);
    });
  });

  describe('burn tests', function () {
    it('holders can burn', async function () {
      const amountToTransfer = 1000;
      const amountToBurn = 500;
      const initialHolderBalance = (await token.balanceOf(holder)).toNumber();
      await token.transfer(holder, amountToTransfer, {from: admin});
      await token.burn(amountToBurn, {from: holder});

      const expectedTotalHolderBalance = initialHolderBalance + amountToTransfer - amountToBurn;
      const currentBalance = (await token.balanceOf(holder)).toNumber();

      assert(currentBalance === expectedTotalHolderBalance, true);
    });
    
  });
});