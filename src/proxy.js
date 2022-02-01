const { spawn } = require("child_process");

module.exports = async ({ user, factories }) => {

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

    function handleError(err, req, res) {
        console.error("HTTP error:", err);
        res.writeHead(err.httpCode || 502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: err.message || err
            }
        }, null, 2));
    }

    return {
        name: "proxy <device-id> [<command>] [args...]",
        description: "executes local process with device proxy",
        define(program) {
            program
                .option("-s, --services <services>", "connect to given service(s), defaults to \"docker\"; multiple services are separated by comma")
                .option("-p, --ports <ports>", "use given port(s) for corresponding service(s); assigned dynamically if not specified")
                .on("--help", () => {
                    console.info();
                    console.info("Services are handled as HTTP by default. To create raw tunnel instead of HTTP proxy, prefix service name with !.");
                    console.info("Use -- to indicate the end of defa options. Any remaining options will be passed to executed command e.g.:");
                    console.info("defa proxy 1234abcd -- docker ps --all");
                });
        },

        async run(deviceId, command, args, { ports = "", services = "docker" }) {

            let apiKey = user.getApiKey();

            let proxies = [];

            try {

                services = services.split(",").map(s => s.trim());
                ports = ports.split(",").map(p => parseInt(p) || undefined);

                for (let i in services) {

                    let service = services[i];
                    let port = ports[i];

                    let startProxy;
                    if (service.startsWith("!")) {
                        startProxy = factories.raw;
                        service = service.substring(1);
                    } else {
                        startProxy = factories.http;
                    }

                    proxies.push(await startProxy({
                        apiKey,
                        deviceId,
                        service,
                        port
                    }));
                }

                let { code, signal } = await exec(
                    command || process.env.SHELL,
                    args,
                    proxies.reduce((acc, proxy) => ({
                        ...acc,
                        [proxy.service.toUpperCase() + "_PORT"]: proxy.port,
                        [proxy.service.toUpperCase() + "_HOST"]: "localhost:" + proxy.port
                    }), {})
                );

                process.exitCode = signal ? 1 : code;

            } catch (error) {
                process.exitCode = 1;
                throw error;
            } finally {
                for (let proxy of proxies) {
                    await proxy.stop();
                }
            }
        }
    }
}