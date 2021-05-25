const { spawn } = require("child_process");
const fs = require("fs").promises;

module.exports = async ({ api: createApi }) => {

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

    function base64(str) {
        return Buffer.from(str).toString("base64");
    }

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

            let wireguardSettings = await portal.getWireguardSettings({ deviceId });

            let environment = {
                INSTALL_DEVICE: blkDevice,
                CONFIG_HOSTNAME: detail.device.id,
                CONFIG_WG_DEVICE_ADDR: wireguardSettings.address,
                CONFIG_WG_DEVICE_MASK: wireguardSettings.cidr,
                CONFIG_WG_SERVER_PUBLIC_KEY: wireguardSettings.server.publicKey,
                CONFIG_WG_SERVER_HOST: wireguardSettings.server.host,
                CONFIG_WG_SERVER_PORT: wireguardSettings.server.port,               
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
                let wireguardUpdate = JSON.parse(await fs.readFile(`/tmp/${deviceId}/wg.json`));
                await portal.setWireguardKeys({
                    deviceId,
                    publicKey: wireguardUpdate.publicKey,
                    presharedKey: wireguardUpdate.presharedKey
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
        name: "install <device-id> <blk-device>",
        description: "installs DEVICE.FARM Linux on given block device",
        define(program) {
            program
                .option("-D, --dry", "dry run - show docker command line only")
                .option("-w, --wifi <ssid:password>", "pre-configures WiFi connection")
                .option("-s, --ssh <pub-key-file>", "installs public SSH key for user root\nuse - as shorthand for ~/.ssh/id_rsa.pub")
                .option("-r, --root <overlay-dir>", "root overlay directory")
                .option("-t, --dto <dto-dir>", "device tree overlay directory")
                .on("--help", () => {
                    console.info();
                    console.info("<blk-device> is SD card block device under /dev e.g. /dev/mmcblk0");
                });
        },

        async run(deviceId, blkDevice, { wifi, ssh, root, dto, dry }) {

            await install(deviceId, blkDevice, {
                wifi: wifi && parseWifi(wifi),
                sshPubKeysFile: ssh && (ssh === "-" ? `${process.env.HOME}/.ssh/id_rsa.pub` : ssh),
                rootOverlayDir: root,
                dtoDir: dto
            }, async line => {
                console.info(line);
            }, dry);

            console.info("Done.");

        }
    }
}