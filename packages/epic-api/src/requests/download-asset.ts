import { AxiosInstance } from "axios";
import rimraf from "rimraf";
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import zlib from "zlib";

import { IEpicOauthResponse } from "./epic-oauth-response";
import { ChunkHashToReverseHexEncoding, padLeft } from "./utils";

export interface IAssetVersionBuildInfo {
  appName: string;
  labelName: string;
  buildVersion: string;
  catalogItemId: string;
  expires: string;
  items: {
    MANIFEST: {
      signature: string;
      distribution: string;
      path: string;
      hash: string;
      additionalDistributions: string[];
    };
    CHUNKS: {
      signature: string;
      distribution: string;
      path: string;
      additionalDistributions: string[];
    };
  }
  assetId: string;
}

export interface IAssetVersionManifest {
  ManifestFileVersion: string;
  bIsFileData: boolean;
  AppID: string;
  AppNameString: string;
  BuildVersionString: string;
  LaunchExeString: string;
  LaunchCommand: string;
  PrereqIds: string[];
  PrereqName: string;
  PrereqPath: string;
  PrereqArgs: string;
  FileManifestList: Array<{
    Filename: string;
    FileHash: string;
    FileChunkParts: Array<{
      Guid: string;
      Offset: string;
      Size: string;
    }>;
  }>;
  ChunkHashList: { [Guid: string]: string; };
  ChunkShaList: { [Guid: string]: string; };
  DataGroupList: { [Guid: string]: string; };
  ChunkFilesizeList: { [Guid: string]: string; };
  CustomFields: any;
}

export interface IAssetChunk {
  guid: string;
  hash: string;
  url: string;
  filename: string;
}

export interface IDownloadDetails {
  assetId: string;
  versionId: string;
}

export async function GetItemBuildInfo(
  transport: AxiosInstance,
  sessionDetails: IEpicOauthResponse,
  details: IDownloadDetails
): Promise<IAssetVersionBuildInfo> {
  const buildInfoResponse = await transport.get(`https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/Windows/${details.assetId}/${details.versionId}?label=Live`, {
    headers: {
      Authorization: `${sessionDetails.token_type} ${sessionDetails.access_token}`
    }
  });

  if (buildInfoResponse.status !== 200) {
    throw new Error("Couldn't get the build info for asset");
  }

  const buildInfo = buildInfoResponse.data as IAssetVersionBuildInfo;

  return buildInfo;
}

export async function GetItemManifest(
  transport: AxiosInstance,
  buildInfo: IAssetVersionBuildInfo
): Promise<IAssetVersionManifest> {
  const url = `${
    buildInfo.items.MANIFEST.distribution
  }${
    buildInfo.items.MANIFEST.path
  }?${
    buildInfo.items.MANIFEST.signature
  }`;

  const manifestResponse = await transport.get(url);

  if (manifestResponse.status !== 200) {
    throw new Error("Couldn't get the manifest for asset");
  }

  const manifest = manifestResponse.data as IAssetVersionManifest;

  return manifest;
}

export function BuildItemChunkListFromManifest(
  buildInfo: IAssetVersionBuildInfo,
  manifest: IAssetVersionManifest
): IAssetChunk[] {
  // Build chunk URL list
  const chunks = [];

  //Ref: https://download.epicgames.com/Builds/Rocket/Automated/MagicEffects411/CloudDir/ChunksV3/22/AAC7EF867364B218_CE3BE4D54E7B4ECE663C8EAC2D8929D6.chunk
  const chunkPath = buildInfo.items.CHUNKS.path;
  const chunkBaseURL = buildInfo.items.CHUNKS.distribution + chunkPath.substring(0, chunkPath.lastIndexOf("/")) + "/ChunksV3/";

  for (const chunk in manifest.ChunkHashList) {
    const hash = ChunkHashToReverseHexEncoding(manifest.ChunkHashList[chunk]);
    const group = padLeft(parseInt(manifest.DataGroupList[chunk]), 2);
    const filename = `${chunk}.chunk`;
    chunks.push({
      guid: chunk,
      hash,
      url: `${chunkBaseURL}${group}/${hash}_${chunk}.chunk`,
      filename
    });
  }

  return chunks;
}

// cb is in format (finished, chunkDir)
export async function DownloadItemChunkList(
  transport: AxiosInstance,
  manifest: IAssetVersionManifest,
  chunkList: IAssetChunk[],
  downloadDirBase: string,
  progressEmitter?: EventEmitter
): Promise<string> {
  const downloadDir = path.resolve(path.join(downloadDirBase, manifest.AppNameString, "chunks"));
  if (fs.existsSync(downloadDir)) {
    rimraf.sync(downloadDir); // Purge chunk folder
  }
  await fs.promises.mkdir(downloadDir, { recursive: true });

  const chunksToDownloadSimultaneously = 5;

  let chunksLeft = chunkList.length;

  console.log(`Downloading asset ${manifest.AppNameString}`);

  if (progressEmitter) {
    progressEmitter.emit("start", {
      name: "download",
      total: chunkList.length,
    });
  }
  while (chunksLeft > 0) {
    const startIdx = chunkList.length - chunksLeft;
    const endIdx = Math.min(startIdx + chunksToDownloadSimultaneously, chunkList.length);

    const chunksToDownload = chunkList.slice(startIdx, endIdx);

    await Promise.all(chunksToDownload.map(async chunk => {
      await download(transport, chunk.url, { directory: downloadDir, filename: chunk.filename, timeout: 50000 });
    }));

    chunksLeft -= chunksToDownload.length;

    if (progressEmitter) {
      progressEmitter.emit("progress", {
        finished: chunkList.length - chunksLeft,
        total: chunkList.length,
      });
    }
  }
  if (progressEmitter) {
    progressEmitter.emit("end", {
      name: "download",
    });
  }

  return downloadDir;
}

async function download(transport: AxiosInstance, file: string, options: any = {}) {
  if (!file) throw ("Need a file url to download");

  options.timeout = options.timeout || 20000;
  options.directory = options.directory || ".";
  options.retries = options.retries || 3;

  const uri = file.split(path.sep);
  options.filename = options.filename || uri[uri.length - 1];

  const filePath = path.join(options.directory, options.filename);

  await fs.promises.mkdir(options.directory, { recursive: true });

  let retries = 0;
  let downloaded = false;
  while (retries < options.retries && !downloaded) {
    try {
      const response = await transport.get(file, {
        timeout: options.timeout
      });

      if (response.status === 200) {
        await fs.promises.writeFile(filePath, response.data);
      } else {
        throw new Error(`Could not download file, code ${response.status}, error: ${response.data}`);
      }

      downloaded = true;
    } catch (e) {
      retries++;
    }
  }
}

export async function ExtractAssetFilesFromChunks(manifest: IAssetVersionManifest, chunkDir: string, progressEmitter?: EventEmitter): Promise<void> {
  const extractDir = path.resolve(path.join(chunkDir, "..", "extracted"));
  if (fs.existsSync(extractDir)) {
    rimraf.sync(extractDir); // Purge chunk folder
  }
  await fs.promises.mkdir(extractDir, { recursive: true });

  // Get renamed list of files
  const chunkFiles = (await fs.promises.readdir(chunkDir)).filter(f => /\.chunk$/.exec(f) !== null);

  console.log(`Decompressing files for asset ${manifest.AppNameString}`);

  // decompress chunk files
  if (progressEmitter) {
    progressEmitter.emit("start", {
      name: "decompression",
      total: chunkFiles.length,
    });
  }
  let finished = 0;
  for (const chunkFileName of chunkFiles) {
    const chunkFile = path.join(chunkDir, chunkFileName);
    const file = await fs.promises.open(chunkFile, "r");

    // We need to first read a chunk's header to find out where data begins and if its compressed
    // Header details can be found in Engine\Source\Runtime\Online\BuildPatchServices\Private\Data\ChunkData.h
    // Header size is stored in the 9th byte (index 8), let's start there
    const headerToSizeBuffer = Buffer.alloc(9);
    await file.read(headerToSizeBuffer, 0, 9, 0);
    const headerSize = headerToSizeBuffer[8];

    // read the rest of the header
    const headerBuffer = Buffer.alloc(headerSize);
    await file.read(headerBuffer, 0, headerSize, 0);

    const stats = await fs.promises.stat(chunkFile);
    const chunkBuffer = Buffer.alloc(stats.size - headerSize);
    await file.read(chunkBuffer, 0, stats.size - headerSize, headerSize); // read in the chunk only
    await file.close();

    // Whether a file is compressed is always at header byte 41 (index 0)
    if (headerBuffer[40] === 1) {
      await fs.promises.writeFile(`${chunkFile}-raw`, zlib.unzipSync(chunkBuffer));
    } else {
      await fs.promises.writeFile(`${chunkFile}-raw`, chunkBuffer);
    }

    if (progressEmitter) {
      progressEmitter.emit("progress", {
        name: "decompression",
        finished: ++finished,
      });
    }
  }
  if (progressEmitter) {
    progressEmitter.emit("end", {
      name: "decompression",
    });
  }

  console.log(`Extracting asset ${manifest.AppNameString} from chunk files`);

  // Extract assets from chunks
  if (progressEmitter) {
    progressEmitter.emit("start", {
      name: "extraction",
      total: manifest.FileManifestList.length,
    });
  }
  finished = 0;
  for (const fileList of manifest.FileManifestList) {
    let fileSize = 0;
    const fileName = path.resolve(path.join(extractDir, fileList.Filename));
    await fs.promises.mkdir(path.dirname(fileName), { recursive: true });

    // Calculate total asset file size
    fileList.FileChunkParts.forEach((chunkPart) => {
      fileSize += parseInt("0x" + ChunkHashToReverseHexEncoding(chunkPart.Size));
    });

    const buffer = Buffer.alloc(fileSize);
    let bufferOffset = 0;

    // Start reading chunk data and assembling it into a buffer
    for (const chunkPart of fileList.FileChunkParts) {
      const chunkGuid = chunkPart.Guid;
      const chunkOffset = parseInt("0x" + ChunkHashToReverseHexEncoding(chunkPart.Offset));
      const chunkSize = parseInt("0x" + ChunkHashToReverseHexEncoding(chunkPart.Size));

      const file = await fs.promises.open(path.join(chunkDir, `${chunkGuid}.chunk-raw`), "r");
      await file.read(buffer, bufferOffset, chunkSize, chunkOffset);
      await file.close();
      bufferOffset += chunkSize;
    }

    // Write out the assembled buffer
    await fs.promises.writeFile(fileName, buffer);

    if (progressEmitter) {
      progressEmitter.emit("progress", {
        finished: ++finished,
      });
    }
  }
  if (progressEmitter) {
    progressEmitter.emit("end", {
      name: "extraction",
    });
  }

  console.log("Removing chunk files.");
  // rimraf.sync(chunkDir); // Remove no-longer needed chunk dir
}
