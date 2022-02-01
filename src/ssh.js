const fs = require("fs").promises;

module.exports = async ({ exec, tunnel }) => {

    return {
        name: "ssh <device-id> [args...]",
        description: "opens SSH session to device",
        define(program) {
            program
                .on("--help", () => {
                    console.info();
                    console.info("Command 'defa ssh' is a shortcut to 'defa proxy' to make SSH access easier.");
                    console.info();
                    console.info("To specify user, prefix device-id with <username>@ as you would do for ssh command.");
                    console.info("User defaults to root.");
                    console.info("Use -- to indicate the end of defa options. Any remaining options will be passed to executed command e.g.:");
                    console.info("defa ssh root@1234abcd -- ls -al /");
                });
        },

        async run(deviceId, args) {

            let user;
            if (deviceId.indexOf("@") === -1) {
                user = "root";
            } else {
                [user, deviceId] = deviceId.split("@");
            }

            let port = await tunnel({ undefined, deviceId, service: "ssh" });

            async function checkDir(dir) {
                try {
                    await fs.stat(dir);
                } catch(e) {
                    if (e.code === "ENOENT") {
                        await fs.mkdir(dir);
                    } else {
                        throw e;
                    }                    
                }
            }

            await checkDir(`${process.env.HOME}/.defa`);
            await checkDir(`${process.env.HOME}/.defa/known_hosts`);           

            let { code, signal } = await exec(
                "ssh",
                [
                    `${user}@localhost`,
                    "-p",
                    port,
                    "-o",
                    `UserKnownHostsFile=${process.env.HOME}/.defa/known_hosts/${deviceId}`,
                    ...args
                ],
                {}
            );

            process.exitCode = signal ? 1 : code;
        }
    }
}