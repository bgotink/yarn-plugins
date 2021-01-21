# Yarn plugin super-delux

This is a proof of concept for a command not unlike `yarn dlx` that creates standalone self-unpacking scripts.

## What's the use case?

To give an example use case: at work I maintain a Jenkins pipeline library. I do not maintain the Docker containers the pipeline runs in, nor do I maintain all of the repositories that use the pipeline.

Currently I'm using `yarn dlx tap-junit@4.1` to process TAP input and create a JUnix XML file with the test results, a file format that Jenkins understands.
However, that approach has some significant downsides:

- It requires a connection to the npm registry, as the pipeline runs on a Docker container without global cache
- This command doesn't support lockfiles, so things might go boom if a (transitive) dependency accidentally breaks something
- This command is even brittle with respect to yarn itself: what if yarn 3 comes out and it changes the `dlx` command?

Now I can run `yarn sdlx create-yar --package tap-junit@4.1 --output tap-junit.sh tap-junit` and voilà, I've got a `tap-junit.sh` self-unpacking script that installs and execute the `tap-junit` package and runs the `tap-junit` command.
By default this doesn't include the cache, but for the example usecase above I would add `--include-cache`, which makes the command include the cache in the output script.

## What does this require?

The script requires only two things to run:

- BASH
- Node.js

## How does this work?

The shell script contains two parts:

```bash
#!/usr/bin/env bash

Part 1

### DATA ###
Part 2
```

Part 2 is a base64'd zipfile. This doesn't have to be base64'd, that's done purely to make it possible to open this file in an editor and inspect it.

Part 1 is an inline node script that reads the script file itself and unzips everything after the `### DATA ###` block into a temporary folder. That folder is then installed via the included `yarn` binary and the requested command (in the example above that'd be `tap-junit`) is then executed.

## Status

This is a proof of concept. Don't use this in production code.
