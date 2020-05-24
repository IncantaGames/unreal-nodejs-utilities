import axios, { AxiosInstance } from "axios";
import axiosCookieJarSupport from "axios-cookiejar-support";
import tough from "tough-cookie";

import { User } from "./user";
import {
  InitializeSessionCookies,
  Login,
  SendMFA,
  GetOauth,
  IEpicOauthResponse,
  IEpicAssetDetail,
  LoginStatus
} from "@node-ue4/epic-api";

export class AuthSession {
  private user: User;
  public transport: AxiosInstance;
  public sessionDetails: IEpicOauthResponse | null;
  public assets: IEpicAssetDetail[];

  constructor(user: User) {
    this.sessionDetails = null;
    this.assets = [];
    this.user = user;
    this.transport = axios.create({
      withCredentials: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher/10.13.1-11497744+++Portal+Release-Live UnrealEngine/4.23.0-11497744+++Portal+Release-Live Chrome/59.0.3071.15 Safari/537.36",
      },
      validateStatus: () => true
    });
    axiosCookieJarSupport(this.transport);
    this.transport.defaults.jar = new tough.CookieJar();
  }

  public async initialize(): Promise<void> {
    await InitializeSessionCookies(this.transport);
  }

  public updateCredentials(email: string, password: string): void {
    this.user.email = email;
    this.user.password = password;
  }

  public async login(): Promise<LoginStatus> {
    return await Login(this.transport, this.user.email, this.user.password);
  }

  public async sendMFA(method: "email" | "authenticator", code: string): Promise<LoginStatus> {
    return await SendMFA(this.transport, method, code);
  }

  public async initializeOauth(): Promise<void> {
    this.sessionDetails = await GetOauth(this.transport);
  }
}
