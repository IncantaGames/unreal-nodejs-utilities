import { AuthSession } from "@node-ue4/auth";
import {
  IDownloadDetails,
  GetItemBuildInfo,
  GetItemManifest,
  BuildItemChunkListFromManifest,
  DownloadItemChunkList,
  ExtractAssetFilesFromChunks
} from "@node-ue4/epic-api";

export async function downloadAsset(session: AuthSession, downloadDir: string, details: IDownloadDetails): Promise<void> {
  if (!session.sessionDetails) {
    throw new Error("You haven't logged in yet? Shouldn't be possible");
  }

  const buildInfo = await GetItemBuildInfo(session.transport, session.sessionDetails, details);
  const manifest = await GetItemManifest(session.transport, buildInfo);
  const chunkList = BuildItemChunkListFromManifest(buildInfo, manifest);
  const chunkDir = await DownloadItemChunkList(session.transport, manifest, chunkList, downloadDir);
  await ExtractAssetFilesFromChunks(manifest, chunkDir);

  // BuildItemChunkListFromManifest(buildInfo, manifest);
  // // const chunkDir = await DownloadItemChunkList(this.transport, manifest, chunkList, downloadDir);
  // await ExtractAssetFilesFromChunks(manifest, path.join(downloadDir, "Stylized5e206b0811e4V1", "chunks"));
}
