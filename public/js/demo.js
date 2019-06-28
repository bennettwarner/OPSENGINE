$(function () {
    var term = new Terminal();
    term.open(document.getElementById('terminal'));

    function runFakeTerminal() {
        if (term._initialized) {
            return;
        }

        term._initialized = true;

        term.prompt = () => {
            term.write('\r\n$ ');
        };

        term.writeln(".d8888b. 8888888b.8888888888    d8P 8888888888")
        term.writeln("d88P  Y88b888   Y88b 888  888   d8P  888"       )
        term.writeln("Y88b.     888    888 888  888  d8P   888"       )
        term.writeln("  Y888b.  888   d88P 888  888d88K    8888888"   )
        term.writeln("    'Y88b.8888888P'  888  8888888b   888"       )
        term.writeln("      '888888        888  888  Y88b  888"       )
        term.writeln("Y88b  d88P888        888  888   Y88b 888"       )
        term.writeln(" 'Y8888P' 888      8888888888    Y88b8888888888")
        term.writeln('');
        term.writeln('DEVICE 001');
        term.writeln('Don\'t break it!');
        term.writeln('');
        term.prompt();

        term.on('key', function(key, ev) {
            const printable = !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey;

            if (ev.keyCode === 13) {
                term.prompt();
            } else if (ev.keyCode === 8) {
                // Do not delete the prompt
                if (term._core.buffer.x > 2) {
                    term.write('\b \b');
                }
            } else if (printable) {
                term.write(key);
            }
        });

        term.on('paste', function(data) {
            term.write(data);
        });
    }
    runFakeTerminal();
});