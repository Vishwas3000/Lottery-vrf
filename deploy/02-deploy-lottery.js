const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const contractAddress = require("../constants/addresses.json")
const vrfParameters = require("../constants/vrfParameters.json")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    let subscriptionId, vrfCoordinatorAddress, keyHash, minStake

    const eventDuration = 60 * 4 // 4 minutes
    if (!developmentChains.includes(network.name)) {
        minStake = ethers.utils.parseEther("0.0")
        subscriptionId = vrfParameters[network.name]["subscriptionId"]
        vrfCoordinatorAddress = vrfParameters[network.name]["vrfCoordinator"]
        keyHash = vrfParameters[network.name]["keyHash"]
    } else {
        minStake = ethers.utils.parseEther("1.0")
        vrfCoordinatorAddress = contractAddress[31337]["VrfCoordinator"]
        keyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc"
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        subscriptionId = transactionReceipt.events[0].args.subId
        // Fund the subscription
        // Our mock makes it so we don't actually have to worry about sending fund
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, ethers.utils.parseEther("1"))
    }

    const args = [minStake, subscriptionId, vrfCoordinatorAddress, keyHash, eventDuration]

    log("----------------------------------------------------")
    log("Deploying Lottery...")
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log(`You have deployed an Lottery contract to ${lottery.address}`)
    log("----------------------------------------------------")

    if (!developmentChains.includes(network.name)) {
        await verify(lottery.address, args)
    } else {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address)
    }
}

module.exports.tags = ["all", "lottery"]
