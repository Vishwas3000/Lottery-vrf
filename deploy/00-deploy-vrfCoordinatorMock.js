const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const args = [100000, 100000]

    log("----------------------------------------------------")
    log("Deploying coordinator...")
    const lottery = await deploy("VRFCoordinatorV2Mock", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log(`You have deployed an Lottery contract to ${lottery.address}`)
    log("----------------------------------------------------")

    if (!developmentChains.includes(network.name)) {
        await verify(lottery.address, args)
    }
}

module.exports.tags = ["all", "coordinator"]
