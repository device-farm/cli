const http = require("http");
const https = require("https");

module.exports = async ({ }) => function ({ apiKey, port, deviceId, service }) {

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
                    ...(apiKey ? {
                        "Authorization": `Bearer ${apiKey}`
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

        server.on("error", reject);

        server.on("listening", () => {
            resolve({
                service,
                port: server.address().port,
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