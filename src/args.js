const { Command } = require('commander');

module.exports = config => {
    
    let program = new Command("defa");

    program.version(require(__dirname + "/../package.json").version, '-v, --version', 'output the current version');

    program.parse(process.argv);

    return program; 
}