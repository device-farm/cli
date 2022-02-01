#!/usr/bin/env node

const { Command } = require('commander');

require("@device.farm/appglue")({ require, file: __dirname + "/../config.json" }).main(async config => {

    let package = require(__dirname + "/../package.json");

    let program = new Command("defa");

    program
        .version(package.version, '-v, --version', 'output the current version')
        .description(package.description)
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
                process.exitCode = process.exitCode || 1;
            } finally {
                process.exit();
            }
        });
    });


    program.parse(process.argv);

});