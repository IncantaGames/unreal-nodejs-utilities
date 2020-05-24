export class User {
  public email: string;
  public password: string | null;

  constructor(email: string, password?: string) {
    this.email = email;
    this.password = password || null;
  }
}
