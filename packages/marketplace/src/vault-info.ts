import { AuthSession } from "@node-ue4/auth";
import { GetOwnedAssets, IEpicAssetDetail } from "@node-ue4/epic-api";

export async function getVaultInfo(session: AuthSession): Promise<IEpicAssetDetail[]> {
  if (!session.sessionDetails) {
    throw new Error("The session provided isn't authenticated");
  }

  return await GetOwnedAssets(session.transport, session.sessionDetails);
}
