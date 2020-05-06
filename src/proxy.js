const fs = require("fs").promises;
const os = require("os");
const { spawn } = require("child_process");
const http = require("http");
const https = require("https");

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

    function handleError(err, req, res) {
        console.error("HTTP error:", err);
        res.writeHead(err.httpCode || 502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                message: err.message || err
            }
        }, null, 2));
    }

    function startProxy({ auth, port, deviceId, service }) {

        async function getTarget(req) {
            let targetHost = `${service}-${deviceId}.device.farm`;
    
            let targetUrl = `https://${targetHost}${req.url}`;
    
            return {
                url: targetUrl,
                options: {
                    agent: new https.Agent(),
                    servername: targetHost,
                    method: req.method,
                    headers: {
                        ...req.headers,
                        ...(auth && auth.token ? {
                            "Authorization": `Bearer ${auth.token}`
                        } : {})
                    }
                }
            };
        }
    
        return new Promise((resolve, reject) => {

            let server = http.createServer(async (req, res) => {

                try {

                    res.setTimeout(0);

                    let target = await getTarget(req);

                    let targetReq = http.request(target.url, target.options, targetRes => {
                        res.writeHead(targetRes.statusCode, targetRes.statusMessage, targetRes.headers);
                        res.write("");
                        res.uncork();
                        targetRes.pipe(res);
                    });

                    targetReq.on("error", e => {
                        handleError(e, req, res);
                    });

                    req.pipe(targetReq);

                } catch (e) {
                    handleError(e, req, res);
                }

            });

            port = 8777;
            server.listen(port);

            server.on("upgrade", async (req, socket, head) => {
                try {

                    socket.on("error", e => {
                        if (e.code !== "EPIPE") {
                            console.error("Upgraded socket error:", e);
                        }
                    });

                    let target = await getTarget(req);

                    let targetReq = http.request(target.url, target.options);

                    targetReq.on("error", e => {
                        if (e.code !== "ECONNRESET") {
                            console.error("Upgraded socket error: ", e);
                        }
                    });

                    targetReq.on("upgrade", (targetRes, targetSocket, upgradeHead) => {

                        socket.write(
                            `HTTP/${targetRes.httpVersion} ${targetRes.statusCode} ${targetRes.statusMessage}\n` +
                            Object.entries(targetRes.headers).map(([k, v]) => `${k}: ${v}\n`).join("") +
                            "\n"
                            , () => {
                                socket.uncork();
                                socket.pipe(targetSocket).pipe(socket);
                            });

                    });

                    targetReq.end(head);

                } catch (e) {
                    console.error("Error proxying upgrade request", e);
                    //TODO: return valid HTTP response 
                    socket.destroy();
                }
            });

            server.on("clientError", (e, socket) => {
                if (e.code !== "ECONNRESET") {
                    console.error("Client error: ", e);
                }
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            });

            server.on("listening", () => {
                resolve({
                    port,
                    stop() {
                        return new Promise((resolve, reject) => {
                            server.close(error => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }
                });
            });

        });
    }

    return {
        name: "proxy <device-id> [<command>] [args...]",
        description: "executes local process with device proxy",
        define(program) {
            program.option("-p, --port <port>", "use given port number, assigned dynamically otherwise")
            program.option("-s, --service <service>", "connect to given service, defaults to \"docker\"")
        },

        async run(deviceId, command, args, { port, service = "docker" }) {

            let fileConfig = JSON.parse(await fs.readFile(os.homedir() + "/.defa/config.json"));

            let proxy = await startProxy({
                auth: fileConfig.auth,
                deviceId,
                port,
                service
            });

            try {

                let { code, signal } = await exec(command || process.env.SHELL, args, {
                    [`${service.toUpperCase()}_PORT`]: proxy.port,
                    [`${service.toUpperCase()}_HOST`]: `localhost:${proxy.port}`
                });

                process.exitCode = signal ? 1 : code;

            } catch (error) {
                process.exitCode = 1;
                throw error;
            } finally {
                await proxy.stop();
            }
        }
    }
}