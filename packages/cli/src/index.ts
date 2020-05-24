#!/usr/bin/env node

// ue4 login
// ue4 whoami
// ue4 --version
// ue4 vault
// ue4 add # add asset to project
// ue4 config

import { program } from "commander";

import { login } from "./login";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json");

program
  .command("login [email]")
  .description("Login to your epicgames.com account")
  .action(login)
  .version(pkg.version);

program.parse(process.argv);
