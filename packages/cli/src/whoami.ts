import { LocalSession } from "./local-session";

export async function whoami(): Promise<void> {
  // check the config if we have a session
  const session = new LocalSession();

  if (await session.loggedIn()) {
    const accountDetails = {
      email: session.auth!.getEmail(),
      displayName: session.auth!.sessionDetails?.displayName,
      accountId: session.auth!.sessionDetails?.account_id,
    };

    console.log(accountDetails);
  } else {
    console.log("You're not logged in. Please run 'ue4 login'");
  }
}