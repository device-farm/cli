module.exports = async ({ user }) => {

    return {
        name: "logout",
        description: "logout from DEVICE.FARM portal",
        define(program) {
        },
        async run(token) {
            delete user.auth;
            await user.save();
            console.info("API key removed.");
        }
    }
}