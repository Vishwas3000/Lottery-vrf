const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const decimals = 18
    const initialAnswer = 207810000000

    const args = [decimals, initialAnswer]

    log("----------------------------------------------------")
    log("Deploying Aggrigator...")
    const mockAggrigator = await deploy("MockV3Aggregator", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log(`You have deployed an Lottery contract to ${mockAggrigator.address}`)
    log("----------------------------------------------------")

    if (!developmentChains.includes(network.name)) {
        await verify(mockAggrigator.address, args)
    }
}

module.exports.tags = ["all", "aggrigator"]
