import configstore from "configstore";
import prompts from "prompts";
import { AuthSession, User } from "@node-ue4/auth";
import { LoginStatus, IEpicAssetDetail } from "@node-ue4/epic-api";
import { getVaultInfo, downloadAsset } from "@node-ue4/marketplace";
import { EventEmitter } from "events";
import CliProgress, { SingleBar } from "cli-progress";

export class LocalSession {
  public config: configstore;
  public auth: AuthSession | null;

  constructor() {
    this.config = new configstore("node-ue4");

    // reusing `this.refresh()` here complains that `session`
    // isnt initialized in the constructor 🤦‍♂
    const sessionDetails = this.config.get("session");
    if (sessionDetails) {
      const user = new User(this.config.get("email"));
      this.auth = new AuthSession(user, sessionDetails);
    } else {
      this.auth = null;
    }
  }

  public refresh(): void {
    const sessionDetails = this.config.get("session");
    if (sessionDetails) {
      const user = new User(this.config.get("email"));
      this.auth = new AuthSession(user, sessionDetails);
    } else {
      this.auth = null;
    }
  }

  public async loggedIn(): Promise<boolean> {
    if (this.auth === null || this.auth.sessionDetails === null) {
      return false;
    }

    // todo: add refresh logic
    return true;
  }

  public async login(email: string, password: string): Promise<void> {
    const user = new User(email, password);
    this.auth = new AuthSession(user);

    const { captcha } = await prompts({
      type: "text",
      name: "captcha",
      message: "Please solve the captcha at https://funcaptcha.com/fc/api/nojs/?pkey=37D033EB-6489-3763-2AE1-A228C04103F5 and paste the solution here:",
    });

    await this.auth.initialize();
    let status = await this.auth.login(captcha);

    let method: "email" | "authenticator" | null = null;
    while (status === LoginStatus.NeedsMFA) {
      if (method === null) {
        const response = await prompts({
          type: "select",
          name: "method",
          message: "Your account requires 2FA; which method of 2FA do you use?",
          choices: [
            { title: "Email", value: "email" },
            { title: "Authenticator Application", value: "authenticator" },
          ]
        });
        method = response.method as "email" | "authenticator";
      } else {
        console.log("That 2FA response was invalid, please try again");
      }

      const { code } = await prompts({
        type: "text",
        name: "code",
        message: method === "email" ?
          "Enter the code sent to your email"
          : "Enter the code from your authenticator application",
      });

      status = await this.auth.sendMFA(method, code);
    }

    if (status === LoginStatus.Error) {
      throw new Error("We couldn't log you in for some reason");
    }

    await this.auth.initializeOauth();

    this.config.set("email", email);
    this.config.set("session", this.auth.sessionDetails);
    console.log("Successfully logged in");
  }

  public async getVaultAssets(): Promise<IEpicAssetDetail[]> {
    if (!this.loggedIn()) {
      throw new Error("You're currently not logged in");
    }

    const assets = await getVaultInfo(this.auth!);
    return assets;
  }

  public async downloadAsset(assetId: string, versionId: string): Promise<void> {
    if (!this.loggedIn()) {
      throw new Error("You're currently not logged in");
    }

    const progressEmitter = new EventEmitter();

    let bar: SingleBar;

    progressEmitter.on("start", (e) => {
      console.log(`Starting ${e.name}`);
      bar = new SingleBar({}, CliProgress.Presets.shades_classic);
      bar.start(e.total, 0);
    });

    progressEmitter.on("end", (e) => {
      console.log(`Finished ${e.name}`);
      bar.stop();
    });

    progressEmitter.on("progress", (e) => {
      bar.update(e.finished);
    });

    await downloadAsset(
      this.auth!,
      "./download",
      {
        assetId,
        versionId,
      },
      progressEmitter
    );
  }
}
