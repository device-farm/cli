
module.exports = async ({ user }) => {

    return {
        name: "install <device-id> <blk-device>",
        description: "installs DEVICE.FARM Linux on given block device",
        define(program) {
            program
                .option("-w, --wifi <ssid:password>", "pre-configures WiFi connection")
                .option("-s, --ssh <pub-key-file>", "installs public SSH key for user root\nuse - as shorthand for ~/.ssh/id_rsa.pub")
                .option("-r, --root <overlay-dir>", "root overlay directory")
                .option("-t, --dto <dto-dir>", "device tree overlay directory")
                .on("--help", () => {
                    console.info();
                    console.info("<blk-device> is SD card block device under /dev e.g. /dev/mmcblk0");
                });
        },

        async run(deviceId, blkDevice, { wifi, ssh, root, dto }) {

            let apiKey = user.getApiKey();
            
            console.info(apiKey);
            console.info(deviceId, blkDevice, wifi, ssh, root, dto);
        }
    }
}