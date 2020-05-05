const fs = require("fs").promises;
const os = require("os");
const { spawn } = require("child_process");

module.exports = async config => {

    function exec(command, args, env) {
        return new Promise((resolve, reject) => {

            let proc = spawn(command, args, {
                env: { ...process.env, ...env },
                stdio: ["inherit", "inherit", "inherit"]
            });

            proc.on("exit", (code, signal) => {
                resolve({ code, signal });
            });

            proc.on("error", error => {
                reject(error);
            });
        });
    }

    function startProxy({auth, port}) {
        return new Promise((resolve, reject) => {
            resolve({
                port,
                async stop() {

                }
            });

        });
    }

    return {
        name: "proxy <device-id> [<command>] [args...]",
        description: "executes local process with device proxy",
        define(program) {
            program.option("-p, --port <port>", "use given port number, assigned dynamically otherwise")
        },

        async run(deviceId, command, args, options) {

            let fileConfig = JSON.parse(await fs.readFile(os.homedir() + "/.defa/config.json"));

            let proxy = await startProxy({ auth: fileConfig.auth, port: options.port });
            
            try {
                
                let { code, signal } = await exec(command || process.env.SHELL, args, {
                    DOCKER_HOST: `localhost:${proxy.port}`
                });

                process.exitCode = signal ? 1 : code;

            } finally {
                await proxy.stop();
            }
        }
    }
}