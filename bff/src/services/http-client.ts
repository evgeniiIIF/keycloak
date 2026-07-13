import { Injectable } from '@nestjs/common';
import { AxiosHttpClient } from './axios-instance';

@Injectable()
export class HttpClient {
  constructor(private axios: AxiosHttpClient) {}

  async get<T, P>(url: string, params?: P): Promise<T> {
    const res = await this.axios.client.get<T>(url, { params });
    return res.data;
  }

  async post<T, D>(url: string, data?: D): Promise<T> {
    const res = await this.axios.client.post<T>(url, data);
    return res.data;
  }

  async put<T, D>(url: string, data?: D): Promise<T> {
    const res = await this.axios.client.put<T>(url, data);
    return res.data;
  }

  async delete<T>(url: string): Promise<T> {
    const res = await this.axios.client.delete<T>(url);
    return res.data;
  }

  async patch<T, D>(url: string, data?: D): Promise<T> {
    const res = await this.axios.client.patch<T>(url, data);
    return res.data;
  }
}
