import { AxiosInstance, AxiosResponse } from "axios";
import { CookieJar, Cookie } from "tough-cookie";
import { IEpicOauthResponse } from "./epic-oauth-response";

export enum LoginStatus {
  LoggedIn,
  NeedsMFA,
  Error
}

export async function Login(transport: AxiosInstance, email: string, password: string): Promise<LoginStatus> {
  // grab a XSRF cookie
  await transport.get("https://www.epicgames.com/id/api/csrf", {
    headers: {
      Referrer: "https://www.epicgames.com/id/login",
      "X-Epic-Event-Action": "login",
      "X-Epic-Event-Category": "login",
      "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
      "X-Requested-With": "XMLHttpRequest",
    }
  });

  const jar = (transport.defaults as any).jar as CookieJar;

  const xsrfCookie = jar.serializeSync().cookies.filter(cookie => cookie.key === "XSRF-TOKEN")[0];

  if (!xsrfCookie) {
    throw new Error("Could not get the XSRF token?");
  }

  const loginResult = await transport.post("https://www.epicgames.com/id/api/login",
    {
      "email": email,
      "password": password,
      "rememberMe": true,
      "captcha": "",
    },
    {
      headers: {
        Referrer: "https://www.epicgames.com/id/login",
        "Content-Type": "application/json;charset=UTF-8",
        "X-Epic-Event-Action": "login",
        "X-Epic-Event-Category": "login",
        "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
        "X-Requested-With": "XMLHttpRequest",
        "X-XSRF-TOKEN": xsrfCookie.value
      }
    }
  );

  if (loginResult.status === 431) {
    return LoginStatus.NeedsMFA;
  } else if (loginResult.status === 200) {
    return LoginStatus.LoggedIn;
  } else {
    return LoginStatus.Error;
  }
}

export async function SendMFA(transport: AxiosInstance, method: string, code: string): Promise<LoginStatus> {
  let mfaResult: AxiosResponse<any> | undefined;
  do {
    if (typeof mfaResult !== "undefined") {
      console.log("That 2FA response didn't work. Please try again.");
    } else {
      console.log("Your account requires 2FA. Please check your email or authenticator app for a code and enter the details below.");
    }

    const jar = (transport.defaults as any).jar as CookieJar;
  
    let xsrfCookie: Cookie.Serialized | undefined;
    xsrfCookie = jar.serializeSync().cookies.filter(cookie => cookie.key === "XSRF-TOKEN")[0];
  
    if (!xsrfCookie) {
      throw new Error("Could not get the XSRF token?");
    }

    // grab a new XSRF cookie
    await transport.get("https://www.epicgames.com/id/api/csrf", {
      headers: {
        Referrer: "https://www.epicgames.com/id/login",
        "X-Epic-Event-Action": "login",
        "X-Epic-Event-Category": "login",
        "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
        "X-Requested-With": "XMLHttpRequest",
        "X-XSRF-TOKEN": xsrfCookie.value
      }
    });

    xsrfCookie = jar.serializeSync().cookies.filter(cookie => cookie.key === "XSRF-TOKEN")[0];

    if (!xsrfCookie) {
      throw new Error("Could not get the XSRF token?");
    }

    mfaResult = await transport.post("https://www.epicgames.com/id/api/login/mfa",
      {
        "method": method,
        "code": code,
        "rememberDevice": true,
      },
      {
        headers: {
          Referrer: "https://www.epicgames.com/id/login/mfa",
          "Content-Type": "application/json;charset=UTF-8",
          "X-Epic-Event-Action": "mfa",
          "X-Epic-Event-Category": "login",
          "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
          "X-Requested-With": "XMLHttpRequest",
          "X-XSRF-TOKEN": xsrfCookie.value
        }
      }
    );
  } while (mfaResult === undefined || mfaResult.status === 400 || mfaResult.status === 409);

  if (mfaResult.status === 200) {
    return LoginStatus.LoggedIn;
  } else {
    return LoginStatus.Error;
  }
}

export async function GetOauth(transport: AxiosInstance): Promise<IEpicOauthResponse> {
  const jar = (transport.defaults as any).jar as CookieJar;

  const xsrfCookie = jar.serializeSync().cookies.filter(cookie => cookie.key === "XSRF-TOKEN")[0];

  if (!xsrfCookie) {
    throw new Error("Could not get the XSRF token?");
  }

  const redirectResult = await transport.get("https://www.epicgames.com/id/api/redirect?", {
    headers: {
      Referrer: "https://www.epicgames.com/id/login",
      "X-Epic-Event-Action": "login",
      "X-Epic-Event-Category": "login",
      "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": xsrfCookie.value
    }
  });

  if (redirectResult.status !== 200) {
    throw new Error(`Could not get an SID from the /id/api/redirect request.`);
  }

  const sid: string = redirectResult.data.sid;

  // this sets our session on unrealengine.com with the epicgames.com sid and xsrf token
  await transport.get(`https://www.unrealengine.com/id/api/set-sid?sid=${sid}`, {
    headers: {
      Origin: "https://www.epicgames.com",
      "X-Epic-Event-Action": "login",
      "X-Epic-Event-Category": "login",
      "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": xsrfCookie.value
    }
  });

  await transport.get(`https://www.epicgames.com/id/api/authenticate`, {
    headers: {
      Referrer: "https://www.epicgames.com/id/login/welcome",
      "X-Epic-Event-Action": "login",
      "X-Epic-Event-Category": "login",
      "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": xsrfCookie.value
    }
  });

  const exchangeResult = await transport.get(`https://www.epicgames.com/id/api/exchange`, {
    headers: {
      Referrer: "https://www.epicgames.com/id/login/welcome",
      "X-Epic-Event-Action": "login",
      "X-Epic-Event-Category": "login",
      "X-Epic-Strategy-Flags": "guardianEmailVerifyEnabled=true;guardianEmbeddedDocusignEnabled=true;guardianKwsFlowEnabled=false;minorPreRegisterEnabled=false;registerEmailPreVerifyEnabled=false",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": xsrfCookie.value
    }
  });

  if (exchangeResult.status !== 200) {
    throw new Error(`Could not get a code from the /id/api/exchange request.`);
  }

  const exchangeCode: string = exchangeResult.data.code;

  const oauthResult = await transport.post(`https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token`,
    `grant_type=exchange_code&exchange_code=${exchangeCode}&token_type=eg1`,
    {
      headers: {
        Authorization: "basic MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=",
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  if (oauthResult.status !== 200) {
    throw new Error("Could not get oauth token");
  }

  // oauth token expires in 28800 seconds at the time of writing this, which is 8 hours
  // we wont bother with any refresh logic due to this long period and reauth every time we run

  return oauthResult.data as IEpicOauthResponse;
}
