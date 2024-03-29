module.exports = async ({ user, factories, exec }) => {

    return {
        name: "proxy <device-id> [<command>] [args...]",
        description: "executes local process with device proxy",
        define(program) {
            program
                .option("-s, --services <services>", "connect to given service(s), defaults to \"docker\"; multiple services are separated by comma")
                .option("-p, --ports <ports>", "use given port(s) for corresponding service(s); assigned dynamically if not specified")
                .on("--help", () => {
                    console.info();
                    console.info("By default HTTP proxy is established. To create tunnel instead of HTTP proxy, prefix service name with ~.");
                    console.info("Use -- to indicate the end of defa options. Any remaining options will be passed to executed command e.g.:");
                    console.info("defa proxy 1234abcd -- docker ps --all");
                });
        },

        async run(deviceId, command, args, { ports = "", services = "docker" }) {

            let apiKey = user.getApiKey();

            let proxies = [];

            services = services.split(",").map(s => s.trim());
            ports = ports.split(",").map(p => parseInt(p) || undefined);

            for (let i in services) {

                let service = services[i];
                let port = ports[i];

                let startProxy;
                if (service.startsWith("~")) {
                    startProxy = factories.tunnel;
                    service = service.substring(1);
                } else {
                    startProxy = factories.http;
                }

                proxies.push({
                    port: await startProxy({
                        apiKey,
                        deviceId,
                        service,
                        port
                    }),
                    service
                });
            }

            let env = proxies.reduce((acc, proxy) => ({
                ...acc,
                [proxy.service.toUpperCase() + "_PORT"]: proxy.port,
                [proxy.service.toUpperCase() + "_HOST"]: "localhost:" + proxy.port
            }), {});

            args = args.map(s => s.replace(/\${?[A-Za-z0-9_]+}?/g, c => env[c.replace(/[${}]/g, "")]));

            let { code, signal } = await exec(
                command || process.env.SHELL,
                args,
                env
            );

            process.exitCode = signal ? 1 : code;

        }
    }
}