const Web3 = require('web3')

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const BigNumber = require('bignumber.js')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const YamToken = artifacts.require('YamToken.sol')

const YamTokenContract = require(
  '../build/contracts/YamToken.json'
)

const YamLottery = artifacts.require('YamLottery.sol')

const YamLotteryContract = require(
  '../build/contracts/YamLottery.json'
)

contract('Lottery Contract ', function (accounts) {
    beforeEach(async function () {

      this.addr = {
        owner: accounts[0],
        holder1: accounts[1],
        holder2: accounts[2],
        holder3: accounts[3],
        stranger: accounts[4],
      }
      this.tokenName = "Yet Another Mintable Token"
      this.tokenSymbol = "YAMT"
      this.claimingCount = 3

      this.yamToken = await YamToken.new(this.tokenName, this.tokenSymbol)
      this.addr.token = this.yamToken.address

      this.CYamToken = await new web3.eth.Contract(
        YamTokenContract.abi, this.addr.token
      )

      this.YamLottery = await YamLottery.new(this.addr.token, this.claimingCount)
      this.addr.lottery = this.YamLottery.address

      this.CYamLottery = await new web3.eth.Contract(
        YamLotteryContract.abi, this.addr.lottery
      )

      this.initialBalance = BigNumber('1000000000000000000').multipliedBy(100)
      await this.yamToken.mint(this.addr.owner, this.initialBalance.toFixed());
      await this.yamToken.mint(this.addr.holder1, this.initialBalance.toFixed());
      await this.yamToken.mint(this.addr.holder2, this.initialBalance.toFixed());
      await this.yamToken.mint(this.addr.holder3, this.initialBalance.toFixed());

    })

    describe('lottery integrity', async function () {

      it('recive a token address', async function () {

        const _tokenAddress = await this.CYamLottery.methods.tokenAddress().call()
        _tokenAddress.should.be.equal(this.addr.token)

      })

      it('store a claiming count', async function () {

        const _claimingCount = BigNumber(await this.CYamLottery.methods.claimingCount().call()).toNumber()
        _claimingCount.should.be.equal(this.claimingCount)

      })


    })


    describe('players can participate', async function () {

      beforeEach(async function () {

        this.tokenAmount = '2000000000000000000'

      })

      it('not increase in contract balance when tokens are transfered', async function () {

        await this.CYamToken.methods.transfer(this.addr.lottery, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        const _newBalance = await this.CYamLottery.methods.balanceOf(this.addr.holder1).call()
        _newBalance.should.be.equal('0')

        const _contractBalance = await this.CYamToken.methods.balanceOf(this.addr.lottery).call()
        _contractBalance.should.be.equal(this.tokenAmount)

      })

      it('increase in contract balance when a tokens are added', async function () {

        await this.CYamLottery.methods.addTokens(this.addr.lottery, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.rejectedWith(
          Error,
          'Returned error: VM Exception while processing transaction: revert ERC20: transfer amount exceeds allowance'
        )

        await this.CYamToken.methods.approve(this.addr.lottery, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder1, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled


        const _holderBalance = await this.CYamToken.methods.balanceOf(this.addr.holder1).call()
        _holderBalance.should.be.equal(this.initialBalance.minus(this.tokenAmount).toFixed())

        const _contractBalance = await this.CYamToken.methods.balanceOf(this.addr.lottery).call()
        _contractBalance.should.be.equal(this.tokenAmount)

        const _inContractBalance = await this.CYamLottery.methods.balanceOf(this.addr.holder1).call()
        _inContractBalance.should.be.equal(this.tokenAmount)

      })

      it('can transfer tokens to a player other than the sender', async function () {

        await this.CYamToken.methods.approve(this.addr.lottery, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder2, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        const _contractBalance = await this.CYamToken.methods.balanceOf(this.addr.lottery).call()
        _contractBalance.should.be.equal(this.tokenAmount)

        const _inContractBalance = await this.CYamLottery.methods.balanceOf(this.addr.holder1).call()
        _inContractBalance.should.be.equal('0')

        const _beneficiaryBalance = await this.CYamLottery.methods.balanceOf(this.addr.holder2).call()
        _beneficiaryBalance.should.be.equal(this.tokenAmount)

      })


    })

    describe('Lottery resolution', async function () {

      beforeEach(async function () {

      })

      it('onwer exclusively can resolve the lottery', async function () {

        await this.CYamLottery.methods.resolveLottery().send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.rejectedWith(
          Error,
          'Returned error: VM Exception while processing transaction: revert Ownable: caller is not the owner'
        )

        await this.CYamLottery.methods.resolveLottery().send({
          from: this.addr.owner,
          gas: 6721975
        }).should.be.fulfilled

      })

      it('players cant add tokens once the lottery is resolved', async function () {

        this.tokenAmount = '2000000000000000000'

        await this.CYamLottery.methods.resolveLottery().send({
          from: this.addr.owner,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamToken.methods.approve(this.addr.lottery, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder1, this.tokenAmount).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.rejectedWith(
          Error,
          'Returned error: VM Exception while processing transaction: revert cannot keep adding tokens once the lottery has been resolved'
        )

      })

    })

    describe('Lottery claiming', async function () {

      beforeEach(async function () {

        this.tokenAmount = BigNumber('2000000000000000000')

        await this.CYamToken.methods.approve(this.addr.lottery, this.tokenAmount.multipliedBy(3).toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder1, this.tokenAmount.toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder2, this.tokenAmount.toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder3, this.tokenAmount.toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

      })

      it('not be claimable if the lottery is not resolved', async function () {

        const _isResolved = await this.CYamLottery.methods.resolved().call()
        _isResolved.should.be.equal(false)

        await this.CYamLottery.methods.claim().send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.rejectedWith(
          Error,
          'Returned error: VM Exception while processing transaction: revert Lottery is not yet resolved'
        )

      })

      it('can only be claimed by a participant', async function () {

        await this.CYamLottery.methods.resolveLottery().send({
          from: this.addr.owner,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.claim().send({
          from: this.addr.stranger,
          gas: 6721975
        }).should.be.rejectedWith(
          Error,
          'Returned error: VM Exception while processing transaction: revert Claimer is not participating in the lottery'
        )

      })


    })

    describe('Claiming a resolved lottery', async function () {

      beforeEach(async function () {

        this.tokenAmount = BigNumber('2000000000000000000')

        await this.CYamToken.methods.approve(this.addr.lottery, this.tokenAmount.multipliedBy(3).toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder1, this.tokenAmount.toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder2, this.tokenAmount.toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.addTokens(this.addr.holder3, this.tokenAmount.toFixed()).send({
          from: this.addr.holder1,
          gas: 6721975
        }).should.be.fulfilled

        await this.CYamLottery.methods.resolveLottery().send({ from: this.addr.owner, gas: 6721975 }).should.be.fulfilled
        await this.CYamLottery.methods.claim().send({ from: this.addr.holder1 }).should.be.fulfilled
        await this.CYamLottery.methods.claim().send({ from: this.addr.holder2 }).should.be.fulfilled

      })

      it('players can claim a resolved lottery when it reaches the claimingCount', async function () {

        await this.CYamLottery.methods.claim().send({ from: this.addr.holder3 }).should.be.fulfilled

        await this.CYamLottery.methods.claim().send({
          from: this.addr.holder2,
          gas: 6721975
        }).should.be.rejectedWith(
          Error,
          'Returned error: VM Exception while processing transaction: revert Lottery has already been claimed'
        )

      })

      it('should emit an event every time a claiming is attempted until the winner is found', async function () {

        await this.CYamLottery.methods.claim().send({ from: this.addr.holder3 }).should.be.fulfilled

        const eventsEmited = await this.YamLottery.getPastEvents('LotteryClaimed')

        eventsEmited.length.should.be.equal(1)
        eventsEmited[0].returnValues.player.should.be.equal(this.addr.holder3)
        eventsEmited[0].returnValues.totalBag.should.be.equal(this.tokenAmount.multipliedBy(3).toFixed())

      })

      it('should emit an event every time a claiming is attempted until the winner is found', async function () {

        const _winnerOldBalance = BigNumber(await this.CYamToken.methods.balanceOf(this.addr.holder3).call())

        await this.CYamLottery.methods.claim().send({ from: this.addr.holder3 }).should.be.fulfilled

        const _winnerNewBalance = BigNumber( await this.CYamToken.methods.balanceOf(this.addr.holder3).call() )

        _winnerNewBalance.toFixed().should.be.equal(_winnerOldBalance.plus(this.tokenAmount.multipliedBy(3)).toFixed())

      })

    })

})
