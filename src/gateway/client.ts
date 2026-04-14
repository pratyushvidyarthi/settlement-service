import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

export interface CaptureRequest {
  preAuthId:      string;
  amountCents:    number;
  idempotencyKey: string;
  metadata?:      Record<string, string>;
}

export interface CaptureResponse {
  captureId:   string;
  status:      'succeeded' | 'failed';
  amountCents: number;
}

class GatewayClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.GATEWAY_URL,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': env.GATEWAY_API_KEY,
      },
    });
  }

  async capture(req: CaptureRequest): Promise<CaptureResponse> {
    const { data } = await this.http.post<CaptureResponse>('/capture', req);
    return data;
  }
}

export const gatewayClient = new GatewayClient();
