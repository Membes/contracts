
const { expect } = require('chai')
const provider = waffle.provider// ethers.getDefaultProvider()

const NON_EXISTENT_CAMPAIGN_ID = 151515151

// hardhat accounts
const privateKeys = {
  contractAdmin1: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  contractAdmin2: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  campaign1Admin: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  campaign2Admin: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  campaign3Admin: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  campaign4Admin: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  campaign1User: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  campaign2User: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  campaign3User: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  randomUser1: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
  randomUser2: '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897'
}

const fromWei = val => ethers.utils.formatUnits(val, 'ether')

describe('Box contract', function () {
  let token, box, contractAdmin1, contractAdmin2, campaign1Admin, campaign2Admin
  let campaign3Admin, campaign4Admin, campaign1User, campaign2User, campaign3User
  let randomUser1, randomUser2, campaign1Id, campaign2Id, campaign3Id

  const campaignAdminInitialTokenBalance = 1000

  const campaign1Balance = 100
  const campaign2Balance = 200
  const campaign3Balance = 300
  const campaign4Balance = 400

  let campaignFee

  before(async () => {
    [
      contractAdmin1, contractAdmin2, campaign1Admin, campaign2Admin, campaign3Admin,
      campaign4Admin, campaign1User, campaign2User, campaign3User, randomUser1, randomUser2
    ] = await ethers.getSigners()

    const Token = await ethers.getContractFactory('Token')
    const Box = await ethers.getContractFactory('Box')

    token = await Token.deploy()
    box = await Box.deploy()

    // await token.connect(contractAdmin1).transfer(campaign1Admin.address, campaignAdminInitialTokenBalance)
    await token.connect(contractAdmin1).transfer(campaign2Admin.address, campaignAdminInitialTokenBalance)
    await token.connect(contractAdmin1).transfer(campaign3Admin.address, campaignAdminInitialTokenBalance)
    await token.connect(contractAdmin1).transfer(campaign4Admin.address, campaignAdminInitialTokenBalance)

    // await token.connect(campaign1Admin).approve(box.address, campaign1Balance)
    await token.connect(campaign2Admin).approve(box.address, campaign2Balance)
    await token.connect(campaign3Admin).approve(box.address, campaign3Balance)
    await token.connect(campaign4Admin).approve(box.address, campaign4Balance)
  })

  describe('admin tests', function () {
    describe('admin management', function () {
      it('deployer should be admin', async () => {
        expect(await box.isContractAdmin(contractAdmin1.address)).to.equal(true)
      })

      it('user should not be admin', async () => {
        expect(await box.isContractAdmin(contractAdmin2.address)).to.equal(false)
      })

      it('only contract admin can add other admin', async () => {
        expect(await box.isContractAdmin(contractAdmin2.address)).to.equal(false)
        await expect(box.connect(randomUser1).addContractAdmin(contractAdmin2.address)).to.be.reverted
        expect(await box.isContractAdmin(contractAdmin2.address)).to.equal(false)

        await box.connect(contractAdmin1).addContractAdmin(contractAdmin2.address)
        expect(await box.isContractAdmin(contractAdmin2.address)).to.equal(true)
      })

      it('only contract admin can remove other admin', async () => {
        await expect(box.connect(randomUser1).removeContractAdmin(contractAdmin2.address)).to.be.reverted
        expect(await box.isContractAdmin(contractAdmin2.address)).to.equal(true)

        await box.connect(contractAdmin1).removeContractAdmin(contractAdmin2.address)
        expect(await box.isContractAdmin(contractAdmin2.address)).to.equal(false)
      })

      it('last admin cannot be removed', async () => {
        await expect(box.connect(contractAdmin1).removeContractAdmin(contractAdmin1.address)).to.be.reverted
      })
    })

    describe('contract management', function () {
      it('only contract admin can change campaign creation fee', async () => {
        campaignFee = (await box.campaignFee()).toNumber() + 20
        const newAdminCampaignFee = campaignFee + 30

        await box.connect(contractAdmin1).setCampaignFee(newAdminCampaignFee)
        expect(await box.campaignFee()).to.equal(newAdminCampaignFee)
        campaignFee = newAdminCampaignFee

        const userCampaignFee = 20
        await expect(box.connect(campaign1User).setCampaignFee(userCampaignFee)).to.be.reverted
        expect(await box.campaignFee()).to.equal(campaignFee)
      })

      it('only contract admin can pause contract', async () => {
        await expect(box.pauseContract({ from: campaign1User.address })).to.be.reverted
        expect(await box.paused()).to.equal(false)

        await expect(box.pauseContract({ from: contractAdmin1.address })).to.emit(box, 'Paused')
        expect(await box.paused()).to.equal(true)
      })

      it('only contract admin can unpause contract', async () => {
        await expect(box.unpauseContract({ from: campaign1User.address })).to.be.reverted
        expect(await box.paused()).to.equal(true)

        await expect(box.unpauseContract({ from: contractAdmin1.address })).to.emit(box, 'Unpaused')
        expect(await box.paused()).to.equal(false)
      })

      it('only contract admin can withdraw fees', async () => {
        const campaign1UserGasBalancePreCall = +fromWei(await campaign1User.getBalance())
        const contractAdmin1PreCallGasBalance = (await contractAdmin1.getBalance())
        const boxContractGasBalance = (await provider.getBalance(box.address))

        let contractAdmin1PostCallGasBalance = contractAdmin1PreCallGasBalance.add(boxContractGasBalance)

        await expect(box.connect(campaign1User).withdrawFees()).to.be.reverted
        await expect(+fromWei((await campaign1User.getBalance()))).to.be.lessThan(campaign1UserGasBalancePreCall)

        const gasPriceAdmin = await provider.getGasPrice()
        const gasEstimateAdmin = await box.connect(contractAdmin1).estimateGas.withdrawFees()
        const txCostAdmin = gasEstimateAdmin.mul(gasPriceAdmin)
        contractAdmin1PostCallGasBalance = contractAdmin1PostCallGasBalance.sub(txCostAdmin)

        const config = { gasLimit: gasEstimateAdmin, gasPrice: gasPriceAdmin }
        await expect((await box.connect(contractAdmin1).withdrawFees({ ...config }))).to.emit(box, 'FeesWithdrawn')
        await expect(+fromWei((await provider.getBalance(box.address)))).to.equal(0)
        await expect(fromWei((await contractAdmin1.getBalance()))).to.equal(fromWei(contractAdmin1PostCallGasBalance))
      })
    })
  })

  describe('contract states', function () {
    describe('active', function () {
      describe('campaign admins', function () {
        let preCancelledCampaignBalance = 0

        it('cannot create campaign without fee', async () => {
          await expect(box.connect(campaign1Admin).createCampaign(token.address, 10, 1, true, { value: 0 })).to.be.reverted
          expect((await box.userCampaignCount(campaign1Admin.address)).toNumber()).to.equal(0)
        })

        it('cannot create campaign without funds allowance', async () => {
          expect((await token.allowance(campaign1Admin.address, box.address)).toNumber()).to.equal(0)
          await expect(box.connect(campaign1Admin).createCampaign(token.address, 10, 1, true, { value: campaignFee })).to.be.reverted
          expect((await box.userCampaignCount(campaign1Admin.address)).toNumber()).to.equal(0)
        })

        it('cannot create campaign without funds', async () => {
          await token.connect(campaign1Admin).approve(box.address, campaign1Balance)
          await expect(box.connect(campaign1Admin).createCampaign(token.address, 10, 3, true, { value: campaignFee })).to.be.reverted
          expect((await box.userCampaignCount(campaign1Admin.address)).toNumber()).to.equal(0)
        })

        it('cannot create campaign with un-even beneficiaries/claims', async () => {
          await token.connect(campaign1Admin).approve(box.address, campaign1Balance)
          await expect(box.connect(campaign1Admin).createCampaign(token.address, 10, 3, true, { value: campaignFee })).to.be.reverted
          expect((await box.userCampaignCount(campaign1Admin.address)).toNumber()).to.equal(0)
        })

        it('can create campaigns with funds', async () => {
          await token.connect(contractAdmin1).transfer(campaign1Admin.address, campaignAdminInitialTokenBalance)

          const initialCampaignAdmin1Count = (await box.userCampaignCount(campaign1Admin.address)).toNumber()
          const initialCampaignAdmin2Count = (await box.userCampaignCount(campaign2Admin.address)).toNumber()

          await box.connect(campaign1Admin).createCampaign(token.address, campaign1Balance, 1, true, { value: campaignFee })
          await box.connect(campaign2Admin).createCampaign(token.address, campaign2Balance, 100, true, { value: campaignFee })

          await expect((await token.balanceOf(box.address)).toNumber()).to.equal(campaign1Balance + campaign2Balance)

          const campaignAdmin1Count = (await box.userCampaignCount(campaign1Admin.address)).toNumber()
          const campaignAdmin2Count = (await box.userCampaignCount(campaign2Admin.address)).toNumber()

          campaign1Id = (await box.userCampaignIds(campaign1Admin.address, campaignAdmin1Count)).toNumber()
          campaign2Id = (await box.userCampaignIds(campaign2Admin.address, campaignAdmin2Count)).toNumber()

          expect((await box.campaigns(campaign1Id)).token.toString()).to.equal(token.address)
          expect((await box.campaigns(campaign2Id)).token.toString()).to.equal(token.address)

          await expect((await box.isCampaignAdmin(campaign1Id, campaign1Admin.address))).to.equal(true)
          await expect((await box.isCampaignAdmin(campaign2Id, campaign2Admin.address))).to.equal(true)

          expect((await box.userCampaignCount(campaign1Admin.address)).toNumber()).to.equal(initialCampaignAdmin1Count + 1)
          expect((await box.userCampaignCount(campaign2Admin.address)).toNumber()).to.equal(initialCampaignAdmin2Count + 1)
        })

        it('only campaign admin can suspend campaign', async () => {
          await expect((await box.campaigns(campaign1Id)).active).to.equal(true)

          await expect(box.connect(campaign1User).suspendCampaign(campaign1Id)).to.be.reverted
          await expect((await box.campaigns(campaign1Id)).active).to.equal(true)

          await box.connect(campaign1Admin).suspendCampaign(campaign1Id)
          await expect((await box.campaigns(campaign1Id)).active).to.equal(false)
        })

        it('only campaign admin can resume campaign', async () => {
          await expect(box.connect(campaign1User).resumeCampaign(campaign1Id)).to.be.reverted
          await expect((await box.campaigns(campaign1Id)).active).to.equal(false)

          await box.connect(campaign1Admin).resumeCampaign(campaign1Id)
          await expect((await box.campaigns(campaign1Id)).active).to.equal(true)
        })

        it('only campaign admin can cancel campaign', async () => {
          preCancelledCampaignBalance = ((await box.campaigns(campaign1Id)).balance).toNumber()

          await expect(box.connect(campaign1User).cancelCampaign(campaign1Id)).to.be.reverted
          expect((await box.campaigns(campaign1Id)).cancelled).to.equal(false)

          await box.connect(campaign1Admin).cancelCampaign(campaign1Id)
          expect((await box.campaigns(campaign1Id)).cancelled).to.equal(true)
        })

        it('remaining campaign funds are transferred to admin after cancelling', async () => {
          await expect(((await box.campaigns(campaign1Id)).balance).toNumber()).to.equal(0)
          await expect((await box.connect(campaign1Admin).getReward(campaign1Id)).toNumber()).to.equal(preCancelledCampaignBalance)
        })

        it('campaign admin can withdraw remaining funds from contract after cancelling', async () => {
          const initialAdminTokenBalance = (await token.balanceOf(campaign1Admin.address)).toNumber()

          const rewardsDue = (await box.connect(campaign1Admin).getReward(campaign1Id)).toNumber()
          await box.connect(campaign1Admin).withdrawReward(campaign1Id)

          const expectedTokenBalance = initialAdminTokenBalance + rewardsDue

          await expect((await token.balanceOf(campaign1Admin.address)).toNumber()).to.equal(expectedTokenBalance)
        })
      })

      describe('campaign users', function () {
        it('users cannot claim campaign with invalid signer', async () => {
          const nonce = '1'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign2User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign1AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign1Admin)
          const signature = ethers.utils.joinSignature(campaign1AdminSigner.signDigest(prefixedHash))

          await expect((await box.isCampaignBeneficiary(campaign2Id, campaign2User.address))).to.equal(false)

          await expect(box.connect(campaign2User).claimReward(campaign2Id, nonce, signature)).to.be.reverted
          await expect((await box.connect(campaign2User).getReward(campaign2Id)).toNumber()).to.equal(0)

          await expect((await box.isCampaignBeneficiary(campaign2Id, campaign2User.address))).to.equal(false)
        })

        it('users cannot claim rewards for non-existent campaign', async () => {
          const nonce = '1'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign2User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign2AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign2Admin)
          const signature = ethers.utils.joinSignature(campaign2AdminSigner.signDigest(prefixedHash))

          await expect(box.connect(campaign2User).claimReward(NON_EXISTENT_CAMPAIGN_ID, nonce, signature)).to.be.reverted
        })

        it('users can claim campaign rewards', async () => {
          const nonce = '2'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign2User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign2AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign2Admin)
          const signature = ethers.utils.joinSignature(campaign2AdminSigner.signDigest(prefixedHash))

          const preCampaignTokenBalance = ((await box.campaigns(campaign2Id)).balance).toNumber()
          const campaignRewardValue = ((await box.campaigns(campaign2Id)).claim).toNumber()

          const preUserClaimsCount = (await box.userClaimsCount(campaign2User.address)).toNumber()
          await expect((await box.isCampaignBeneficiary(campaign2Id, campaign2User.address))).to.equal(false)
          await expect((await box.connect(campaign2User).getReward(campaign2Id)).toNumber()).to.equal(0)

          await box.connect(campaign2User).claimReward(campaign2Id, nonce, signature)

          const postCampaignTokenBalance = ((await box.campaigns(campaign2Id)).balance).toNumber()
          expect(postCampaignTokenBalance).to.equal(preCampaignTokenBalance - campaignRewardValue)

          await expect((await box.connect(campaign2User).getReward(campaign2Id)).toNumber()).to.equal(campaignRewardValue)

          await expect((await box.isCampaignBeneficiary(campaign2Id, campaign2User.address))).to.equal(true)

          const postUserClaimsCount = (await box.userClaimsCount(campaign2User.address)).toNumber()
          expect(postUserClaimsCount).to.equal(preUserClaimsCount + 1)
        })

        it('users cannot re-use nonce to claim campaign rewards', async () => {
          const initialCampaignRewardValue = (await box.connect(campaign2User).getReward(campaign2Id)).toNumber()
          const nonce = '2'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign2User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign2AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign2Admin)
          const signature = ethers.utils.joinSignature(campaign2AdminSigner.signDigest(prefixedHash))

          await expect(box.connect(campaign2User).claimReward(campaign2Id, nonce, signature)).to.be.reverted

          await expect((await box.connect(campaign2User).getReward(campaign2Id)).toNumber()).to.equal(initialCampaignRewardValue)
        })

        it('other users too can users can claim campaign rewards', async () => {
          const nonce = '3'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, randomUser1.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign2AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign2Admin)
          const signature = ethers.utils.joinSignature(campaign2AdminSigner.signDigest(prefixedHash))

          await expect((await box.getCampaignBeneficiaryCount(campaign2Id))).to.equal(1)
          await expect((await box.isCampaignBeneficiary(campaign2Id, randomUser1.address))).to.equal(false)

          await box.connect(randomUser1).claimReward(campaign2Id, nonce, signature)

          const campaignRewardValue = ((await box.campaigns(campaign2Id)).claim).toNumber()
          await expect((await box.connect(randomUser1).getReward(campaign2Id)).toNumber()).to.equal(campaignRewardValue)

          await expect((await box.isCampaignBeneficiary(campaign2Id, randomUser1.address))).to.equal(true)

          const userClaimsCount = (await box.userClaimsCount(randomUser1.address)).toNumber()
          const userLastCampaignClaimId = await box.getUserClaim(randomUser1.address, userClaimsCount - 1)
          expect(userLastCampaignClaimId).to.equal(campaign2Id)

          await expect((await box.getCampaignBeneficiaryCount(campaign2Id))).to.equal(2)
          await expect((await box.getCampaignBeneficiary(campaign2Id, 2 - 1))).to.equal(randomUser1.address)
        })

        it('users cannot claim reward in spent campaign', async () => {
          const nonce = '4'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, randomUser2.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign2AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign2Admin)
          const signature = ethers.utils.joinSignature(campaign2AdminSigner.signDigest(prefixedHash))

          await expect(box.connect(randomUser2).claimReward(campaign2Id, nonce, signature)).to.be.reverted

          await expect((await box.connect(randomUser2).getReward(campaign2Id)).toNumber()).to.equal(0)
          await expect((await box.isCampaignBeneficiary(campaign2Id, randomUser2.address))).to.equal(false)
        })

        it('users cannot claim campaign rewards on suspended campaign', async () => {
          const initialCampaignRewardValue = ((await box.campaigns(campaign2Id)).claim).toNumber()
          const nonce = '5'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign2User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign2AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign2Admin)
          const signature = ethers.utils.joinSignature(campaign2AdminSigner.signDigest(prefixedHash))

          await expect(box.connect(campaign2User).claimReward(campaign2Id, nonce, signature)).to.be.reverted

          await expect((await box.connect(campaign2User).getReward(campaign2Id)).toNumber()).to.equal(initialCampaignRewardValue)
        })

        it('users cannot claim campaign rewards on cancelled campaign', async () => {
          const nonce = '6'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign1User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign1AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign1Admin)
          const signature = ethers.utils.joinSignature(campaign1AdminSigner.signDigest(prefixedHash))

          await expect(box.connect(campaign1User).claimReward(campaign1Id, nonce, signature)).to.be.reverted

          await expect((await box.connect(campaign1User).getReward(campaign1Id)).toNumber()).to.equal(0)
        })

        it('users can withdraw campaign rewards only once', async () => {
          const initialUserTokenBalance = (await token.balanceOf(campaign2User.address)).toNumber()

          const rewardsDue = (await box.connect(campaign2User).getReward(campaign2Id)).toNumber()
          await box.connect(campaign2User).withdrawReward(campaign2Id)
          await expect(box.connect(campaign2User).withdrawReward(campaign2Id)).to.be.reverted

          const expectedTokenBalance = initialUserTokenBalance + rewardsDue

          await expect((await token.balanceOf(campaign2User.address)).toNumber()).to.equal(expectedTokenBalance)

          const userClaimsCount = (await box.userClaimsCount(campaign2User.address)).toNumber()
          expect(userClaimsCount).to.equal(0)
        })
      })
    })

    describe('paused', function () {
      before(async () => {
        const campaign3Balance = 300

        await box.connect(campaign3Admin).createCampaign(token.address, campaign3Balance, 1, true, { value: campaignFee })

        const campaignCreator3Count = (await box.userCampaignCount(campaign3Admin.address)).toNumber()
        campaign3Id = (await box.userCampaignIds(campaign3Admin.address, campaignCreator3Count)).toNumber()

        const nonce = '1'

        const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign3User.address])
        const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

        const campaign3AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign3Admin)
        const signature = ethers.utils.joinSignature(campaign3AdminSigner.signDigest(prefixedHash))

        await box.connect(campaign3User).claimReward(campaign3Id, nonce, signature)

        const campaignRewardValue = ((await box.campaigns(campaign3Id)).claim).toNumber()
        await expect((await box.connect(campaign3User).getReward(campaign3Id)).toNumber()).to.equal(campaignRewardValue)

        await expect(box.pauseContract({ from: contractAdmin1.address })).to.emit(box, 'Paused')
      })

      describe('campaign admins', function () {
        it('cannot create campaign', async () => {
          const campaign4Balance = 400

          await expect(box.connect(campaign4Admin).createCampaign(token.address, campaign4Balance, 1, true, { value: campaignFee }))
            .to.be.reverted
        })

        it('campaign admin cannot suspend', async () => {
          await expect((await box.campaigns(campaign3Id)).active).to.equal(true)

          await expect(box.connect(campaign3Admin).suspendCampaign(campaign3Id)).to.be.reverted
          await expect((await box.campaigns(campaign3Id)).active).to.equal(true)
        })

        it('campaign admin cannot resume suspended campaign', async () => {
          await expect(box.unpauseContract({ from: contractAdmin1.address })).to.emit(box, 'Unpaused')
          await box.connect(campaign3Admin).suspendCampaign(campaign3Id)
          await expect((await box.campaigns(campaign3Id)).active).to.equal(false)
          await expect(box.pauseContract({ from: contractAdmin1.address })).to.emit(box, 'Paused')

          await expect(box.connect(campaign3Admin).resumeCampaign(campaign3Id)).to.be.reverted
          await expect((await box.campaigns(campaign3Id)).active).to.equal(false)

          await expect(box.unpauseContract({ from: contractAdmin1.address })).to.emit(box, 'Unpaused')
          await box.connect(campaign3Admin).resumeCampaign(campaign3Id)
          await expect((await box.campaigns(campaign3Id)).active).to.equal(true)
          await expect(box.pauseContract({ from: contractAdmin1.address })).to.emit(box, 'Paused')
        })
      })

      describe('campaign users', function () {
        it('cannot claim rewards', async () => {
          const nonce = '2'

          const hash = ethers.utils.solidityKeccak256(['string', 'address'], [nonce, campaign3User.address])
          const prefixedHash = ethers.utils.solidityKeccak256(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

          const campaign3AdminSigner = new ethers.utils.SigningKey(privateKeys.campaign3Admin)
          const signature = ethers.utils.joinSignature(campaign3AdminSigner.signDigest(prefixedHash))

          await expect(box.connect(campaign2User).claimReward(campaign3Id, nonce, signature)).to.be.reverted
          await expect((await box.connect(campaign2User).getReward(campaign3Id)).toNumber()).to.equal(0)
        })

        it('cannot withdraw rewards', async () => {
          const initialUserTokenBalance = (await token.balanceOf(campaign3User.address)).toNumber()

          const rewardsDue = (await box.connect(campaign3User).getReward(campaign3Id)).toNumber()
          expect(rewardsDue).to.not.equal(0)

          await expect(box.connect(campaign3User).withdrawReward(campaign3Id)).to.be.reverted

          await expect((await token.balanceOf(campaign3User.address)).toNumber()).to.equal(initialUserTokenBalance)
        })
      })
    })
  })
})
