import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// 从请求头或本地存储获取认证信息的辅助函数
function getAuthConfig(request: NextRequest) {
  // 尝试从请求头获取认证信息
  const authHeader = request.headers.get('x-nanomq-auth');
  
  if (authHeader) {
    try {
      return JSON.parse(authHeader);
    } catch {
      // 如果解析失败，使用默认配置
    }
  }
  
  // 使用环境变量作为默认配置
  return {
    baseURL: process.env.NANOMQ_API_URL || 'http://localhost:8081',
    username: process.env.NANOMQ_USERNAME || 'admin',
    password: process.env.NANOMQ_PASSWORD || 'public',
  };
}

// 创建动态 axios 实例
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

// 处理所有 HTTP 方法
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest('GET', request, await params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest('POST', request, await params);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest('PUT', request, await params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest('DELETE', request, await params);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleRequest('PATCH', request, await params);
}

async function handleRequest(
  method: string,
  request: NextRequest,
  params: { path: string[] }
) {
  try {
    // 获取认证配置
    const authConfig = getAuthConfig(request);
    const nanomqClient = createNanoMQClient(authConfig);
    
    const path = params.path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const fullPath = searchParams ? `${path}?${searchParams}` : path;

    // 获取请求体（如果有）：按 Content-Type 分支读取，避免 body 被重复消费
    let data: unknown = undefined;
    let contentType = request.headers.get('content-type') || undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const lowerContentType = (contentType || '').toLowerCase();
      if (lowerContentType.includes('application/json')) {
        const text = await request.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            // 标记为 JSON 但不是合法 JSON 时，按原文透传给上游
            data = text;
          }
        }
      } else {
        const text = await request.text();
        if (text) data = text;
        if (!contentType) contentType = 'text/plain';
      }
    }

    console.log(`[NanoMQ API Proxy] ${method} /${fullPath}`);

    // 发送请求到 NanoMQ
    const response = await nanomqClient.request({
      method: method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch',
      url: fullPath,
      data,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    });

    const respContentType =
      (typeof response.headers?.['content-type'] === 'string' && response.headers['content-type']) ||
      (typeof response.headers?.['Content-Type'] === 'string' && response.headers['Content-Type']) ||
      undefined;

    // NanoMQ 多数接口返回 JSON；少量接口（如 /prometheus）返回 text/plain
    if (typeof response.data === 'string') {
      return new NextResponse(response.data, {
        status: response.status,
        headers: {
          'Content-Type': respContentType || 'text/plain; charset=utf-8',
        },
      });
    }

    return NextResponse.json(response.data, {
      status: response.status,
      headers: respContentType ? { 'Content-Type': respContentType } : undefined,
    });
  } catch (error) {
    console.error('[NanoMQ API Proxy] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error && typeof error === 'object' && 'response' in error) {
      // NanoMQ 返回了错误响应
      const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
      return NextResponse.json(
        {
          error: 'NanoMQ API Error',
          message:
            axiosError.response?.data?.message ||
            (typeof axiosError.response?.data === 'string' ? axiosError.response?.data : undefined) ||
            (error instanceof Error ? error.message : 'Unknown error'),
          status: axiosError.response?.status,
        },
        { status: axiosError.response?.status || 500 }
      );
    } else if (error && typeof error === 'object' && 'request' in error) {
      // 网络错误或连接失败
      return NextResponse.json(
        {
          error: 'Connection Error',
          message: 'Failed to connect to NanoMQ server',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 503 }
      );
    } else {
      // 其他错误
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }
}