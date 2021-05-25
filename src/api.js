const io = require("socket.io-client").io;

module.exports = async ({ getKey, url }) => {

    function getApi() {

        return new Promise((resolve, reject) => {

            const socket = io(url, {
                transports: ["polling", "websocket"]
            });

            socket.on("event", (apiName, eventName, args) => {
                //TODO: expose events on API
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

                    // Object.entries(info.events).forEach(([apiName, events]) => {
                    //     events.forEach(eventName => {
                    //         let initcap = s => s.charAt(0).toUpperCase() + s.slice(1);
                    //         let methodName = "on" + (apiName ? initcap(apiName) : "") + initcap(eventName);
                    //         let jqName = "webglue." + (apiName ? apiName + "." : "") + eventName;
                    //         $.fn[methodName] = function (handler) {
                    //             this.on(jqName, (e, ...args) => {
                    //                 if (e.currentTarget === e.target) {
                    //                     handler.apply(handler, args);
                    //                 }
                    //             });
                    //             return this;
                    //         };
                    //     });
                    // });

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