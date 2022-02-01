const io = require("socket.io-client").io;

module.exports = async ({ getKey, url }) => {

    function getApi() {

        return new Promise((resolve, reject) => {

            let listeners = {};

            const socket = io(url, {
                transports: ["polling", "websocket"]
            });

            socket.on("event", async (apiName, eventName, args) => {
                if (listeners[apiName] && listeners[apiName][eventName]) {
                    for (let listener of listeners[apiName][eventName]) {
                        try {
                            await listener.apply(null, args);
                        } catch (e) {
                            console.error("Error in event listener", e);
                        }
                    }
                }
            });

            socket.on("connect_error", e => {
                reject(e);
            });

            socket.on("connect", () => {

                socket.emit("discover", "1.0", info => {

                    let api = {
                        close() {
                            socket.close();
                        }
                    };

                    for (let apiName in info.api) {
                        api[apiName] = {};
                        for (let fncName in info.api[apiName]) {
                            api[apiName][fncName] = async function (...args) {
                                return new Promise((resolveCall, rejectCall) => {
                                    socket.emit("call", {
                                        api: apiName,
                                        fnc: fncName,
                                        args
                                    }, reply => {
                                        if (reply.error) {
                                            rejectCall(reply.error);
                                        } else {
                                            resolveCall(reply.result);
                                        }
                                    });
                                });

                            };
                        }
                    }

                    api.on = function (apiName, eventName, listener) {
                        if (!listeners[apiName]) {
                            listeners[apiName] = {};
                        }
                        if (!listeners[apiName][eventName]) {
                            listeners[apiName][eventName] = [];
                        }
                        listeners[apiName][eventName].push(listener);
                    }

                    resolve(api);
                });

            });

        });

    }

    return async () => {
        let apiKey = getKey();
        let api = await getApi();
        api.authorization = await api.portal.authorizeSession({ apiKey });
        return api;
    };
}