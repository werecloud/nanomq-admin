import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

function getAuthConfig(request: NextRequest) {
  const authHeader = request.headers.get('x-nanomq-auth');
  if (authHeader) {
    try {
      return JSON.parse(authHeader) as { baseURL: string; username: string; password: string };
    } catch {
      // ignore
    }
  }

  return {
    baseURL: process.env.NANOMQ_API_URL || 'http://localhost:8081',
    username: process.env.NANOMQ_USERNAME || '',
    password: process.env.NANOMQ_PASSWORD || '',
  };
}

function createNanoMQClient(config: { baseURL: string; username: string; password: string }) {
  return axios.create({
    baseURL: `${config.baseURL}/api/v4`,
    auth: {
      username: config.username,
      password: config.password,
    },
    timeout: 10000,
  });
}

export async function GET(request: NextRequest) {
  try {
    const authConfig = getAuthConfig(request);
    const nanomqClient = createNanoMQClient(authConfig);
    const response = await nanomqClient.get('/');

    if (typeof response.data === 'string') {
      return new NextResponse(response.data, {
        status: response.status,
        headers: { 'Content-Type': response.headers?.['content-type'] || 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: unknown; status?: number } };
      return NextResponse.json(
        {
          error: 'NanoMQ API Error',
          message:
            (axiosError.response?.data as { message?: string } | undefined)?.message ||
            (typeof axiosError.response?.data === 'string' ? axiosError.response.data : undefined) ||
            (error instanceof Error ? error.message : 'Unknown error'),
          status: axiosError.response?.status,
        },
        { status: axiosError.response?.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

