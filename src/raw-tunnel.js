const net = require("net");
const { resolve } = require("path");

module.exports = async ({ api: createApi }) => {

    return async function ({ port, deviceId, service }) {

        if (!port) {
            throw new Error("Local port needs to be specified for raw tunnel");
        }

        let api = await createApi();
        let clients = {};

        function connect() {
            return new Promise((resolve, reject) => {

                const server = net.createServer(async client => {

                    try {

                        let tunnelId = await api.tunnel.create({ deviceId, service });
                        clients[tunnelId] = client;

                        client.on("end", () => {
                            api.tunnel.close({ tunnelId }).catch(error => {
                                console.error("Error while closing tunnel", error);
                            });
                        });
                        client.on("data", data => {
                            api.tunnel.write({ tunnelId, data }).catch(error => {
                                console.error("Error while writing to tunnel", error);
                            });
                        });

                    } catch (e) {
                        console.error("Error starting tunnel:", e);                        
                    }

                });

                server.on("error", (error) => {
                    reject(error);
                });

                server.listen(port, () => {
                    resolve(server);
                });

            });
        }

        server = await connect();

        api.on("tunnel", "data", ({ tunnelId, data }) => {
            let client = clients[tunnelId];
            if (client) {
                client.write(Buffer.from(data.data));
            }
        });

        return {
            service,
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
        }

    }

};