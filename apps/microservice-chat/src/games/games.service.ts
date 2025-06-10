import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly httpService: HttpService) {}

  async getExternalData({
    player1,
    player2,
    sessionId,
  }: {
    player1: {
      id: string;
      name: string;
      avatarUrl: string;
    };
    player2: {
      id: string;
      name: string;
      avatarUrl: string;
    };
    sessionId: string;
  }): Promise<string | null> {
    try {
      const axiosResponse = await firstValueFrom(
        this.httpService.post(
          'http://localhost:3010/api/v1/generate-auth-token',
          {
            player1,
            player2,
            sessionId,
          },
        ),
      );

      const response = axiosResponse.data as {
        isSuccess: boolean;
        message: string;
        data: { token: string };
      };

      const { isSuccess, message, data } = response;

      if (isSuccess) {
        return data.token;
      } else {
        this.logger.fatal(`Unsuccessful response from game server: ${message}`);
        return null;
      }
    } catch (err) {
      this.logger.fatal(
        'Error fetching external data',
        (err as { message: string }).message,
      );
      return null;
    }
  }
}
