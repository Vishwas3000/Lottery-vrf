const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

describe("Lottery Unit test", function () {
    let deployer, lottery, lotteryContract, vrfCoordinatorV2Mock, player_1, player_2, minStake, eventDuration

    before(async function () {
        accounts = await ethers.getSigners() // could also do with getNamedAccounts
        deployer = accounts[0]
        player_1 = accounts[1]
        player_2 = accounts[2]
    })

    beforeEach(async function () {
        await deployments.fixture(["lottery", "coordinator", "aggrigator"])
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        lotteryContract = await ethers.getContract("Lottery")

        lottery = lotteryContract.connect(deployer)
        await lottery.startLottery()

        lottery = lotteryContract.connect(player_1)
        minStake = await lottery.i_minStake()
        eventDuration = await lottery.getEventDuration()
    })

    describe("enter Stake", function () {
        it("Record new entries", async function () {
            await lottery.stake({ value: minStake })
            const contractPlayer = await lottery.getPlayer(0)
            assert.equal(player_1.address, contractPlayer)

            lottery = lotteryContract.connect(player_2)
            await lottery.stake({ value: minStake })
            const contractPlayer2 = await lottery.getPlayer(1)
            assert.equal(player_2.address, contractPlayer2)
        })

        it("Emits an event when a new player enters", async function () {
            await expect(lottery.stake({ value: minStake })).to.emit(lottery, "PlayerStaked")
        })

        it("doesn't allow entrance when Lottery is calculating", async () => {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            await lottery.performUpkeep([])

            await expect(lottery.stake({ value: minStake })).to.be.revertedWith("Lottery__StakingNotOpen")
        })
    })

    describe("checkUpkeep", function () {
        it("reverts if not enough people have entered", async function () {
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })

            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
            assert.equal(upkeepNeeded, false)
        })

        it("reverts if not enough time has passed", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() - 10000])
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
            assert.equal(upkeepNeeded, false)
        })

        it("reverts if lottery is closed", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            await lottery.performUpkeep([])
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
            assert.equal(upkeepNeeded, false)
        })

        it("returns true if all the condition satisfies", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
            assert.equal(upkeepNeeded, true)
        })
    })

    describe("performUpkeep", function () {
        it("Runs only if checkUpkeep returns true", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const tx = await lottery.performUpkeep([])
            assert(tx)
        })

        it("Reverts if checkUpkeep returns false", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() - 10])
            await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpKeepNotNeeded")
        })

        it("Updates the lottery state", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })

            await lottery.performUpkeep([])

            const lotteryState = await lottery.s_lotteryState()
            assert.equal(lotteryState, 1)
        })
    })

    describe("fulfilRandomWords", function () {
        it("Called only after performUpkeep", async function () {
            await lottery.stake({ value: minStake })
            await network.provider.send("evm_increaseTime", [eventDuration.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })

            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith(
                "nonexistent request"
            )
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith(
                "nonexistent request"
            )
        })
    })
})
