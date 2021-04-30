const { expect } = require('chai')
const toWei = ethers.utils.parseEther

describe('Token contract', function () {
  let token, admin, holder
  const TOTAL_SUPPLY = toWei('100000000')

  before(async () => {
    [admin, holder] = await ethers.getSigners()

    const Token = await ethers.getContractFactory('Token')
    token = await Token.deploy()
  })

  describe('balances tests', function () {
    it('should have total supply of 100,000,000', async () => {
      expect((await token.totalSupply()).toString()).to.equal(TOTAL_SUPPLY)
    })

    it('admin should have total supply', async () => {
      expect((await token.balanceOf(admin.address)).toString()).to.equal(TOTAL_SUPPLY)
    })
  })

  describe('pausing tests', function () {
    beforeEach(async function () {
      const paused = await token.paused()

      if (paused) {
        await token.unpause({ from: admin.address })
      }
    })

    it('admin can pause', async function () {
      await expect(token.pause({ from: admin.address }))
        .to.emit(token, 'Paused')

      expect(await token.paused()).to.equal(true)
    })

    it('admin can unpause', async function () {
      await token.pause({ from: admin.address })
      await expect(token.unpause({ from: admin.address }))
        .to.emit(token, 'Unpaused')

      await expect(await token.paused()).to.equal(false)
    })

    it('only admin can pause', async function () {
      await expect(token.pause({ from: holder })).to.be.reverted
    })

    it('only admin can unpause', async function () {
      await token.pause({ from: admin.address })
      await expect(await token.paused()).to.equal(true)

      await expect(token.unpause({ from: holder })).to.be.reverted
    })

    it('transfers happen when not paused', async function () {
      const amountToTransfer = 1000
      const initialHolderBalance = (await token.balanceOf(holder.address)).toNumber()
      await token.transfer(holder.address, amountToTransfer, { from: admin.address })

      const expectedTotalHolderBalance = initialHolderBalance + amountToTransfer
      const currentBalance = (await token.balanceOf(holder.address)).toNumber()

      expect(currentBalance).to.be.equal(expectedTotalHolderBalance)
    })

    it('no transfers when paused', async function () {
      await token.pause({ from: admin.address })
      await expect(token.transfer(holder.address, 100, { from: admin.address })).to.be.reverted
    })

    it('transfers work after pausing and unpausing', async function () {
      await token.pause({ from: admin.address })
      await token.unpause({ from: admin.address })

      const amountToTransfer = 1000
      const initialHolderBalance = (await token.balanceOf(holder.address)).toNumber()

      await token.transfer(holder.address, amountToTransfer, { from: admin.address })

      const expectedTotalHolderBalance = initialHolderBalance + amountToTransfer
      const currentBalance = (await token.balanceOf(holder.address)).toNumber()

      expect(currentBalance).to.be.equal(expectedTotalHolderBalance)
    })
  })

  describe('burn tests', function () {
    it('holders can burn', async function () {
      const amountToTransfer = 1000
      const amountToBurn = 500
      const initialHolderBalance = (await token.balanceOf(holder.address)).toNumber()

      await token.transfer(holder.address, amountToTransfer)
      await token.connect(holder).burn(amountToBurn)

      const expectedTotalHolderBalance = initialHolderBalance + amountToTransfer - amountToBurn
      const currentBalance = (await token.balanceOf(holder.address)).toNumber()

      expect(currentBalance).to.be.equal(expectedTotalHolderBalance)
    })
  })
})
