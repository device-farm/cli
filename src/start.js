require("@device.farm/appglue")({require, file: __dirname + "/../config.json"}).main(async config => {
    console.info(JSON.stringify(config, null, 2));
});