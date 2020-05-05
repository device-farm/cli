const fs = require("fs").promises;
const os = require("os");

module.exports = async config => {


    return {
        name: "login <api-token>",
        description: "login to DEVICE.FARM API",
        define(program) {
        },
        async run(token) {
            let dir = os.homedir() + "/.defa";
            let configFile = dir + "/config.json";
            await fs.mkdir(dir, { recursive: true, mode: 0o700 });
            await fs.writeFile(configFile, JSON.stringify({
                auth: {
                    token
                }
            }, null, 2));
            console.info("Authentication configuration saved to", configFile);
        }
    }
}