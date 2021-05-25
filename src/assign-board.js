module.exports = async ({ api: createApi }) => {

    async function install(deviceId, blkDevice, {
        rootOverlayDir,
        dtoDir,
        wifi,
        sshPubKeysFile
    }, log, dryRun) {

        let api = await createApi();
        try {

            let { portal } = api;

            let detail = await portal.getDeviceDetail({ deviceId });
            if (!detail.device.board) {
                throw new Error("No board information for this device.");
            }

            let wireGuardSettings = await portal.getWireGuardSettings({ deviceId });

            let environment = {
                INSTALL_DEVICE: blkDevice,
                CONFIG_HOSTNAME: detail.device.id,
                CONFIG_WG_DEVICE_ADDR: wireGuardSettings.address,
                CONFIG_WG_DEVICE_MASK: wireGuardSettings.cidr,
                CONFIG_WG_SERVER_PUBLIC_KEY: wireGuardSettings.server.publicKey,
                CONFIG_WG_SERVER_HOST: wireGuardSettings.server.host,
                CONFIG_WG_SERVER_PORT: wireGuardSettings.server.port,
                ...wifi ? {
                    CONFIG_WIFI_SSID: base64(wifi.ssid),
                    CONFIG_WIFI_PASSWORD: base64(wifi.password)
                } : {},
                ...sshPubKeysFile ? {
                    CONFIG_SSH_AUTHORIZED_KEYS: base64(await fs.readFile(sshPubKeysFile))
                } : {}
            };

            let pullCommand = [
                `docker`, `pull`, detail.device.board.installer
            ]

            let runCommand = [
                `docker`, `run`,
                `--rm`,
                `--volume=/dev:/build/host/dev`,
                `--volume=/tmp/${deviceId}:/build/output`,
                ...rootOverlayDir ? [
                    `--volume=${rootOverlayDir}:/build/custom-root`
                ] : [],
                ...dtoDir ? [
                    `--volume=${dtoDir}:/build/custom-dto`
                ] : [],
                ...Object.entries(environment)
                    .map(([k, v]) => `--env=${k}=${v}`),
                `--privileged`,
                detail.device.board.installer
            ];


            if (dryRun) {

                log(pullCommand.join(" "));
                log(runCommand.join(" "));

            } else {

                await exec(pullCommand.shift(), pullCommand);
                await exec(runCommand.shift(), runCommand);
                let wireGuardUpdate = JSON.parse(await fs.readFile(`/tmp/${deviceId}/wg.json`));
                await portal.setWireGuardKeys({
                    deviceId,
                    publicKey: wireGuardUpdate.publicKey,
                    presharedKey: wireGuardUpdate.presharedKey
                });

            }

        } finally {
            api.close();
        }
    }

    function parseWifi(str) {
        let match = /(?<ssid>[^:]*):(?<password>.*)/.exec(str);
        if (!match) {
            throw new Error("Error parsing WiFi parameters.");
        }
        return match.groups;
    }

    return {
        name: "assign [<board-id>] [<device-id>]",
        description: "assigns a board to the device",
        define(program) {
            program.on("--help", () => {
                console.info();
                console.info("Run without arguments to get list of available boards.");
            });

        },

        async run(boardId, deviceId) {

            let api = await createApi();
            try {

                let { portal } = api;

                if (!boardId || !deviceId) {
                    
                    console.info("Available boards:");
                    
                    let boards = (await portal.getBoards()).sort((a, b) =>
                        (b.featured - a.featured) ||
                        (a.maker < b.maker ? -1 : 1) ||
                        (a.name > b.name ? 1 : -1)
                    );

                    let maxLen = boards.reduce((acc, b) => b.name.length > acc ? b.name.length : acc, 0);
                    for (let board of boards) {
                        console.info(`${board.name} ${new Array(maxLen - board.name.length).fill(" ").join("")} ${board.id}`);
                    }
                
                } else {
                    await portal.assignBoard({boardId, deviceId});
                }

            } finally {
                api.close();
            }

        }
    }
}