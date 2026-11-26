## ADDED Requirements

### Requirement: Watch output has no clear-screen sequences

A `watch` SHALL remove these ANSI escape sequences from every line a watch process writes, before the line is prefixed, so they appear neither in `.cache/variant/watch.log` nor on the standard output or standard error of an attached `watch`, in any output mode: erase in display (ESC `[`, optional digits and semicolons, `J`, such as `J`, `0J`, `1J`, `2J` and `3J`), cursor home (ESC `[`, optional digits and semicolons, `H`, such as `H`, `;H` and `1;1H`), and full terminal reset (ESC `c`). The remaining text of that line SHALL be written unchanged. Every other escape sequence, including ANSI color, SHALL be left as the process wrote it. A line that is empty only because these sequences were removed SHALL NOT be written to the log or to a console stream; a line the process wrote empty SHALL still be written. A `tty` line that held an ANSI escape only in a removed sequence SHALL NOT get the reset sequence ESC `[0m` appended. A detached `watch` SHALL strip the same way. The process itself SHALL still receive its terminal unchanged.

#### Scenario: A terminal clears the screen before a message

- **WHEN** attached `watch` runs a command with `output.mode: tty` that writes ESC `[2J` ESC `[3J` ESC `[H` directly followed by `rebuilt` and a newline
- **THEN** standard output and `.cache/variant/watch.log` contain `[fe] rebuilt`
- **AND** neither contains ESC `[2J`, ESC `[3J` or ESC `[H`
- **AND** the line has no appended reset sequence

#### Scenario: Color survives the strip

- **WHEN** a `tty` watch writes ESC `[2J`, then an ANSI green `ready` line
- **THEN** the log line contains the green sequence and `ready` followed by the reset sequence, and no ESC `[2J`

#### Scenario: A pipe watch clears too

- **WHEN** a watch with `output.mode: no-tty` writes ESC `c` followed by `plain` and a newline
- **THEN** standard output and `.cache/variant/watch.log` contain `[fe] plain` and no ESC `c`

#### Scenario: A line of only clear codes is dropped

- **WHEN** a watch writes a line that holds only ESC `[H` ESC `[2J`, then a line `next`
- **THEN** the log and standard output contain `[fe] next` and no line `[fe] ` before it

#### Scenario: An empty line stays

- **WHEN** a watch writes `a`, an empty line, then `b`
- **THEN** the log contains `[fe] a`, `[fe] ` and `[fe] b` in that order

#### Scenario: Other sequences stay

- **WHEN** a watch writes ESC `[2K` followed by `line`
- **THEN** the log line is `[fe] ` followed by ESC `[2K` and `line`

#### Scenario: Detached watch strips too

- **WHEN** `watch --detach` runs a `tty` command that writes ESC `[2J` ESC `[H` and `detached`
- **THEN** `.cache/variant/watch.log` contains `[fe] detached` and no ESC `[2J` or ESC `[H`
