const { Command } = require('commander');

require("@device.farm/appglue")({ require, file: __dirname + "/../config.json" }).main(async config => {

    let program = new Command("defa");

    program
        .version(require(__dirname + "/../package.json").version, '-v, --version', 'output the current version')
        .description("DEVICE.FARM command line utility")
        .option("-d, --debug", "display debug information");

    config.commands.forEach(command => {
        let subProgram = program
            .command(command.name)
            .description(command.description);

        command.define(subProgram);
        subProgram.action(async (...args) => {
            try {
                await command.run(...args);
            } catch (e) {
                console.error("Error:", program.debug ? e : e.message || e);
            }
        });
    });
    program.parse(process.argv);

});