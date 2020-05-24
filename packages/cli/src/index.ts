#!/usr/bin/env node

// ue4 add # add asset to project
// ue4 config

import { program } from "commander";

import { login } from "./login";
import { whoami } from "./whoami";
import { vault } from "./vault";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json");

program
  .command("login [email]")
  .description("Login to your epicgames.com account")
  .action(login);

program
  .command("whoami")
  .description("Get information about the authenticated account")
  .action(whoami);

program
  .command("vault")
  .description("Access your unrealengine.com Marketplace vault")
  .action(vault);

program.version(pkg.version);

program.parse(process.argv);
