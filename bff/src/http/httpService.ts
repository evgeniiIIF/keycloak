import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { axiosInstance } from './axios';

export class HttpService {
  private client: AxiosInstance;

  constructor(axiosInstance: AxiosInstance) {
    this.client = axiosInstance;
  }

  public async get<T = any>(url: string, params?: any): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, { params });
  }

  public async post<T = any>(url: string, data?: any, params?: any): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, { params });
  }

  public async put<T = any>(url: string, data?: any, params?: any): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, { params });
  }

  public async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }
}

export const httpService = new HttpService(axiosInstance);
