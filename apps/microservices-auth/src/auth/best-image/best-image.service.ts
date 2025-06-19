/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as sharp from 'sharp';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
type FaceAnnotation = protos.google.cloud.vision.v1.IFaceAnnotation;

@Injectable()
export class BestImageService {
  private readonly logger = new Logger(BestImageService.name);
  private readonly visionClient = new ImageAnnotatorClient();

  constructor(private readonly httpService: HttpService) {}

  private getLikelihoodScore(likelihood: string | number): number {
    const levels = {
      UNKNOWN: 0,
      VERY_UNLIKELY: 1,
      UNLIKELY: 2,
      POSSIBLE: 3,
      LIKELY: 4,
      VERY_LIKELY: 5,
    };
    if (typeof likelihood === 'number') return likelihood;
    return levels[likelihood as keyof typeof levels] || 0;
  }

  private calculatePolygonArea(vertices: { x?: number; y?: number }[]): number {
    return Math.abs(
      vertices.reduce((acc, point, i, arr) => {
        const next = arr[(i + 1) % arr.length];
        return (
          acc +
          ((point.x ?? 0) * (next.y ?? 0) - (next.x ?? 0) * (point.y ?? 0))
        );
      }, 0) / 2,
    );
  }

  private convertDriveLinkIfNeeded(url: string): string {
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//);
    if (!match) return url; // Not a Drive link
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  private async analyzeImageUrl(
    url: string,
  ): Promise<{ url: string; score: number } | null> {
    const directUrl = this.convertDriveLinkIfNeeded(url);

    const response = await this.httpService.axiosRef.get<ArrayBuffer>(
      directUrl,
      {
        responseType: 'arraybuffer',
      },
    );
    const buffer = Buffer.from(new Uint8Array(response.data));

    if (buffer.length > 2 * 1024 * 1024) {
      this.logger.log(`Skipping ${url}: less than 2MB`);
      return null;
    }

    const imageSharp = sharp(buffer);
    const metadata = await imageSharp.metadata();
    const { width = 0, height = 0 } = metadata;
    const totalArea = width * height;

    const image = { content: buffer.toString('base64') };
    const [result] = await this.visionClient.faceDetection({ image });

    const face = result.faceAnnotations?.[0] as FaceAnnotation | undefined;

    if (
      !face ||
      !face.boundingPoly?.vertices ||
      face.boundingPoly.vertices.length < 4
    ) {
      this.logger.log(`No valid face in ${url}`);
      return null;
    }

    const faceArea = this.calculatePolygonArea(
      face.boundingPoly.vertices.map((v) => ({
        x: v.x === null ? undefined : v.x,
        y: v.y === null ? undefined : v.y,
      })),
    );
    const facePercent = faceArea / totalArea;

    this.logger.log(
      `📏 Face in ${url} covers ${(facePercent * 100).toFixed(2)}%`,
    );

    if (facePercent < 0.25) {
      this.logger.log(`Face size < 25% in ${url}`);
      return null;
    }

    const score =
      (face.detectionConfidence ?? 0) * 0.4 +
      this.getLikelihoodScore(face.joyLikelihood ?? 'UNKNOWN') * 0.2 +
      (this.getLikelihoodScore('VERY_UNLIKELY') -
        this.getLikelihoodScore(face.blurredLikelihood ?? 'UNKNOWN')) *
        0.2 +
      (this.getLikelihoodScore('VERY_UNLIKELY') -
        this.getLikelihoodScore(face.headwearLikelihood ?? 'UNKNOWN')) *
        0.1;

    return { url, score };
  }

  async selectBestImage(imageUrls: string[]): Promise<string | null> {
    const results: { url: string; score: number }[] = [];

    for (const url of imageUrls) {
      try {
        const result = await this.analyzeImageUrl(url);
        if (result) results.push(result);
      } catch (err: any) {
        this.logger.error(
          `Failed to process ${url}:`,
          typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message: string }).message
            : err,
        );
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.length > 0 ? results[0].url : null;
  }
}
