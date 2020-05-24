import prompts from "prompts";
import { LocalSession } from "./local-session";

export async function vault(): Promise<void> {
  // check the config if we have a session
  const session = new LocalSession();

  if (await session.loggedIn()) {
    const assets = await session.getVaultAssets();
    const { assetId } = await prompts({
      type: "select",
      name: "assetId",
      message: "Select an asset",
      choices: assets.map(asset => {
        return {
          title: asset.title,
          value: asset.id,
        };
      })
    });

    const asset = assets.find(a => {
      return a.id === assetId;
    })!;

    const { versionId } = await prompts({
      type: "select",
      name: "versionId",
      message: `Select a version for ${asset.title}`,
      choices: asset.releaseInfo.map(release => {
        return {
          title: release.appId,
          value: release.id,
        };
      })
    });

    const release = asset.releaseInfo.find(r => {
      return r.id === versionId;
    })!;

    const { downloadAsset } = await prompts({
      type: "confirm",
      name: "downloadAsset",
      message: `Are you sure you want to download '${asset.title}', ${release.appId}?`,
      initial: true
    });

    if (downloadAsset) {
      await session.downloadAsset(assetId, versionId);
    }
  } else {
    console.log("You're not logged in. Please run 'ue4 login'");
  }
}