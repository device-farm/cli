module.exports = async config => {

    return {
        name: "logout",
        description: "logout from DEVICE.FARM portal",
        define(program) {
        },
        async run(token) {
            delete config.user.auth;
            await config.user.save();
            console.info("Authentication data removed.");
        }
    }
}