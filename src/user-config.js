const fs = require("fs").promises;
const os = require("os");

module.exports = async config => {

    let configDir = os.homedir() + "/.defa";
    let configFile = configDir + "/config.json";

    let userConfig;

    try {
        userConfig = JSON.parse(await fs.readFile(configFile));
    } catch (e) {
        if (e.code === "ENOENT") {
            userConfig = {};
        } else {
            throw e;
        }
    }

    userConfig.save = async () => {
        await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
        await fs.writeFile(configFile, JSON.stringify(userConfig, null, 2));
    }

    userConfig.getApiKey = () => {
        if (!userConfig.apiKey) {
            throw new Error("Not logged in. Please use 'defa login' command to authenticate against DEVICE.FARM portal.");
        }
        return userConfig.apiKey;
    }

    return userConfig;

}