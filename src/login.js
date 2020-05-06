module.exports = async config => {

    return {
        name: "login <api-token>",
        description: "login to DEVICE.FARM portal",
        define(program) {
        },
        async run(token) {
            config.user.auth = { token };
            await config.user.save();
            console.info("Authentication data saved.");
        }
    }
}