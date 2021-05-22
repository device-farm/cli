module.exports = async ({ user }) => {

    return {
        name: "login <api-key>",
        description: "login to DEVICE.FARM portal",
        define(program) {
        },
        async run(apiKey) {
            user.apiKey = apiKey;
            await user.save();
            console.info("Authentication data saved.");
        }
    }
}