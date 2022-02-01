const { spawn } = require("child_process");

module.exports = async () => {
    return function (command, args, env) {
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
}