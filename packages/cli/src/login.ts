import prompts from "prompts";
// import { Launcher } from "epicgames-client";

import { LocalSession } from "./local-session";

function isEmail(value: string): boolean {
  return new RegExp(/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/).test(value);
}

export async function login(email?: string): Promise<void> {
  // check the config if we have a session
  const session = new LocalSession();

  if (await session.loggedIn()) {
    const response = await prompts({
      type: "confirm",
      name: "continue",
      message: `You're already logged in with email ${session.auth!.getEmail()}; are you sure you want to continue?`,
    });

    if (response.continue !== true) {
      return;
    }
  }

  if (!email) {
    const response = await prompts({
      type: "text",
      name: "email",
      message: "EpicGames.com Email:",
      validate: value => isEmail(value) ? true : "Enter a valid email address"
    });

    email = response.email as string;
  }

  const { password } = await prompts({
    type: "password",
    name: "password",
    message: "Password:"
  }) as { password: string };

  await session.login(email, password);
  // const launcher = new Launcher({
  //   email,
  //   password,
  // });

  // await launcher.init();
  // await launcher.login({
  //   captcha: async (reputation: any, captchaData: any, meta: any) => {
  //     return captchaData.token;
  //   }
  // });
  // console.log(launcher.account);
}